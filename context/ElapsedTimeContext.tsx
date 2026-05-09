import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useActiveWorkoutSession } from "./ActiveWorkoutSessionContext";

interface ElapsedTimeContextValue {
  elapsedSeconds: number;
}

const ElapsedTimeContext = createContext<ElapsedTimeContextValue | undefined>(undefined);

/**
 * Ticks every 1 second while a workout session is active.
 * Must be rendered *inside* `ActiveWorkoutSessionProvider`.
 *
 * Only components that call `useElapsedSeconds()` re-render on each tick.
 * All other session-state consumers are unaffected.
 */
export function ElapsedTimeProvider({ children }: { children: ReactNode }) {
  const { session } = useActiveWorkoutSession();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!session) {
      setElapsedSeconds(0);
      return;
    }
    const { startedAt } = session;
    const tick = () =>
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // Re-run only when session identity or start time changes, not on every session mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId, session?.startedAt]);

  const value = useMemo(() => ({ elapsedSeconds }), [elapsedSeconds]);

  return (
    <ElapsedTimeContext.Provider value={value}>
      {children}
    </ElapsedTimeContext.Provider>
  );
}

/** Returns the live elapsed workout seconds. Re-renders at ~1 Hz while a session is active. */
export function useElapsedSeconds(): number {
  const ctx = useContext(ElapsedTimeContext);
  if (!ctx) throw new Error("useElapsedSeconds must be used within ElapsedTimeProvider");
  return ctx.elapsedSeconds;
}

/** Formatted mm:ss string. Thin wrapper — only opt into this if you need the string. */
export function useElapsedFormatted(): string {
  const seconds = useElapsedSeconds();
  return useMemo(() => {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }, [seconds]);
}
