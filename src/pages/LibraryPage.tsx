import { BookOpen, ChevronRight, Clock3, Trash2, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Comic, ReadingHistoryItem, ReadingProgress } from '../../shared/contracts'
import { CatalogPagination } from '../components/CatalogPagination'
import { ComicCard } from '../components/ComicCard'
import { EmptyState, LoadingGrid } from '../components/States'
import { LIBRARY_UPDATED_EVENT } from '../lib/library-events'
import { library } from '../lib/store'
import { api } from '../lib/api'

const PAGE_SIZE = 20

export function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const collectionStart = useRef<HTMLElement>(null)
  const [favorites, setFavorites] = useState<Comic[]>([])
  const [history, setHistory] = useState<ReadingHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<ReadingHistoryItem | null>(null)
  const [chapterHistory, setChapterHistory] = useState<ReadingProgress[]>([])

  useEffect(() => {
    let active = true
    const refresh = () => Promise.all([library.getFavorites(), library.getReadingHistory()])
      .then(([saved, read]) => {
        if (!active) return
        setFavorites(saved)
        setHistory(read)
      })
      .finally(() => {
        if (active) setIsLoading(false)
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
  const collection = [
    ...history.map((item) => ({ kind: 'history' as const, item, comic: item.comic })),
    ...favoriteOnly.map((comic) => ({ kind: 'favorite' as const, comic })),
  ]
  const totalPages = Math.max(1, Math.ceil(collection.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleCollection = collection.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const visibleHistory = visibleCollection.filter((entry) => entry.kind === 'history')
  const visibleFavorites = visibleCollection.filter((entry) => entry.kind === 'favorite')
  const libraryComics = visibleCollection.map((entry) => entry.comic)
  const releases = useQuery({
    queryKey: ['latest-chapters', libraryComics.map((comic) => comic.id).join(',')],
    queryFn: () => api.latestChapters(libraryComics.map((comic) => comic.id)),
    enabled: libraryComics.length > 0,
    staleTime: 30 * 60_000,
  })
  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) return
    setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) })
    window.requestAnimationFrame(() => {
      window.setTimeout(() => collectionStart.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      }), 50)
    })
  }

  return (
    <section className="section page-section" ref={collectionStart}>
      <span className="eyebrow">Tersimpan di perangkat</span>
      <h1 className="page-title">Koleksi saya</h1>
      {isLoading && (
        <section className="library-group" aria-label="Memuat koleksi" aria-busy="true">
          <LoadingGrid />
        </section>
      )}
      {!isLoading && visibleHistory.length > 0 && (
        <section className="library-group" aria-labelledby="reading-history-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Lanjut membaca</span>
              <h2 id="reading-history-title">Riwayat baca</h2>
            </div>
          </div>
          <div className="comic-grid">
            {visibleHistory.map(({ item }) => (
              <ComicCard
                key={item.comic.id}
                comic={item.comic}
                onClick={() => openHistory(item)}
                releases={releases.data?.[item.comic.id]}
              />
            ))}
          </div>
        </section>
      )}
      {!isLoading && visibleFavorites.length > 0 && (
        <section className="library-group" aria-labelledby="favorite-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Favorit</span>
              <h2 id="favorite-title">Disimpan</h2>
            </div>
          </div>
          <div className="comic-grid">
            {visibleFavorites.map(({ comic }) => (
              <ComicCard key={comic.id} comic={comic} releases={releases.data?.[comic.id]} />
            ))}
          </div>
        </section>
      )}
      {!isLoading && !history.length && !favorites.length && (
        <EmptyState
          title="Koleksi masih kosong"
          message="Komik yang mulai dibaca atau disimpan sebagai favorit akan muncul di sini."
        />
      )}
      {!isLoading && collection.length > PAGE_SIZE && (
        <CatalogPagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={goToPage}
          label="Halaman koleksi"
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
            <button
              type="button"
              className="library-sheet__clear"
              onClick={async () => {
                await library.removeReadingHistory(selected.comic.id)
                setHistory((current) => current.filter((item) => item.comic.id !== selected.comic.id))
                setSelected(null)
              }}
            >
              <Trash2 size={17} /> Hapus riwayat baca
            </button>
          </section>
        </div>
      )}
    </section>
  )
}
