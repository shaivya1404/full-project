import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider, WebSocketProvider } from './components';
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
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider />
      <WebSocketProvider />
      <AppRouter />
    </QueryClientProvider>
  );
}

export default App;
