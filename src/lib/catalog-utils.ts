import type { Chapter, Comic } from '../../shared/contracts'

export type UpdateAge = {
  label: string
  isNew: boolean
}

export type GenreFilterState = 'include' | 'exclude'

export function cycleGenreFilter(current?: GenreFilterState): GenreFilterState | undefined {
  if (!current) return 'include'
  if (current === 'include') return 'exclude'
  return undefined
}

export function filterComicsByGenres(
  comics: Comic[],
  filters: Record<string, GenreFilterState>,
) {
  const included = Object.entries(filters).filter(([, state]) => state === 'include').map(([slug]) => slug)
  const excluded = new Set(
    Object.entries(filters).filter(([, state]) => state === 'exclude').map(([slug]) => slug),
  )

  return comics.filter((comic) => {
    const genres = new Set(comic.genres.map((genre) => genre.slug))
    return included.every((slug) => genres.has(slug))
      && [...excluded].every((slug) => !genres.has(slug))
  })
}

export function collectGenres(comics: Comic[]) {
  const genres = new Map<string, Comic['genres'][number]>()
  for (const comic of comics) {
    for (const genre of comic.genres) genres.set(genre.slug, genre)
  }
  return [...genres.values()].sort((left, right) => left.name.localeCompare(right.name, 'id-ID'))
}

export function rankHotComics(comics: Comic[], limit = 12) {
  const unique = new Map(comics.map((comic) => [comic.id, comic]))
  return [...unique.values()]
    .sort((left, right) => (
      right.bookmarks - left.bookmarks
      || right.views - left.views
      || right.rating - left.rating
    ))
    .slice(0, Math.max(0, limit))
}

export function filterChapters(chapters: Chapter[], query: string, limit = 100) {
  const normalized = query.trim().toLocaleLowerCase('id-ID')
  if (!normalized) return chapters.slice(0, limit)

  const numericQuery = /^\d+(?:[.,]\d+)?$/.test(normalized)
    ? Number(normalized.replace(',', '.'))
    : null

  return chapters
    .filter((chapter) => (
      String(chapter.number).includes(normalized)
      || chapter.title.toLocaleLowerCase('id-ID').includes(normalized)
    ))
    .sort((left, right) => {
      const leftExact = numericQuery !== null && left.number === numericQuery
      const rightExact = numericQuery !== null && right.number === numericQuery
      if (leftExact !== rightExact) return leftExact ? -1 : 1
      return right.number - left.number
    })
    .slice(0, limit)
}

export function formatUpdateAge(timestamp: string | null, now = Date.now()): UpdateAge | null {
  if (!timestamp) return null
  const releasedAt = Date.parse(timestamp)
  if (!Number.isFinite(releasedAt)) return null

  const elapsed = Math.max(0, now - releasedAt)
  const hours = Math.floor(elapsed / 3_600_000)
  if (hours < 1) return { label: 'Baru', isNew: true }
  if (hours < 24) return { label: `${hours} jam`, isNew: false }

  const days = Math.floor(hours / 24)
  if (days < 30) return { label: `${days} hari`, isNew: false }
  const months = Math.floor(days / 30)
  if (months < 12) return { label: `${months} bln`, isNew: false }
  return { label: `${Math.floor(months / 12)} thn`, isNew: false }
}

export function formatChapterTimestamp(timestamp: string, now = Date.now()) {
  const releasedAt = Date.parse(timestamp)
  if (!Number.isFinite(releasedAt)) return '--'
  const elapsedMinutes = Math.floor(Math.max(0, now - releasedAt) / 60_000)
  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60
  if (hours === 0) return `${minutes} menit`
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days} hari ${hours % 24} jam`
  }
  return `${hours} jam ${String(minutes).padStart(2, '0')} menit`
}

export function buildPageItems(current: number, total: number) {
  if (total <= 0) return []

  const safeCurrent = Math.min(Math.max(current, 1), total)
  const pages = new Set([1, total, safeCurrent - 1, safeCurrent, safeCurrent + 1])
  const valid = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const result: Array<number | 'ellipsis'> = []
  for (const page of valid) {
    const previous = result.at(-1)
    if (typeof previous === 'number' && page - previous > 1) result.push('ellipsis')
    result.push(page)
  }
  return result
}
