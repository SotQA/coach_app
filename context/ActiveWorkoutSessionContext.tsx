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

interface ActiveWorkoutSessionContextValue {
  session: ActiveWorkoutSession | null;
  /** Live rest seconds remaining (float). 0 when inactive. */
  restSecondsRemaining: number;
  startSession: (params: StartSessionParams) => Promise<void>;
  updateSet: (exIdx: number, setIdx: number, patch: Partial<ActiveSetDraft>) => void;
  updateNotes: (notes: string) => void;
  finishSession: () => Promise<void>;
  startRestTimer: (durationSeconds: number, nextExerciseIndex: number, nextSetIndex: number) => void;
  skipRestTimer: () => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

async function writeToStorage(session: ActiveWorkoutSession | null): Promise<void> {
  if (session === null) {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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

/** Returns the first uncompleted set in the session, or null if all done. */
function findFirstUncompletedSet(
  exercises: ActiveExerciseDraft[]
): { exIdx: number; setIdx: number } | null {
  for (let ei = 0; ei < exercises.length; ei++) {
    const sets = exercises[ei]?.sets ?? [];
    for (let si = 0; si < sets.length; si++) {
      if (!sets[si].completed) return { exIdx: ei, setIdx: si };
    }
  }
  return null;
}

function calcRestRemaining(rt: RestTimer): number {
  if (!rt.isActive) return 0;
  if (rt.isPaused) return Math.max(0, rt.pausedRemainingSeconds ?? 0);
  return Math.max(0, rt.durationSeconds - (Date.now() - rt.startedAt) / 1000);
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ActiveWorkoutSessionContext = createContext<ActiveWorkoutSessionContextValue | undefined>(
  undefined
);

export function ActiveWorkoutSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);

  const sessionRef = useRef<ActiveWorkoutSession | null>(null);
  sessionRef.current = session;

  // Tracks the most-recently scheduled OS notification ID synchronously so
  // we can cancel it before scheduling a new one, avoiding double-fire.
  const pendingRestNotificationIdRef = useRef<string | null>(null);

  // ── Debounced persistence (500 ms) ────────────────────────────────────────
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueuedSessionRef = useRef<ActiveWorkoutSession | null>(null);

  const persistDebounced = useCallback((next: ActiveWorkoutSession | null) => {
    lastQueuedSessionRef.current = next;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const toWrite = lastQueuedSessionRef.current;
      persistTimerRef.current = null;
      writeToStorage(toWrite).catch((e) =>
        logger.warn("[ActiveWorkout] setItem failed", e)
      );
    }, 500);
  }, []);

  /**
   * Cancel the pending debounce and write immediately.
   * If no write is pending the disk is already current — returns without writing.
   * Use `writeToStorage` directly when you need to force an unconditional write.
   */
  const flushPersist = useCallback(async () => {
    if (!persistTimerRef.current) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = null;
    const toWrite = lastQueuedSessionRef.current;
    try {
      await writeToStorage(toWrite);
    } catch (e) {
      logger.warn("[ActiveWorkout] flush failed", e);
    }
  }, []);

