import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { ToastProvider } from './components';
import { AppRouter } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

function App() {
  const restoreFromCookie = useAuthStore((state) => state.restoreFromCookie);

  // Restore auth state from cookies on app load
  useEffect(() => {
    restoreFromCookie();
  }, [restoreFromCookie]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider />
      <AppRouter />
    </QueryClientProvider>
  );
}

export default App;
