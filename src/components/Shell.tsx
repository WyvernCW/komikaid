import { Bell, BookOpen, Download, Home, RefreshCw, Search, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useUiStore } from '../lib/ui-store'
<<<<<<< HEAD
=======
import { useEffect } from 'react'

const preloadAll = () => {
  void import('../pages/SearchPage')
  void import('../pages/LibraryPage')
  void import('../pages/DownloadsPage')
  void import('../pages/ProfilePage')
  void import('../pages/InboxPage')
  void import('../pages/ComicPage')
}
>>>>>>> 3e83d39 (some changes on mobile.)

const nav = [
  { to: '/', label: 'Beranda', icon: Home, preload: () => Promise.resolve() },
  { to: '/search', label: 'Cari', icon: Search, preload: () => import('../pages/SearchPage') },
  { to: '/library', label: 'Koleksi', icon: BookOpen, preload: () => import('../pages/LibraryPage') },
  { to: '/downloads', label: 'Unduhan', icon: Download, preload: () => import('../pages/DownloadsPage') },
  { to: '/profile', label: 'Profil', icon: UserRound, preload: () => import('../pages/ProfilePage') },
]

export function Shell() {
  const online = useUiStore((state) => state.online)
  const update = useUiStore((state) => state.availableUpdate)
  const setUpdateDialogOpen = useUiStore((state) => state.setUpdateDialogOpen)
<<<<<<< HEAD
=======
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: Function }).requestIdleCallback
    if (idle) idle(() => preloadAll(), { timeout: 500 })
    else setTimeout(preloadAll, 200)
  }, [])
>>>>>>> 3e83d39 (some changes on mobile.)
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="wordmark" aria-label="KomikaID beranda">
          <span>KOMIKA</span><b>ID</b>
        </NavLink>
        <div className="topbar-actions">
          {!online && <span className="offline-chip">Offline</span>}
          {update && (
            <button
              type="button"
              className="icon-button update-reminder"
              aria-label={`Pembaruan KomikaID versi ${update.version}`}
              onClick={() => setUpdateDialogOpen(true)}
            >
              <RefreshCw size={19} />
              <span />
            </button>
          )}
          <NavLink to="/inbox" className="icon-button" aria-label="Notifikasi"><Bell size={20} /></NavLink>
        </div>
      </header>
      <main className="page"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navigasi utama">
        {nav.map(({ to, label, icon: Icon, preload }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
            onPointerEnter={() => { void preload() }}
            onPointerDown={() => { void preload() }}
            onFocus={() => { void preload() }}
          >
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
