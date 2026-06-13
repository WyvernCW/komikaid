import { useAuth } from '@clerk/react'
import { useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { reconcileAccount } from '../lib/account-sync'
import { LIBRARY_CHANGED_EVENT } from '../lib/library-events'
import { notifications } from '../lib/notifications'
import { initializeLibrary } from '../lib/store'

let automaticSyncRetryAt = 0

export default function AccountServices() {
  const { getToken, isLoaded, userId } = useAuth()

  useEffect(() => {
    if (!isLoaded) return
    void notifications.initialize(userId ?? null)
  }, [isLoaded, userId])

  useEffect(() => {
    if (!isLoaded || !userId) return
    automaticSyncRetryAt = 0
    let active = true
    let syncing = false
    let debounceTimer: number | undefined
    const sync = async () => {
      if (syncing || !navigator.onLine || Date.now() < automaticSyncRetryAt) return
      syncing = true
      try {
        await initializeLibrary()
        const token = await getToken()
        if (!token || !active) return
        await reconcileAccount(token)
      } catch {
        automaticSyncRetryAt = Date.now() + 5 * 60_000
      } finally {
        syncing = false
      }
    }
    void sync()
    const interval = window.setInterval(sync, 60_000)
    const resume = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void sync()
    })
    const syncSoon = () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(sync, 2_000)
    }
    window.addEventListener('online', sync)
    window.addEventListener(LIBRARY_CHANGED_EVENT, syncSoon)
    return () => {
      active = false
      window.clearInterval(interval)
      window.clearTimeout(debounceTimer)
      window.removeEventListener('online', sync)
      window.removeEventListener(LIBRARY_CHANGED_EVENT, syncSoon)
      void resume.then((handle) => handle.remove())
    }
  }, [getToken, isLoaded, userId])

  return null
}
