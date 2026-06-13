import { RefreshCw, WifiOff } from 'lucide-react'

export function LoadingGrid() {
  return <div className="comic-grid" aria-label="Memuat komik">{Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index} />)}</div>
}

export function StartupSkeleton() {
  return (
    <div className="startup-skeleton" aria-label="Menyiapkan koleksi" aria-busy="true">
      <header>
        <span className="startup-skeleton__brand" />
        <span className="startup-skeleton__avatar" />
      </header>
      <main>
        <section className="startup-skeleton__hero">
          <span />
          <strong />
          <strong />
          <i />
        </section>
        <section className="startup-skeleton__catalog">
          <div className="startup-skeleton__heading"><span /><i /></div>
          <LoadingGrid />
        </section>
      </main>
      <nav aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
      </nav>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <section className="section page-section profile-page profile-skeleton" aria-label="Memuat profil" aria-busy="true">
      <span className="skeleton-line skeleton-line--eyebrow" />
      <span className="skeleton-line skeleton-line--title" />
      <div className="profile-card">
        <span className="profile-skeleton__avatar" />
        <div>
          <span className="skeleton-line skeleton-line--name" />
          <span className="skeleton-line skeleton-line--email" />
        </div>
      </div>
      <div className="settings-list" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => <span className="profile-skeleton__setting" key={index} />)}
      </div>
    </section>
  )
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><WifiOff size={34} /><h2>{title}</h2><p>{message}</p></div>
}

export function ErrorState({ retry }: { retry: () => void }) {
  return <div className="empty-state"><h2>Belum berhasil dimuat</h2><p>Data tersimpan tetap bisa dibaca. Coba sambungkan kembali.</p><button onClick={retry}><RefreshCw size={17} /> Coba lagi</button></div>
}
