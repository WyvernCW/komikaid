import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Check, ChevronDown, Flame, RotateCcw, Search, Tags } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ComicCard } from '../components/ComicCard'
import { CatalogPagination } from '../components/CatalogPagination'
import { EmptyState, ErrorState, LoadingGrid } from '../components/States'
import { api } from '../lib/api'
import {
  collectGenres,
  cycleGenreFilter,
  rankHotComics,
} from '../lib/catalog-utils'

export function SearchPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q')?.trim() ?? ''
  const urlPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const [input, setInput] = useState(urlQuery)
  const query = urlQuery
  const page = Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1
  const requestedHotPage = Number.parseInt(searchParams.get('hotPage') ?? '1', 10)
  const validRequestedHotPage = Number.isFinite(requestedHotPage) && requestedHotPage > 0
    ? requestedHotPage
    : 1
  const includedFromUrl = searchParams.get('include')?.split(',').filter(Boolean) ?? []
  const excludedFromUrl = searchParams.get('exclude')?.split(',').filter(Boolean) ?? []
  const genreFilters = Object.fromEntries([
    ...includedFromUrl.map((slug) => [slug, 'include' as const]),
    ...excludedFromUrl.map((slug) => [slug, 'exclude' as const]),
  ])
  const [genreOpen, setGenreOpen] = useState(false)
  const genreDropdown = useRef<HTMLDivElement>(null)
  const resultsStart = useRef<HTMLElement>(null)
  const hotComicsStart = useRef<HTMLElement>(null)
  const hasTextQuery = query.length >= 2
  const includedGenres = Object.entries(genreFilters)
    .filter(([, state]) => state === 'include')
    .map(([slug]) => slug)
  const excludedGenres = Object.entries(genreFilters)
    .filter(([, state]) => state === 'exclude')
    .map(([slug]) => slug)
  const hasGenreFilters = includedGenres.length + excludedGenres.length > 0
  const result = useQuery({
    queryKey: ['search', query, includedGenres, excludedGenres, page],
    queryFn: async () => {
      if (hasTextQuery) {
        const textResult = await api.search(query, page)
        if (!hasGenreFilters) return textResult
        const filtered = textResult.data.filter((comic) => {
          const genres = new Set(comic.genres.map((genre) => genre.slug))
          return includedGenres.every((genre) => genres.has(genre))
            && excludedGenres.every((genre) => !genres.has(genre))
        })
        return { ...textResult, data: filtered }
      }
      return api.filter(includedGenres, excludedGenres, page)
    },
    enabled: hasTextQuery || hasGenreFilters,
    placeholderData: (previous) => previous,
  })
  const discovery = useQuery({
    queryKey: ['search-discovery'],
    queryFn: async () => {
      const pages = await Promise.all([1, 2, 3].map((page) => api.comics(page)))
      return pages.flatMap((page) => page.data)
    },
    staleTime: 10 * 60_000,
  })
  const source = result.data?.data ?? []
  const genres = collectGenres([...(discovery.data ?? []), ...(result.data?.data ?? [])])
  const showResults = hasTextQuery || hasGenreFilters
  const isLoading = showResults ? result.isLoading : discovery.isLoading
  const activeGenres = genres.filter((genre) => genreFilters[genre.slug])
  const totalPages = Math.max(1, result.data?.meta.totalPages ?? 1)
  const filtered = source
  const hotPageSize = 12
  const rankedHotComics = rankHotComics(discovery.data ?? [], discovery.data?.length)
  const hotTotalPages = Math.max(1, Math.ceil(rankedHotComics.length / hotPageSize))
  const hotPage = Math.min(validRequestedHotPage, hotTotalPages)
  const hotComics = rankedHotComics.slice(
    (hotPage - 1) * hotPageSize,
    hotPage * hotPageSize,
  )
  const visibleComics = showResults ? filtered : hotComics
  const releases = useQuery({
    queryKey: ['latest-chapters', visibleComics.map((comic) => comic.id).join(',')],
    queryFn: () => api.latestChapters(visibleComics.map((comic) => comic.id)),
    enabled: visibleComics.length > 0,
    staleTime: 30 * 60_000,
  })

  useEffect(() => {
    if (showResults || hotPage >= hotTotalPages) return
    const nextComics = rankedHotComics.slice(hotPage * hotPageSize, (hotPage + 1) * hotPageSize)
    if (!nextComics.length) return
    const ids = nextComics.map((comic) => comic.id)
    const timer = window.setTimeout(() => {
      void queryClient.prefetchQuery({
        queryKey: ['latest-chapters', ids.join(',')],
        queryFn: () => api.latestChapters(ids),
        staleTime: 30 * 60_000,
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [hotPage, hotTotalPages, queryClient, rankedHotComics, showResults])

  useEffect(() => {
    const closeDropdown = (event: PointerEvent) => {
      if (!genreDropdown.current?.contains(event.target as Node)) setGenreOpen(false)
    }
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGenreOpen(false)
    }
    document.addEventListener('pointerdown', closeDropdown)
    window.addEventListener('keydown', closeWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeDropdown)
      window.removeEventListener('keydown', closeWithKeyboard)
    }
  }, [])

  const toggleGenre = (slug: string) => {
    const state = cycleGenreFilter(genreFilters[slug])
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      const included = new Set(next.get('include')?.split(',').filter(Boolean) ?? [])
      const excluded = new Set(next.get('exclude')?.split(',').filter(Boolean) ?? [])
      included.delete(slug)
      excluded.delete(slug)
      if (state === 'include') included.add(slug)
      if (state === 'exclude') excluded.add(slug)
      if (included.size) next.set('include', [...included].join(','))
      else next.delete('include')
      if (excluded.size) next.set('exclude', [...excluded].join(','))
      else next.delete('exclude')
      next.delete('page')
      return next
    })
  }

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage === 1) next.delete('page')
      else next.set('page', String(nextPage))
      return next
    })
    window.requestAnimationFrame(() => {
      window.setTimeout(() => resultsStart.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      }), 50)
    })
  }

  const goToHotPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > hotTotalPages || nextPage === hotPage) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage === 1) next.delete('hotPage')
      else next.set('hotPage', String(nextPage))
      return next
    })
    window.requestAnimationFrame(() => {
      window.setTimeout(() => hotComicsStart.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      }), 50)
    })
  }

  return (
    <section className="section page-section" ref={resultsStart}>
      <span className="eyebrow">Temukan cerita berikutnya</span><h1 className="page-title">Cari komik</h1>
      <form className="search-box" onSubmit={(event) => {
        event.preventDefault()
        setSearchParams((current) => {
          const next = new URLSearchParams(current)
          const value = input.trim()
          if (value) next.set('q', value)
          else next.delete('q')
          next.delete('page')
          return next
        })
      }}>
        <Search size={21} /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Judul komik..." aria-label="Judul komik" /><button type="submit">Cari</button>
      </form>
      <section className="genre-filter-panel" aria-label="Filter genre">
        <div className={`genre-dropdown${genreOpen ? ' is-open' : ''}`} ref={genreDropdown}>
          <button
            type="button"
            className="genre-dropdown__trigger"
            aria-expanded={genreOpen}
            aria-controls="genre-dropdown-menu"
            onClick={() => setGenreOpen((current) => !current)}
          >
            <Tags size={19} aria-hidden="true" />
            <span>
              <strong>Filter genre</strong>
              <small>{activeGenres.length ? `${activeGenres.length} filter aktif` : 'Semua genre'}</small>
            </span>
            <ChevronDown size={19} aria-hidden="true" />
          </button>
          {genreOpen && (
            <div className="genre-dropdown__menu" id="genre-dropdown-menu">
              <header>
                <p>Ketuk sekali untuk pilih, dua kali untuk blacklist.</p>
                {hasGenreFilters && (
                  <button type="button" onClick={() => {
                    setSearchParams((current) => {
                      const next = new URLSearchParams(current)
                      next.delete('include')
                      next.delete('exclude')
                      next.delete('page')
                      return next
                    })
                  }}>
                    <RotateCcw size={15} /> Reset
                  </button>
                )}
              </header>
              <div className="genre-dropdown__options">
                {genres.map((genre) => {
                  const state = genreFilters[genre.slug]
                  return (
                    <button
                      type="button"
                      key={genre.slug}
                      className={state ? `is-${state}` : ''}
                      onClick={() => toggleGenre(genre.slug)}
                      aria-label={`${genre.name}: ${state === 'include' ? 'dipilih' : state === 'exclude' ? 'diblokir' : 'netral'}`}
                    >
                      <span>{genre.name}</span>
                      <small>
                        {state === 'include' && <><Check size={14} /> Dipilih</>}
                        {state === 'exclude' && <><Ban size={14} /> Diblokir</>}
                        {!state && 'Netral'}
                      </small>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {activeGenres.length > 0 && (
          <div className="genre-filter-summary" aria-label="Filter genre aktif">
            {activeGenres.map((genre) => {
              const state = genreFilters[genre.slug]
              return (
                <button
                  type="button"
                  key={genre.slug}
                  className={`is-${state}`}
                  onClick={() => toggleGenre(genre.slug)}
                >
                  {state === 'include' ? <Check size={13} /> : <Ban size={13} />}
                  {genre.name}
                </button>
              )
            })}
          </div>
        )}
      </section>
      {isLoading ? <LoadingGrid /> : showResults && filtered.length ? (
        <>
          <div className="search-result-count">
            {hasTextQuery && !hasGenreFilters
              ? `${result.data?.meta.totalRecords ?? filtered.length} komik cocok`
              : `${result.data?.meta.totalRecords ?? filtered.length} komik cocok`}
          </div>
          <div className="comic-grid">{filtered.map((comic) => (
            <ComicCard key={comic.id} comic={comic} releases={releases.data?.[comic.id]} />
          ))}</div>
          <CatalogPagination page={page} totalPages={totalPages} onPageChange={goToPage} label="Halaman hasil pencarian" />
        </>
      ) : showResults ? (
        <EmptyState title="Tidak ditemukan" message="Coba judul lain atau longgarkan tag yang dipilih dan diblokir." />
      ) : discovery.isError ? (
        <ErrorState retry={() => discovery.refetch()} />
      ) : (
        <section
          className="search-discovery"
          aria-labelledby="hot-comics-title"
          ref={hotComicsStart}
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow"><Flame size={15} /> Sedang populer</span>
              <h2 id="hot-comics-title">Komik hot</h2>
            </div>
          </div>
          <div className="comic-grid">
            {hotComics.map((comic, index) => (
              <ComicCard
                key={comic.id}
                comic={comic}
                priority={index < 4}
                releases={releases.data?.[comic.id]}
              />
            ))}
          </div>
          <CatalogPagination
            page={hotPage}
            totalPages={hotTotalPages}
            onPageChange={goToHotPage}
            label="Halaman komik hot"
          />
        </section>
      )}
    </section>
  )
}
