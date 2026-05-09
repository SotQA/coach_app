import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/utils/logger";

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Fetch data on mount and when deps change. Cancels safely on unmount.
 *
 * - `loading` is true on the first fetch and on every reload.
 * - `data` retains its previous value during a reload (so the UI doesn't blank).
 * - `error` is cleared at the start of every fetch.
 *
 * Pass a stable fetcher (define inside useCallback if it depends on props).
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList
): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Bumped to force a refetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Track active fetch to ignore stale results after unmount or re-fetch.
  const activeRef = useRef(0);

  useEffect(() => {
    const myToken = ++activeRef.current;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (activeRef.current !== myToken) return;
        setData(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (activeRef.current !== myToken) return;
        const err = e instanceof Error ? e : new Error(String(e));
        logger.error("[useAsyncData] fetch failed", err);
        setError(err);
        setLoading(false);
      });

    return () => {
      // Mark all in-flight fetches as stale.
      activeRef.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { data, loading, error, reload };
}
