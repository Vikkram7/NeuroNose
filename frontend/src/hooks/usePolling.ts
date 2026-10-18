import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePollingOptions {
  interval?: number; // interval in milliseconds, default 2000
  enabled?: boolean;  // whether polling is currently active
  immediate?: boolean; // whether to run immediately upon mount/enable
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  options: UsePollingOptions = {}
) {
  const { interval = 2000, enabled = true, immediate = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(enabled);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Keep latest callback in a ref to avoid resetting timer
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const execute = useCallback(async () => {
    try {
      const result = await fetchFnRef.current();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update polling state when prop changes
  useEffect(() => {
    setIsPolling(enabled);
  }, [enabled]);

  // Handle polling timer
  useEffect(() => {
    if (!isPolling) return;

    if (immediate) {
      execute();
    }

    const timer = setInterval(() => {
      execute();
    }, interval);

    return () => clearInterval(timer);
  }, [isPolling, interval, immediate, execute]);

  const pause = useCallback(() => setIsPolling(false), []);
  const resume = useCallback(() => setIsPolling(true), []);
  const refresh = useCallback(() => execute(), [execute]);

  return {
    data,
    isLoading,
    error,
    isPolling,
    pause,
    resume,
    refresh,
    lastUpdated,
  };
}
