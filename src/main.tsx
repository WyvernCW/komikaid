import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import AccountServices from './components/AccountServices'
import UpdateServices from './components/UpdateServices'
import { ClerkBoundary } from './components/ClerkBoundary'
import { ApiError } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => (
        !(error instanceof ApiError && error.status >= 400 && error.status < 500)
        && failureCount < 2
      ),
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
      staleTime: 15 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ClerkBoundary>
          <App />
          <AccountServices />
          <UpdateServices />
        </ClerkBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