  // ── Hydrate on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    hydrate().then((loaded) => {
      if (!loaded) return;
      // Seed the queued ref so the first AppState/periodic flush sees the right value.
      lastQueuedSessionRef.current = loaded;
      setSession(loaded);
      if (loaded.restTimer?.isActive) {
        const rem = calcRestRemaining(loaded.restTimer);
        setRestSecondsRemaining(rem);
        // If the rest timer expired while the app was closed, auto-clear it.
        if (rem <= 0) {
          const cleared = { ...loaded, restTimer: undefined };
          setSession(cleared);
          persistDebounced(cleared);
        }
      }
    });
  }, [persistDebounced]);

  // ── Clear session on logout ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      cancelAllScheduledNotifications();
      setSession(null);
      setRestSecondsRemaining(0);
      // Cancel any pending debounce and write null immediately (fire-and-forget).
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      lastQueuedSessionRef.current = null;
      writeToStorage(null).catch((e) =>
        logger.warn("[ActiveWorkout] logout clear failed", e)
      );
    }
  }, [user]);

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
          persistDebounced(updated);
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

  // ── Periodic save every 10 s (belt-and-suspenders for crashes) ───────────
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      const current = sessionRef.current;
      if (!current) return;
      // Cancel any pending debounce and write the current state directly.
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      lastQueuedSessionRef.current = current;
      writeToStorage(current).catch((e) =>
        logger.warn("[ActiveWorkout] periodic save failed", e)
      );
    }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  // ── AppState: flush on background, resync rest timer on foreground ────────
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        // Flush any pending debounced write before the app is suspended.
        flushPersist();
      } else if (state === "active") {
        const s = sessionRef.current;
        if (!s) return;
        if (s.restTimer?.isActive) {
          const rem = calcRestRemaining(s.restTimer);
          setRestSecondsRemaining(rem);
          // Timer finished while the app was in background — clear it.
          if (rem <= 0) {
            const cleared: ActiveWorkoutSession = { ...s, restTimer: undefined };
            setSession(cleared);
            persistDebounced(cleared);
          }
        }
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => {
      // Flush on provider unmount as well.
      flushPersist();
      sub.remove();
    };
  }, [flushPersist, persistDebounced]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startSession = useCallback(async (params: StartSessionParams) => {
    const newSession: ActiveWorkoutSession = {
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: Date.now(),
      notes: "",
      ...params,
    };
    setSession(newSession);
    // Write immediately — starting a session is a critical event.
    persistDebounced(newSession);
    await flushPersist();
  }, [flushPersist, persistDebounced]);

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
        persistDebounced(updated);
        return updated;
      });

      // Set completion is a critical state change — write immediately so a
      // force-quit right after ticking a set done doesn't lose progress.
      // We re-compute the update from sessionRef (pre-update snapshot) rather
      // than waiting for the functional updater above to commit.
      if (patch.completed === true) {
        const current = sessionRef.current;
        if (current) {
          const exercises = current.exercises.map((ex, i) =>
            i !== exIdx
              ? ex
              : { ...ex, sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) }
          );
          const updated = { ...current, exercises };
          // Sync the queued ref so any subsequent flush sees the completed state.
          lastQueuedSessionRef.current = updated;
          if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = null;
          }
          writeToStorage(updated).catch((e) =>
            logger.warn("[ActiveWorkout] set-complete persist failed", e)
          );
        }
      }
    },
    [persistDebounced]
  );

  const updateNotes = useCallback((notes: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, notes };
      persistDebounced(updated);
      return updated;
    });
  }, [persistDebounced]);

  const finishSession = useCallback(async () => {
    // Cancel ALL scheduled notifications — this is the safety net for bug 6
    // (phantom sessions). A stale rest notification that fires after the workout
    // ends would otherwise open workoutExecution with no active session, which
    // auto-creates a new session and records a phantom workout.
    pendingRestNotificationIdRef.current = null;
    await cancelAllScheduledNotifications();

    // Flush any pending debounced write while the session is still set.
    await flushPersist();

    setSession(null);
    setRestSecondsRemaining(0);

    // Clear storage immediately — finishing a session must not lose state.
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    lastQueuedSessionRef.current = null;
    await writeToStorage(null).catch((e) =>
      logger.warn("[ActiveWorkout] finish session clear failed", e)
    );
  }, [flushPersist]);

  // ── Rest timer actions ────────────────────────────────────────────────────

  const startRestTimer = useCallback((
    durationSeconds: number,
    nextExerciseIndex: number,
    nextSetIndex: number
  ) => {
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
      persistDebounced(updated);
      return updated;
    });

    // workoutPlanId / workoutName never change within a session — safe to read
    // from the ref here for the notification payload.
    const { workoutPlanId, workoutName } = sessionRef.current;

    // Schedule the OS notification asynchronously, then store its ID.
    // TIME_INTERVAL trigger: OS-level scheduling — fires even if app is killed.
    scheduleRestNotification({
      delaySeconds: durationSeconds,
      workoutPlanId,
      workoutName,
      nextExerciseIndex,
      nextSetIndex,
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
        persistDebounced(updated);
        return updated;
      });
    });
  }, [persistDebounced]);

  const skipRestTimer = useCallback(() => {
    const pendingId = pendingRestNotificationIdRef.current ?? sessionRef.current?.restTimer?.notificationId;
    cancelRestNotification(pendingId);
    pendingRestNotificationIdRef.current = null;

    setRestSecondsRemaining(0);
    setSession((prev) => {
      if (!prev) return prev;
      const updated: ActiveWorkoutSession = { ...prev, restTimer: undefined };
      persistDebounced(updated);
      return updated;
    });
  }, [persistDebounced]);

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
      persistDebounced(updated);
      return updated;
    });
  }, [persistDebounced]);

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
      persistDebounced(updated);
      return updated;
    });

    // Reschedule the OS notification for the remaining duration.
    if (remaining > 0) {
      const s = sessionRef.current!;
      const next = findFirstUncompletedSet(s.exercises);
      scheduleRestNotification({
        delaySeconds: remaining,
        workoutPlanId: s.workoutPlanId,
        workoutName: s.workoutName,
        nextExerciseIndex: next?.exIdx ?? -1,
        nextSetIndex: next?.setIdx ?? -1,
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
          persistDebounced(updated);
          return updated;
        });
      });
    }
  }, [persistDebounced]);

  return (
    <ActiveWorkoutSessionContext.Provider
      value={{
        session,
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
    </ActiveWorkoutSessionContext.Provider>
  );
}

export function useActiveWorkoutSession(): ActiveWorkoutSessionContextValue {
  const ctx = useContext(ActiveWorkoutSessionContext);
  if (!ctx) throw new Error("useActiveWorkoutSession must be used within ActiveWorkoutSessionProvider");
  return ctx;
}
