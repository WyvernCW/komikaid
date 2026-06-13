import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { ClerkBoundary } from '../components/ClerkBoundary'

export function SsoCallbackPage() {
  return (
    <ClerkBoundary>
      <div className="reader-loading" aria-live="polite">
        <AuthenticateWithRedirectCallback />
      </div>
    </ClerkBoundary>
  )
}
