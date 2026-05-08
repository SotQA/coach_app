import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import {
  cancelAllScheduledNotifications,
  cancelRestNotification,
  scheduleRestNotification,
} from "../services/notificationService";
import { logger } from "../utils/logger";

const STORAGE_KEY = "activeWorkoutSession.v2";

// One-time best-effort cleanup of the legacy v1 key.
AsyncStorage.removeItem("activeWorkoutSession").catch(() => {});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActiveSetDraft {
  weight: string;
  reps: string;
  rpe: string;
  completed: boolean;
}

export interface ActiveExerciseDraft {
  name: string;
  sets: ActiveSetDraft[];
}

/**
 * Rest timer embedded inside the session (persisted to AsyncStorage).
 *
 * Remaining time is always re-derived from `startedAt`:
 *   remaining = durationSeconds - (Date.now() - startedAt) / 1000
 *
 * On pause: `pausedRemainingSeconds` is snapshotted and `isPaused = true`.
 * On resume: `startedAt` is backdated so the formula still holds.
 *
 * `notificationId` tracks the scheduled OS notification so it can be
 * cancelled if the user skips, pauses, or finishes the session early.
 */
export interface RestTimer {
  isActive: boolean;
  durationSeconds: number;
  /** Wall-clock ms when this timer run began (or was last resumed). */
  startedAt: number;
  isPaused: boolean;
  /** Seconds remaining at the moment the timer was paused. */
  pausedRemainingSeconds?: number;
  /** Identifier of the scheduled OS notification (for cancellation). */
  notificationId?: string;
}

export interface ActiveWorkoutSession {
  sessionId: string;
  studentId: string;
  workoutPlanId: string;
  workoutName: string;
  groupId: string;
  /** Wall-clock ms timestamp of when the session started (Date.now()). */
  startedAt: number;
  exercises: ActiveExerciseDraft[];
  notes: string;
  /** Currently-running rest timer, if any. */
  restTimer?: RestTimer;
}

interface StartSessionParams {
  studentId: string;
  workoutPlanId: string;
  workoutName: string;
  groupId: string;
  exercises: ActiveExerciseDraft[];
  notes?: string;
}

interface ActiveWorkoutContextValue {
  session: ActiveWorkoutSession | null;
  /** Live workout elapsed seconds, derived from session.startedAt. */
  elapsedSeconds: number;
  /** Live rest seconds remaining (float). 0 when inactive. */
  restSecondsRemaining: number;
  startSession: (params: StartSessionParams) => Promise<void>;
  updateSet: (exIdx: number, setIdx: number, patch: Partial<ActiveSetDraft>) => void;
  updateNotes: (notes: string) => void;
  finishSession: () => Promise<void>;
  startRestTimer: (durationSeconds: number) => void;
  skipRestTimer: () => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

async function persist(session: ActiveWorkoutSession | null): Promise<void> {
  try {
    if (session === null) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  } catch (e) {
    logger.warn("[ActiveWorkout] persist failed:", e);
  }
}

async function hydrate(): Promise<ActiveWorkoutSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      logger.warn("[ActiveWorkout] corrupt session blob, clearing", e);
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as any).workoutPlanId !== "string" ||
      !(parsed as any).sessionId ||
      !(parsed as any).studentId ||
      typeof (parsed as any).startedAt !== "number"
    ) {
      logger.warn("[ActiveWorkout] invalid session schema, clearing");
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as ActiveWorkoutSession;
  } catch (e) {
    logger.warn("[ActiveWorkout] corrupt session blob, clearing", e);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
    return null;
  }
}

