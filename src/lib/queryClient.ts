import { QueryClient } from '@tanstack/react-query'

/**
 * アプリ単位の QueryClient（main で Provider に渡す）
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
