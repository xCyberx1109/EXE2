import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient configuration with sensible defaults:
 *
 * staleTime: 30s for most data - avoids refetching on component remount
 *   while keeping data reasonably fresh. Longer for stable data like categories (5min).
 *
 * gcTime: 5min - keeps cache entries for 5 minutes after they become unused,
 *   preventing unnecessary refetches when navigating back to a page.
 *
 * retry: 2 - retries failed queries twice (on top of the apiFetch 1 retry).
 *   Total max 3 attempts per query.
 *
 * refetchOnWindowFocus: true - keeps data fresh when user switches back to tab.
 *
 * refetchOnReconnect: true - refreshes data when network comes back.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
