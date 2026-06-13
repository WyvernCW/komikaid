import { BookOpen, ChevronRight, Clock3, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Comic, ReadingHistoryItem, ReadingProgress } from '../../shared/contracts'
import { ComicCard } from '../components/ComicCard'
import { EmptyState } from '../components/States'
import { LIBRARY_UPDATED_EVENT } from '../lib/library-events'
import { library } from '../lib/store'
import { api } from '../lib/api'

export function LibraryPage() {
  const [favorites, setFavorites] = useState<Comic[]>([])
  const [history, setHistory] = useState<ReadingHistoryItem[]>([])
  const [selected, setSelected] = useState<ReadingHistoryItem | null>(null)
  const [chapterHistory, setChapterHistory] = useState<ReadingProgress[]>([])

  useEffect(() => {
    let active = true
    const refresh = () => Promise.all([library.getFavorites(), library.getReadingHistory()]).then(([saved, read]) => {
      if (!active) return
      setFavorites(saved)
      setHistory(read)
    })
    void refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener(LIBRARY_UPDATED_EVENT, refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      window.removeEventListener(LIBRARY_UPDATED_EVENT, refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])

  const openHistory = async (item: ReadingHistoryItem) => {
    setSelected(item)
    setChapterHistory([item.progress])
    setChapterHistory(await library.getChapterHistory(item.comic.id))
  }

  const historyIds = new Set(history.map((item) => item.comic.id))
  const favoriteOnly = favorites.filter((comic) => !historyIds.has(comic.id))
  const libraryComics = [...history.map((item) => item.comic), ...favoriteOnly]
  const releases = useQuery({
    queryKey: ['latest-chapters', libraryComics.map((comic) => comic.id).join(',')],
    queryFn: () => api.latestChapters(libraryComics.map((comic) => comic.id)),
    enabled: libraryComics.length > 0,
    staleTime: 30 * 60_000,
  })

  return (
    <section className="section page-section">
      <span className="eyebrow">Tersimpan di perangkat</span>
      <h1 className="page-title">Koleksi saya</h1>
      {history.length > 0 && (
        <section className="library-group" aria-labelledby="reading-history-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Lanjut membaca</span>
              <h2 id="reading-history-title">Riwayat baca</h2>
            </div>
          </div>
          <div className="comic-grid">
            {history.map((item) => (
              <ComicCard
                key={item.comic.id}
                comic={item.comic}
                progress={item.progress}
                onClick={() => openHistory(item)}
                releases={releases.data?.[item.comic.id]}
              />
            ))}
          </div>
        </section>
      )}
      {favoriteOnly.length > 0 && (
        <section className="library-group" aria-labelledby="favorite-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Favorit</span>
              <h2 id="favorite-title">Disimpan</h2>
            </div>
          </div>
          <div className="comic-grid">
            {favoriteOnly.map((comic) => (
              <ComicCard key={comic.id} comic={comic} releases={releases.data?.[comic.id]} />
            ))}
          </div>
        </section>
      )}
      {!history.length && !favorites.length && (
        <EmptyState
          title="Koleksi masih kosong"
          message="Komik yang mulai dibaca atau disimpan sebagai favorit akan muncul di sini."
        />
      )}
      {selected && (
        <div className="library-sheet-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <section
            className="library-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chapter-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="library-sheet__header">
              <div>
                <span className="eyebrow"><BookOpen size={15} /> Sudah dibaca</span>
                <Link
                  to={`/comic/${selected.comic.id}`}
                  state={{ comic: selected.comic }}
                  className="library-sheet__title"
                  onClick={() => setSelected(null)}
                >
                  <h2 id="chapter-history-title">{selected.comic.title}</h2>
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Tutup daftar chapter">
                <X size={20} />
              </button>
            </header>
            <div className="library-sheet__chapters">
              {chapterHistory.map((progress, index) => (
                <Link
                  key={progress.chapterId}
                  to={`/reader/${progress.chapterId}?comic=${selected.comic.id}`}
                  onClick={() => setSelected(null)}
                >
                  <span className="chapter-number"><small>CH</small>{progress.chapterNumber}</span>
                  <span>
                    <strong>Chapter {progress.chapterNumber}</strong>
                    <small>
                      <Clock3 size={13} />
                      Halaman {progress.pageIndex + 1} dari {progress.pageCount}
                      {index === 0 && <em>Terakhir</em>}
                    </small>
                  </span>
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
