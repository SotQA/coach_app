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

const STORAGE_KEY = "activeWorkoutSession";

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
 */
export interface RestTimer {
  isActive: boolean;
  durationSeconds: number;
  /** Wall-clock ms when this timer run began (or was last resumed). */
  startedAt: number;
  isPaused: boolean;
  /** Seconds remaining at the moment the timer was paused. */
  pausedRemainingSeconds?: number;
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
  /** Live workout elapsed seconds, derived from session.startedAt. Accurate after app reopen. */
  elapsedSeconds: number;
  /** Live rest seconds remaining (float). Derived from restTimer.startedAt. 0 when inactive. */
  restSecondsRemaining: number;
  startSession: (params: StartSessionParams) => Promise<void>;
  updateSet: (exIdx: number, setIdx: number, patch: Partial<ActiveSetDraft>) => void;
  updateNotes: (notes: string) => void;
  finishSession: () => Promise<void>;
  /** Start a rest timer. Replaces any existing timer. */
  startRestTimer: (durationSeconds: number) => void;
  /** End the rest timer immediately (user skipped or timer expired). */
  skipRestTimer: () => void;
  /** Pause the rest timer, snapshotting remaining seconds. */
  pauseRestTimer: () => void;
  /** Resume a paused rest timer. */
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
    console.warn("[ActiveWorkout] persist failed:", e);
  }
}

async function hydrate(): Promise<ActiveWorkoutSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveWorkoutSession>;
    // Validate minimum required fields.
    if (
      !parsed?.sessionId ||
      !parsed?.workoutPlanId ||
      !parsed?.studentId ||
      typeof parsed?.startedAt !== "number"
    ) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as ActiveWorkoutSession;
  } catch {
    // Corrupted storage — safely reset.
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
    return null;
  }
}

/** Calculate rest seconds remaining from a RestTimer snapshot. Returns 0 if done. */
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

  // Always-fresh ref — avoids stale closures in AppState / interval callbacks.
  const sessionRef = useRef<ActiveWorkoutSession | null>(null);
  sessionRef.current = session;

  // ── Hydrate on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    hydrate().then((loaded) => {
      if (loaded) {
        setSession(loaded);
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - loaded.startedAt) / 1000)));
        if (loaded.restTimer?.isActive) {
          setRestSecondsRemaining(calcRestRemaining(loaded.restTimer));
        }
      }
    });
  }, []);

  // ── Clear session when user logs out ──────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setSession(null);
      setElapsedSeconds(0);
      setRestSecondsRemaining(0);
      persist(null);
    }
  }, [user]);

  // ── Workout elapsed timer (1 s tick) ─────────────────────────────────────
  useEffect(() => {
    if (!session) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () =>
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId, session?.startedAt]);

  // ── Rest timer tick (250 ms — smooth countdown + auto-stop at 0) ─────────
  // Uses sessionRef inside the tick to always read the latest values without
  // re-creating the interval on every state change.
  useEffect(() => {
    const rt = session?.restTimer;

    if (!rt?.isActive) {
      setRestSecondsRemaining(0);
      return;
    }
    if (rt.isPaused) {
      setRestSecondsRemaining(Math.max(0, rt.pausedRemainingSeconds ?? 0));
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    const tick = () => {
      const current = sessionRef.current?.restTimer;
      // Bail out if rest timer was deactivated/paused between ticks.
      if (!current?.isActive || current.isPaused) {
        clearInterval(intervalId);
        return;
      }

      const remaining = Math.max(
        0,
        current.durationSeconds - (Date.now() - current.startedAt) / 1000
      );
      setRestSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
        // Auto-stop: clear the restTimer from the session.
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
    const id = setInterval(() => {
      if (sessionRef.current) persist(sessionRef.current);
    }, 10_000);
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
          setRestSecondsRemaining(calcRestRemaining(s.restTimer));
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
            : {
                ...ex,
                sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })),
              }
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
    setSession(null);
    setElapsedSeconds(0);
    setRestSecondsRemaining(0);
    await persist(null);
  }, []);

  const startRestTimer = useCallback((durationSeconds: number) => {
    if (durationSeconds <= 0) return;
    setSession((prev) => {
      if (!prev) return prev;
      const restTimer: RestTimer = {
        isActive: true,
        durationSeconds,
        startedAt: Date.now(),
        isPaused: false,
      };
      const updated = { ...prev, restTimer };
      persist(updated);
      return updated;
    });
  }, []);

  const skipRestTimer = useCallback(() => {
    setRestSecondsRemaining(0);
    setSession((prev) => {
      if (!prev) return prev;
      const updated: ActiveWorkoutSession = { ...prev, restTimer: undefined };
      persist(updated);
      return updated;
    });
  }, []);

  const pauseRestTimer = useCallback(() => {
    setSession((prev) => {
      const rt = prev?.restTimer;
      if (!prev || !rt?.isActive || rt.isPaused) return prev;
      const remaining = Math.max(
        0,
        rt.durationSeconds - (Date.now() - rt.startedAt) / 1000
      );
      const updated: ActiveWorkoutSession = {
        ...prev,
        restTimer: { ...rt, isPaused: true, pausedRemainingSeconds: remaining },
      };
      persist(updated);
      setRestSecondsRemaining(remaining);
      return updated;
    });
  }, []);

  const resumeRestTimer = useCallback(() => {
    setSession((prev) => {
      const rt = prev?.restTimer;
      if (!prev || !rt?.isActive || !rt.isPaused) return prev;
      const remaining = rt.pausedRemainingSeconds ?? 0;
      // Backdate startedAt so "durationSeconds - (Date.now() - startedAt)" = remaining.
      const newStartedAt = Date.now() - (rt.durationSeconds - remaining) * 1000;
      const updated: ActiveWorkoutSession = {
        ...prev,
        restTimer: {
          ...rt,
          isPaused: false,
          startedAt: newStartedAt,
          pausedRemainingSeconds: undefined,
        },
      };
      persist(updated);
      return updated;
    });
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
