import { App as CapacitorApp } from '@capacitor/app'
import { Network } from '@capacitor/network'
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
<<<<<<< HEAD
=======
import { ErrorBoundary } from './components/ErrorBoundary'
>>>>>>> 3e83d39 (some changes on mobile.)
import { Shell } from './components/Shell'
import { ScrollRestoration } from './components/ScrollRestoration'
import { StartupSkeleton } from './components/States'
import { initializeLibrary } from './lib/store'
import { downloadManager } from './lib/download-manager'
import { useUiStore } from './lib/ui-store'
import { HomePage } from './pages/HomePage'

const ComicPage = lazy(() => import('./pages/ComicPage').then((module) => ({ default: module.ComicPage })))
const DownloadsPage = lazy(() => import('./pages/DownloadsPage').then((module) => ({ default: module.DownloadsPage })))
const InboxPage = lazy(() => import('./pages/InboxPage').then((module) => ({ default: module.InboxPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const ReaderPage = lazy(() => import('./pages/ReaderPage').then((module) => ({ default: module.ReaderPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })))
const SsoCallbackPage = lazy(() => import('./pages/SsoCallbackPage').then((module) => ({ default: module.SsoCallbackPage })))

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const setOnline = useUiStore((state) => state.setOnline)
  useEffect(() => {
    void initializeLibrary().catch((error) => {
      console.error('Local library initialization failed', error)
    }).then(() => {
      void downloadManager.initialize()
    })

  }, [])

  useEffect(() => {
    const deepLink = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      const parsed = new URL(url)
      navigate(`${parsed.pathname}${parsed.search}`)
    })

    let networkHandle: { remove(): Promise<void> } | undefined
    let cancelled = false
    const startBackgroundServices = async () => {
      const status = await Network.getStatus()
      if (cancelled) return
      setOnline(status.connected)
      networkHandle = await Network.addListener('networkStatusChange', (next) => setOnline(next.connected))
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idleId = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(() => { void startBackgroundServices() }, { timeout: 1_500 })
      : window.setTimeout(() => { void startBackgroundServices() }, 500)

    return () => {
      cancelled = true
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
      void networkHandle?.remove()
      deepLink.then((handle) => handle.remove())
    }
  }, [navigate, setOnline])

  useEffect(() => {
    const backButton = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1)
        return
      }
      if (location.pathname.startsWith('/reader/')) {
        const comicId = new URLSearchParams(location.search).get('comic')
        navigate(comicId ? `/comic/${comicId}` : '/', { replace: true })
      } else if (location.pathname !== '/') {
        navigate('/', { replace: true })
      }
    })
    return () => { void backButton.then((handle) => handle.remove()) }
  }, [location.pathname, location.search, navigate])

  return <Suspense fallback={<StartupSkeleton />}><ScrollRestoration /><Routes>
      <Route element={<Shell />}>
<<<<<<< HEAD
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="comic/:comicId" element={<ComicPage />} />
      </Route>
      <Route path="sso-callback" element={<SsoCallbackPage />} />
      <Route path="reader/:chapterId" element={<ReaderPage />} />
=======
        <Route index element={<ErrorBoundary name="Home"><HomePage /></ErrorBoundary>} />
        <Route path="search" element={<ErrorBoundary name="Search"><SearchPage /></ErrorBoundary>} />
        <Route path="library" element={<ErrorBoundary name="Library"><LibraryPage /></ErrorBoundary>} />
        <Route path="downloads" element={<ErrorBoundary name="Downloads"><DownloadsPage /></ErrorBoundary>} />
        <Route path="profile" element={<ErrorBoundary name="Profile"><ProfilePage /></ErrorBoundary>} />
        <Route path="inbox" element={<ErrorBoundary name="Inbox"><InboxPage /></ErrorBoundary>} />
        <Route path="comic/:comicId" element={<ErrorBoundary name="Comic"><ComicPage /></ErrorBoundary>} />
      </Route>
      <Route path="sso-callback" element={<ErrorBoundary name="SSO"><SsoCallbackPage /></ErrorBoundary>} />
      <Route path="reader/:chapterId" element={<ErrorBoundary name="Reader"><ReaderPage /></ErrorBoundary>} />
>>>>>>> 3e83d39 (some changes on mobile.)
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
}
