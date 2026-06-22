import { useCallback, useEffect, useRef, useState } from 'react';

type AsyncAction<TArgs extends unknown[]> = (...args: TArgs) => Promise<unknown> | unknown;

interface AsyncActionGuardOptions {
  delay?: number;
}

export function useAsyncActionGuard<TArgs extends unknown[]>(
  action: AsyncAction<TArgs>,
  options: AsyncActionGuardOptions = {},
) {
  const { delay = 500 } = options;
  const actionRef = useRef(action);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestArgsRef = useRef<TArgs | null>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const run = useCallback((...args: TArgs) => {
    if (runningRef.current) return;

    latestArgsRef.current = args;
    setIsDebouncing(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const latestArgs = latestArgsRef.current;
      timerRef.current = null;
      latestArgsRef.current = null;
      if (!mountedRef.current) return;
      setIsDebouncing(false);

      if (!latestArgs || runningRef.current) return;

      runningRef.current = true;
      setIsRunning(true);
      try {
        await actionRef.current(...latestArgs);
      } finally {
        if (mountedRef.current) {
          runningRef.current = false;
          setIsRunning(false);
        }
      }
    }, delay);
  }, [delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    latestArgsRef.current = null;
    setIsDebouncing(false);
  }, []);

  return {
    run,
    cancel,
    isDebouncing,
    isRunning,
    isBusy: isDebouncing || isRunning,
  };
}

export function useConcurrentGuard<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<unknown> | unknown,
) {
  const actionRef = useRef(action);
  const runningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const run = useCallback((...args: TArgs) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    Promise.resolve(actionRef.current(...args)).finally(() => {
      runningRef.current = false;
      setIsRunning(false);
    });
  }, []);

  return { run, isRunning, isBusy: isRunning };
}

export function useDebouncedAddItem(delay: number = 300) {
  const queueRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onFlushRef = useRef<((items: [string, number][]) => void) | null>(null);
  const runningIdsRef = useRef<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flush = useCallback(() => {
    if (queueRef.current.size === 0) return;
    const snapshot = Array.from(queueRef.current.entries());
    queueRef.current.clear();
    setPendingIds(new Set());
    timerRef.current = undefined;
    if (onFlushRef.current) onFlushRef.current(snapshot);
  }, []);

  const add = useCallback(
    (itemId: string) => {
      if (runningIdsRef.current.has(itemId)) return;

      queueRef.current.set(itemId, (queueRef.current.get(itemId) || 0) + 1);
      setPendingIds(new Set(queueRef.current.keys()));

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  const onFlush = useCallback((handler: (items: [string, number][]) => void) => {
    onFlushRef.current = handler;
  }, []);

  const markRunning = useCallback((itemId: string) => {
    runningIdsRef.current.add(itemId);
    setRunningIds(new Set(runningIdsRef.current));
  }, []);

  const markComplete = useCallback((itemId: string) => {
    runningIdsRef.current.delete(itemId);
    setRunningIds(new Set(runningIdsRef.current));
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = undefined;
    queueRef.current.clear();
    setPendingIds(new Set());
  }, []);

  return { add, onFlush, cancel, flush, pendingIds, runningIds, markRunning, markComplete };
}
