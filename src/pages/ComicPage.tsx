import { useQuery } from '@tanstack/react-query'
import { Bell, Bookmark, ChevronRight, Download, Eye, Play, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { Comic } from '../../shared/contracts'
import { api } from '../lib/api'
import { filterChapters } from '../lib/catalog-utils'
import { formatChapterTimestamp } from '../lib/catalog-utils'
import { downloadManager } from '../lib/download-manager'
import { notifications } from '../lib/notifications'
import { LIBRARY_UPDATED_EVENT } from '../lib/library-events'
import { library } from '../lib/store'

export function ComicPage() {
  const { comicId = '' } = useParams()
  const location = useLocation()
  const navigationComic = (location.state as { comic?: Comic } | null)?.comic
  const comic = useQuery({
    queryKey: ['comic', comicId],
    queryFn: () => api.comic(comicId),
    initialData: navigationComic?.id === comicId ? navigationComic : undefined,
    initialDataUpdatedAt: navigationComic?.id === comicId
      ? Date.parse(navigationComic.updatedAt) || undefined
      : undefined,
    staleTime: 15 * 60_000,
  })
  const chapters = useQuery({
    queryKey: ['all-chapters', comicId],
    queryFn: () => api.allChapters(comicId),
    staleTime: 30 * 60_000,
  })
  const [favorite, setFavorite] = useState(false)
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof library.getProgress>>>(null)
  const [chapterWindow, setChapterWindow] = useState({ comicId, count: 20 })
  const [chapterSearch, setChapterSearch] = useState('')
  const [notificationStatus, setNotificationStatus] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => Promise.all([library.isFavorite(comicId), library.getProgress(comicId)])
      .then(([saved, latest]) => {
        if (!active) return
        setFavorite(saved)
        setProgress(latest)
      })
    void refresh()
    window.addEventListener(LIBRARY_UPDATED_EVENT, refresh)
    return () => {
      active = false
      window.removeEventListener(LIBRARY_UPDATED_EVENT, refresh)
    }
  }, [comicId])

  if (!comic.data) return <div className="detail-loading">Memuat detail...</div>
  const item = comic.data
  const availableChapters = chapters.data?.data ?? []
  const firstChapter = availableChapters.reduce(
    (earliest, chapter) => !earliest || chapter.number < earliest.number ? chapter : earliest,
    availableChapters[0],
  )
  const readingTarget = progress?.chapterId ?? firstChapter?.id
  const visibleChapterCount = chapterWindow.comicId === comicId ? chapterWindow.count : 20
  const visibleChapters = chapterSearch
    ? filterChapters(availableChapters, chapterSearch)
    : availableChapters.slice(0, visibleChapterCount)
  const remainingChapters = chapterSearch ? 0 : Math.max(0, availableChapters.length - visibleChapterCount)
  return (
    <article>
      <section className="detail-hero">
        <img
          src={api.image(item.bannerUrl ?? item.coverUrl)}
          alt=""
          className="detail-backdrop"
          decoding="async"
          fetchPriority="high"
        />
        <div className="detail-overlay" />
        <div className="detail-content">
          <img
            src={api.image(item.coverUrl)}
            alt={`Sampul ${item.title}`}
            className="detail-cover"
            decoding="async"
          />
          <div className="detail-copy">
            <span className="eyebrow">{item.country} · {item.genres.slice(0, 2).map((genre) => genre.name).join(' / ')}</span>
            <h1>{item.title}</h1>
            {item.genres.length > 0 && (
              <div className="detail-tags" aria-label="Genre komik">
                {item.genres.map((genre) => <span key={genre.slug}>{genre.name}</span>)}
              </div>
            )}
          </div>
          <p className="detail-description">{item.description || 'Belum ada sinopsis untuk komik ini.'}</p>
          <div className="detail-actions">
            {readingTarget ? (
              <Link className="primary-action" to={`/reader/${readingTarget}?comic=${item.id}`}>
                <Play size={18} /> {progress ? 'Lanjutkan' : 'Mulai baca'}
              </Link>
            ) : (
              <button className="primary-action" disabled>
                <Play size={18} /> {chapters.isPending ? 'Menyiapkan...' : 'Belum tersedia'}
              </button>
            )}
            <button className={favorite ? 'icon-action active' : 'icon-action'} aria-label="Favorit" onClick={async () => {
              const next = await library.toggleFavorite(item)
              setFavorite(next)
              notifications.followComic(item.id, next)
            }}><Bookmark size={20} fill={favorite ? 'currentColor' : 'none'} /></button>
            <button className="icon-action" aria-label="Aktifkan notifikasi" onClick={async () => {
              const result = await notifications.requestPermission()
              setNotificationStatus(result.message)
            }}><Bell size={20} /></button>
            {notificationStatus && <p className="comic-notification-status" role="status">{notificationStatus}</p>}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-heading chapter-heading">
          <div><span className="eyebrow">Daftar chapter</span><h2>Chapter terbaru</h2></div>
          <span className="chapter-count">{visibleChapters.length} dari {availableChapters.length}</span>
        </div>
        <label className="chapter-search">
          <Search size={19} aria-hidden="true" />
          <input
            value={chapterSearch}
            onChange={(event) => setChapterSearch(event.target.value)}
            placeholder="Cari nomor atau judul chapter..."
            aria-label="Cari chapter"
          />
        </label>
        {chapters.isPending && <p className="chapter-feedback">Memuat seluruh chapter...</p>}
        {chapterSearch && !visibleChapters.length && !chapters.isPending && (
          <p className="chapter-feedback">Chapter yang dicari tidak ditemukan.</p>
        )}
        <div className="chapter-list">
          {visibleChapters.map((chapter) => (
            <div className="chapter-row" key={chapter.id}>
              <Link className="chapter-link" to={`/reader/${chapter.id}?comic=${item.id}`}>
                <span className="chapter-number"><small>CH</small>{chapter.number}</span>
                <span className="chapter-copy">
                  <strong>{chapter.title || `Chapter ${chapter.number}`}</strong>
                  <small>
                    {new Date(chapter.releaseDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    <span aria-hidden="true"> · </span>
                    {formatChapterTimestamp(chapter.releaseDate)}
                    <span aria-hidden="true"> · </span>
                    <Eye size={13} aria-hidden="true" /> {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(chapter.views)}
                    {chapter.id === availableChapters[0]?.id && <em>Terbaru</em>}
                  </small>
                </span>
                <ChevronRight className="chapter-chevron" size={20} aria-hidden="true" />
              </Link>
              <button className="chapter-download" aria-label={`Unduh chapter ${chapter.number}`} onClick={async () => downloadManager.enqueue(item, await api.chapter(chapter.id))}><Download size={19} /></button>
            </div>
          ))}
        </div>
        {remainingChapters > 0 && (
          <button
            className="chapter-load-more"
            onClick={() => setChapterWindow({
              comicId,
              count: Math.min(availableChapters.length, visibleChapterCount + 20),
            })}
          >
            Tampilkan {Math.min(20, remainingChapters)} chapter lagi
          </button>
        )}
      </section>
    </article>
  )
}
