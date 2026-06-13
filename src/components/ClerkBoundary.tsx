import { InternalClerkProvider as ClerkProvider } from '@clerk/react/internal'
import type { ReactNode } from 'react'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!publishableKey) throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required')

export function ClerkBoundary({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      __internal_clerkJSUrl={import.meta.env.VITE_CLERK_JS_URL
        || 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js'}
      proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  )
}
