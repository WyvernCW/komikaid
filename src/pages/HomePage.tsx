import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Flame } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Comic } from '../../shared/contracts'
import { ComicCard } from '../components/ComicCard'
import { CatalogPagination } from '../components/CatalogPagination'
import { ErrorState, LoadingGrid } from '../components/States'
import { api } from '../lib/api'
import { library } from '../lib/store'
import { useUiStore } from '../lib/ui-store'

export function HomePage() {
  const queryClient = useQueryClient()
  const online = useUiStore((state) => state.online)
  const [page, setPage] = useState(1)
  const catalogStart = useRef<HTMLElement>(null)
  const cachedQuery = useQuery({
    queryKey: ['cached-comics'],
    queryFn: () => library.getCachedComics(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const query = useQuery({
    queryKey: ['comics', page],
    queryFn: () => api.comics(page),
    placeholderData: (previous) => previous,
    enabled: online,
  })

  useEffect(() => {
    if (query.data?.data) {
      void library.cacheComics(query.data.data).then(() => {
        queryClient.setQueryData<Comic[]>(['cached-comics'], (current = []) => {
          const merged = new Map(current.map((comic) => [comic.id, comic]))
          for (const comic of query.data.data) merged.set(comic.id, comic)
          return [...merged.values()]
        })
      })
    }
  }, [query.data, queryClient])

  useEffect(() => {
    const nextPage = page + 1
    const totalPages = query.data?.meta.totalPages ?? 0
    if (!online || !totalPages || nextPage > totalPages) return
    const warmNextPage = async () => {
      const next = await queryClient.fetchQuery({
        queryKey: ['comics', nextPage],
        queryFn: () => api.comics(nextPage),
        staleTime: 15 * 60_000,
      })
      const ids = next.data.map((comic) => comic.id)
      await queryClient.prefetchQuery({
        queryKey: ['latest-chapters', ids.join(',')],
        queryFn: () => api.latestChapters(ids),
        staleTime: 30 * 60_000,
      })
    }
    const timer = window.setTimeout(() => { void warmNextPage() }, 250)
    return () => window.clearTimeout(timer)
  }, [online, page, query.data?.meta.totalPages, queryClient])

  const cached = cachedQuery.data ?? []
  const comics = query.data?.data ?? cached
  const releases = useQuery({
    queryKey: ['latest-chapters', comics.map((comic) => comic.id).join(',')],
    queryFn: () => api.latestChapters(comics.map((comic) => comic.id)),
    enabled: online && comics.length > 0,
    staleTime: 30 * 60_000,
  })
  const featured = comics[0]
  const totalPages = Math.max(1, query.data?.meta.totalPages ?? 1)
  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    setPage(nextPage)
    window.requestAnimationFrame(() => {
      window.setTimeout(() => catalogStart.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      }), 50)
    })
  }

  return (
    <>
      {featured && (
        <section className="hero-panel">
          <img
            src={api.image(featured.bannerUrl ?? featured.coverUrl)}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
          <div className="hero-shade" />
          <div className="hero-content">
            <span className="eyebrow"><Flame size={15} /> Pilihan hari ini</span>
            <h1>{featured.title}</h1>
            <p>{featured.description.slice(0, 150)}{featured.description.length > 150 ? '...' : ''}</p>
            <Link
              to={`/comic/${featured.id}`}
              state={{ comic: featured }}
              className="primary-action"
              onPointerDown={() => queryClient.setQueryData(['comic', featured.id], featured)}
              onClick={() => queryClient.setQueryData(['comic', featured.id], featured)}
            >
              Mulai baca <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}
      <section className="section" ref={catalogStart}>
        <div className="section-heading">
          <div><span className="eyebrow">Rilis terbaru</span><h2>Baru diperbarui</h2></div>
          {query.data?.stale && <span className="stale-chip">Data tersimpan</span>}
        </div>
        {(query.isLoading || cachedQuery.isLoading) && !comics.length ? <LoadingGrid /> : query.isError && !comics.length ? <ErrorState retry={() => query.refetch()} /> : (
          <div className="comic-grid">
            {comics.map((comic, index) => (
              <ComicCard
                key={comic.id}
                comic={comic}
                priority={index < 4}
                releases={releases.data?.[comic.id]}
              />
            ))}
          </div>
        )}
        <CatalogPagination page={page} totalPages={totalPages} onPageChange={goToPage} label="Halaman katalog" />
      </section>
    </>
  )
}
