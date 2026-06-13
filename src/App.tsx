import { App as CapacitorApp } from '@capacitor/app'
import { Network } from '@capacitor/network'
import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Shell } from './components/Shell'
import { StartupSkeleton } from './components/States'
import { initializeLibrary } from './lib/store'
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
    })

    const warmRoutes = () => Promise.all([
      import('./pages/ComicPage'),
      import('./pages/DownloadsPage'),
      import('./pages/LibraryPage'),
      import('./pages/ProfilePage'),
      import('./pages/SearchPage'),
    ])
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const id = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(() => { void warmRoutes() }, { timeout: 1_000 })
      : window.setTimeout(() => { void warmRoutes() }, 250)
    return () => {
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
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

  useLayoutEffect(() => {
    if (location.pathname === '/' || location.pathname.startsWith('/comic/')) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0))
      const timer = window.setTimeout(() => window.scrollTo(0, 0), 80)
      return () => {
        window.cancelAnimationFrame(frame)
        window.clearTimeout(timer)
      }
    }
  }, [location.key, location.pathname])

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

  return <Suspense fallback={<StartupSkeleton />}><Routes>
      <Route element={<Shell />}>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
}