function calcRestRemaining(rt: RestTimer): number {
  if (!rt.isActive) return 0;
  if (rt.isPaused) return Math.max(0, rt.pausedRemainingSeconds ?? 0);
  return Math.max(0, rt.durationSeconds - (Date.now() - rt.startedAt) / 1000);
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | undefined>(undefined);

export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);

  const sessionRef = useRef<ActiveWorkoutSession | null>(null);
  sessionRef.current = session;

  // Tracks the most-recently scheduled OS notification ID synchronously so
  // we can cancel it before scheduling a new one, avoiding double-fire.
  const pendingRestNotificationIdRef = useRef<string | null>(null);

  // ── Hydrate on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    hydrate().then((loaded) => {
      if (!loaded) return;
      setSession(loaded);
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - loaded.startedAt) / 1000)));
      if (loaded.restTimer?.isActive) {
        const rem = calcRestRemaining(loaded.restTimer);
        setRestSecondsRemaining(rem);
        // If the rest timer expired while the app was closed, auto-clear it.
        if (rem <= 0) {
          const cleared = { ...loaded, restTimer: undefined };
          setSession(cleared);
          persist(cleared);
        }
      }
    });
  }, []);

  // ── Clear session on logout ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      cancelAllScheduledNotifications();
      setSession(null);
      setElapsedSeconds(0);
      setRestSecondsRemaining(0);
      persist(null);
    }
  }, [user]);

  // ── Workout elapsed timer (1 s tick) ─────────────────────────────────────
  useEffect(() => {
    if (!session) { setElapsedSeconds(0); return; }
    const tick = () =>
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId, session?.startedAt]);

  // ── Rest timer tick (250 ms — smooth countdown + auto-stop at 0) ─────────
  useEffect(() => {
    const rt = session?.restTimer;

    if (!rt?.isActive) { setRestSecondsRemaining(0); return; }
    if (rt.isPaused) {
      setRestSecondsRemaining(Math.max(0, rt.pausedRemainingSeconds ?? 0));
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    const tick = () => {
      const current = sessionRef.current?.restTimer;
      if (!current?.isActive || current.isPaused) { clearInterval(intervalId); return; }

      const remaining = Math.max(
        0,
        current.durationSeconds - (Date.now() - current.startedAt) / 1000
      );
      setRestSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
        // Notification already fired — just clear the timer state.
        setSession((prev) => {
          if (!prev?.restTimer?.isActive) return prev;
          const updated: ActiveWorkoutSession = { ...prev, restTimer: undefined };
          persist(updated);
          return updated;
        });
      }
    };

    tick();
    intervalId = setInterval(tick, 250);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session?.restTimer?.isActive,
    session?.restTimer?.isPaused,
    session?.restTimer?.startedAt,
    session?.restTimer?.durationSeconds,
  ]);

  // ── Periodic save every 10 s ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => { if (sessionRef.current) persist(sessionRef.current); }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  // ── AppState: save on background, resync timers on foreground ────────────
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        if (sessionRef.current) persist(sessionRef.current);
      } else if (state === "active") {
        const s = sessionRef.current;
        if (!s) return;
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000)));
        if (s.restTimer?.isActive) {
          const rem = calcRestRemaining(s.restTimer);
          setRestSecondsRemaining(rem);
          // Timer finished while the app was in background — clear it.
          if (rem <= 0) {
            const cleared: ActiveWorkoutSession = { ...s, restTimer: undefined };
            setSession(cleared);
            persist(cleared);
          }
        }
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startSession = useCallback(async (params: StartSessionParams) => {
    const newSession: ActiveWorkoutSession = {
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: Date.now(),
      notes: "",
      ...params,
    };
    setSession(newSession);
    setElapsedSeconds(0);
    await persist(newSession);
  }, []);

  const updateSet = useCallback(
    (exIdx: number, setIdx: number, patch: Partial<ActiveSetDraft>) => {
      setSession((prev) => {
        if (!prev) return prev;
        const exercises = prev.exercises.map((ex, i) =>
          i !== exIdx
            ? ex
            : { ...ex, sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) }
        );
        const updated = { ...prev, exercises };
        persist(updated);
        return updated;
      });
    },
    []
  );

  const updateNotes = useCallback((notes: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, notes };
      persist(updated);
      return updated;
    });
  }, []);

  const finishSession = useCallback(async () => {
    // Cancel any pending rest notification before clearing the session.
    const pendingId = pendingRestNotificationIdRef.current ?? sessionRef.current?.restTimer?.notificationId;
    pendingRestNotificationIdRef.current = null;
    await cancelRestNotification(pendingId);

    setSession(null);
    setElapsedSeconds(0);
    setRestSecondsRemaining(0);
    await persist(null);
  }, []);

  // ── Rest timer actions ────────────────────────────────────────────────────

  const startRestTimer = useCallback((durationSeconds: number) => {
    if (durationSeconds <= 0) return;
    if (!sessionRef.current) return;

    // Cancel any previously pending notification via the ref (synchronous, no race).
    if (pendingRestNotificationIdRef.current) {
      cancelRestNotification(pendingRestNotificationIdRef.current);
      pendingRestNotificationIdRef.current = null;
    }

    // Build the timer state immediately (timer starts at this exact instant).
    const startedAt = Date.now();
    const restTimer: RestTimer = {
      isActive: true,
      durationSeconds,
      startedAt,
      isPaused: false,
    };

    // Use functional update so this is applied on top of any concurrent state
    // changes (e.g. the updateSet call that just marked a set as completed),
    // rather than overwriting them with a stale snapshot from sessionRef.
    setSession((prev) => {
      if (!prev) return prev;
      const updated: ActiveWorkoutSession = { ...prev, restTimer };
      persist(updated);
      return updated;
    });

    // workoutPlanId / workoutName never change within a session — safe to read
    // from the ref here for the notification payload.
    const { workoutPlanId, workoutName } = sessionRef.current;

    // Schedule the OS notification asynchronously, then store its ID.
    scheduleRestNotification({
      delaySeconds: durationSeconds,
      workoutPlanId,
      workoutName,
    }).then((notificationId) => {
      if (!notificationId) return;
      pendingRestNotificationIdRef.current = notificationId;
      setSession((prev) => {
        // Only store the ID if the same timer is still running.
        if (!prev?.restTimer?.isActive || prev.restTimer.startedAt !== startedAt) {
          // Timer was already skipped or replaced — cancel the just-scheduled notif.
          cancelRestNotification(notificationId);
          pendingRestNotificationIdRef.current = null;
          return prev;
        }
        const updated: ActiveWorkoutSession = {
          ...prev,
          restTimer: { ...prev.restTimer, notificationId },
        };
        persist(updated);
        return updated;
      });
    });
  }, []);

  const skipRestTimer = useCallback(() => {
    const pendingId = pendingRestNotificationIdRef.current ?? sessionRef.current?.restTimer?.notificationId;
    cancelRestNotification(pendingId);
    pendingRestNotificationIdRef.current = null;

    setRestSecondsRemaining(0);
    setSession((prev) => {
      if (!prev) return prev;
      const updated: ActiveWorkoutSession = { ...prev, restTimer: undefined };
      persist(updated);
      return updated;
    });
  }, []);

  const pauseRestTimer = useCallback(() => {
    const rt = sessionRef.current?.restTimer;
    if (!rt?.isActive || rt.isPaused) return;

    const remaining = Math.max(0, rt.durationSeconds - (Date.now() - rt.startedAt) / 1000);

    // Cancel the OS notification — it will be rescheduled for `remaining` seconds on resume.
    cancelRestNotification(pendingRestNotificationIdRef.current ?? rt.notificationId);
    pendingRestNotificationIdRef.current = null;

    setRestSecondsRemaining(remaining);
    setSession((prev) => {
      const prevRt = prev?.restTimer;
      if (!prev || !prevRt?.isActive || prevRt.isPaused) return prev;
      const updated: ActiveWorkoutSession = {
        ...prev,
        restTimer: {
          ...prevRt,
          isPaused: true,
          pausedRemainingSeconds: remaining,
          notificationId: undefined,
        },
      };
      persist(updated);
      return updated;
    });
  }, []);

  const resumeRestTimer = useCallback(() => {
    const rt = sessionRef.current?.restTimer;
    if (!rt?.isActive || !rt.isPaused) return;

    const remaining = rt.pausedRemainingSeconds ?? 0;
    // Backdate startedAt so "durationSeconds - (Date.now() - startedAt) = remaining" holds.
    const newStartedAt = Date.now() - (rt.durationSeconds - remaining) * 1000;

    setSession((prev) => {
      const prevRt = prev?.restTimer;
      if (!prev || !prevRt?.isActive || !prevRt.isPaused) return prev;
      const updated: ActiveWorkoutSession = {
        ...prev,
        restTimer: {
          ...prevRt,
          isPaused: false,
          startedAt: newStartedAt,
          pausedRemainingSeconds: undefined,
          notificationId: undefined,
        },
      };
      persist(updated);
      return updated;
    });

    // Reschedule the OS notification for the remaining duration.
    if (remaining > 0) {
      const s = sessionRef.current!;
      scheduleRestNotification({
        delaySeconds: remaining,
        workoutPlanId: s.workoutPlanId,
        workoutName: s.workoutName,
      }).then((notificationId) => {
        if (!notificationId) return;
        pendingRestNotificationIdRef.current = notificationId;
        setSession((prev) => {
          if (!prev?.restTimer?.isActive || prev.restTimer.isPaused) {
            cancelRestNotification(notificationId);
            pendingRestNotificationIdRef.current = null;
            return prev;
          }
          const updated: ActiveWorkoutSession = {
            ...prev,
            restTimer: { ...prev.restTimer!, notificationId },
          };
          persist(updated);
          return updated;
        });
      });
    }
  }, []);

  return (
    <ActiveWorkoutContext.Provider
      value={{
        session,
        elapsedSeconds,
        restSecondsRemaining,
        startSession,
        updateSet,
        updateNotes,
        finishSession,
        startRestTimer,
        skipRestTimer,
        pauseRestTimer,
        resumeRestTimer,
      }}
    >
      {children}
    </ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout(): ActiveWorkoutContextValue {
  const ctx = useContext(ActiveWorkoutContext);
  if (!ctx) throw new Error("useActiveWorkout must be used within ActiveWorkoutProvider");
  return ctx;
}
