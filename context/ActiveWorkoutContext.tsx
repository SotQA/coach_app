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
  /** Live elapsed seconds, always derived from startedAt. Accurate after app reopen. */
  elapsedSeconds: number;
  startSession: (params: StartSessionParams) => Promise<void>;
  updateSet: (exIdx: number, setIdx: number, patch: Partial<ActiveSetDraft>) => void;
  updateNotes: (notes: string) => void;
  finishSession: () => Promise<void>;
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
    // Validate minimum required fields before trusting stored data.
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

// ─── Context ─────────────────────────────────────────────────────────────────

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | undefined>(undefined);

export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Keep a ref so AppState / interval callbacks always see the latest session
  // without needing it as a dependency (avoids stale closures).
  const sessionRef = useRef<ActiveWorkoutSession | null>(null);
  sessionRef.current = session;

  // ── Hydrate on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    hydrate().then((loaded) => {
      if (loaded) {
        setSession(loaded);
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - loaded.startedAt) / 1000)));
      }
    });
  }, []);

  // ── Clear session when user logs out ──────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setSession(null);
      setElapsedSeconds(0);
      persist(null);
    }
  }, [user]);

  // ── Live timer: re-derives elapsed from startedAt every second ────────────
  // Restarts only when a new session begins (sessionId changes), so the
  // elapsed count stays accurate even after the app is reopened.
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

  // ── Periodic save every 10 s to keep startedAt fresh in storage ──────────
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      if (sessionRef.current) persist(sessionRef.current);
    }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  // ── AppState: save immediately on background, resync timer on foreground ──
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        if (sessionRef.current) persist(sessionRef.current);
      } else if (state === "active") {
        if (sessionRef.current) {
          setElapsedSeconds(
            Math.max(0, Math.floor((Date.now() - sessionRef.current.startedAt) / 1000))
          );
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
    await persist(null);
  }, []);

  return (
    <ActiveWorkoutContext.Provider
      value={{ session, elapsedSeconds, startSession, updateSet, updateNotes, finishSession }}
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
