import { Bell, BookOpen, Download, Home, Search, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useUiStore } from '../lib/ui-store'

const nav = [
  { to: '/', label: 'Beranda', icon: Home },
  { to: '/search', label: 'Cari', icon: Search },
  { to: '/library', label: 'Koleksi', icon: BookOpen },
  { to: '/downloads', label: 'Unduhan', icon: Download },
  { to: '/profile', label: 'Profil', icon: UserRound },
]

export function Shell() {
  const online = useUiStore((state) => state.online)
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="wordmark" aria-label="KomikaID beranda">
          <span>KOMIKA</span><b>ID</b>
        </NavLink>
        <div className="topbar-actions">
          {!online && <span className="offline-chip">Offline</span>}
          <NavLink to="/inbox" className="icon-button" aria-label="Notifikasi"><Bell size={20} /></NavLink>
          <NavLink to="/profile" className="avatar-fallback" aria-label="Profil"><UserRound size={19} /></NavLink>
        </div>
      </header>
      <main className="page"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navigasi utama">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
