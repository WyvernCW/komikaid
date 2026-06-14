import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import {
  chapterDetailSchema,
  chapterListSchema,
  comicListSchema,
  comicSchema,
  type Chapter,
  type ChapterDetail,
  type ChapterList,
  type Comic,
  type ComicList,
} from '../shared/contracts.js'

const API_BASE = 'https://api.shngm.io/v1'
const CACHE_DIR = process.env.VERCEL
  ? path.join(tmpdir(), 'komikaid-api-cache')
  : path.join(process.cwd(), '.cache', 'api')
const uuidSchema = z.string().uuid()

const upstreamEnvelope = z.object({
  retcode: z.number(),
  message: z.string(),
  meta: z.object({
    page: z.number().optional(),
    page_size: z.number().optional(),
    total_page: z.number().optional(),
    total_record: z.number().optional(),
  }).passthrough(),
  data: z.unknown(),
})
type UpstreamMeta = z.infer<typeof upstreamEnvelope>['meta']

const upstreamComic = z.object({
  manga_id: uuidSchema,
  title: z.string(),
  alternative_title: z.string().nullish(),
  description: z.string().nullish(),
  cover_image_url: z.string().url(),
  cover_portrait_url: z.union([z.string().url(), z.literal('')]).nullish(),
  latest_chapter_id: z.string().nullish(),
  latest_chapter_number: z.coerce.number().nullish(),
  latest_chapter_time: z.string().nullish(),
  status: z.number().default(0),
  country_id: z.string().default(''),
  user_rate: z.coerce.number().default(0),
  view_count: z.coerce.number().default(0),
  bookmark_count: z.coerce.number().default(0),
  taxonomy: z.record(z.string(), z.array(z.object({
    name: z.string(),
    slug: z.string(),
  }).passthrough())).default({}),
  updated_at: z.string(),
})

const upstreamChapter = z.object({
  chapter_id: uuidSchema,
  manga_id: uuidSchema,
  chapter_number: z.coerce.number(),
  chapter_title: z.string().nullish(),
  release_date: z.string(),
  view_count: z.coerce.number().default(0),
})

const upstreamChapterDetail = upstreamChapter.extend({
  base_url: z.string().url(),
  chapter: z.object({
    path: z.string().regex(/^\/chapter\/[a-zA-Z0-9_/-]+\/$/),
    data: z.array(z.string().regex(/^[a-zA-Z0-9_.-]+$/)),
  }),
  prev_chapter_id: uuidSchema.nullish(),
  next_chapter_id: uuidSchema.nullish(),
})

export interface ComicProvider {
  list(options: { page: number; pageSize: number; query?: string; sort?: string; genre?: string }): Promise<ComicList>
  filteredList(options: {
    page: number
    pageSize: number
    includedGenres: string[]
    excludedGenres: string[]
  }): Promise<ComicList>
  detail(comicId: string): Promise<Comic>
  chapters(comicId: string, page: number, pageSize: number): Promise<ChapterList>
  allChapters(comicId: string): Promise<ChapterList>
  firstChapter(comicId: string): Promise<Chapter | null>
  chapter(chapterId: string): Promise<ChapterDetail>
}

export async function collectAllChapters(
  loadPage: (page: number, pageSize: number) => Promise<ChapterList>,
  pageSize = 100,
  maxPages = 50,
) {
  const first = await loadPage(1, pageSize)
  const totalPages = Math.max(first.meta.totalPages, first.data.length ? 1 : 0)
  if (totalPages > maxPages) {
    throw new Error(`Chapter list exceeded the ${maxPages * pageSize} item lookup limit`)
  }

  const pages: ChapterList[] = [first]
  for (let start = 2; start <= totalPages; start += 4) {
    const batch = Array.from(
      { length: Math.min(4, totalPages - start + 1) },
      (_, index) => loadPage(start + index, pageSize),
    )
    pages.push(...await Promise.all(batch))
  }

  const chapters = Array.from(
    new Map(pages.flatMap((page) => page.data).map((chapter) => [chapter.id, chapter])).values(),
  ).sort((a, b) => b.number - a.number)

  return chapterListSchema.parse({
    data: chapters,
    meta: {
      page: 1,
      pageSize: chapters.length || pageSize,
      totalPages: chapters.length ? 1 : 0,
      totalRecords: chapters.length,
    },
    stale: pages.some((page) => page.stale),
  })
}

export async function findEarliestChapter(
  loadPage: (page: number, pageSize: number) => Promise<ChapterList>,
  pageSize = 100,
  maxPages = 20,
) {
  const result = await collectAllChapters(loadPage, pageSize, maxPages)
  return result.data.reduce<Chapter | null>(
    (earliest, chapter) => !earliest || chapter.number < earliest.number ? chapter : earliest,
    null,
  )
}

type CacheEntry = { timestamp: number; data: unknown; meta?: UpstreamMeta }
const memoryCache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<{ data: unknown; meta: UpstreamMeta; stale: boolean }>>()
const MAX_MEMORY_CACHE_ENTRIES = 300
const cachePath = (key: string) =>
  path.join(CACHE_DIR, createHash('sha256').update(`v2:${key}`).digest('hex') + '.json')
const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const normalizeComic = (value: z.infer<typeof upstreamComic>): Comic =>
  comicSchema.parse({
    id: value.manga_id,
    title: value.title,
    alternativeTitle: value.alternative_title ?? '',
    description: value.description ?? '',
    coverUrl: value.cover_image_url,
    bannerUrl: value.cover_portrait_url || null,
    latestChapterId: uuidSchema.safeParse(value.latest_chapter_id).success
      ? value.latest_chapter_id
      : null,
    latestChapterNumber: value.latest_chapter_number ?? null,
    latestChapterTime: value.latest_chapter_time ?? null,
    status: value.status,
    country: value.country_id,
    rating: value.user_rate,
    views: value.view_count,
    bookmarks: value.bookmark_count,
    genres: value.taxonomy.Genre ?? [],
    updatedAt: value.updated_at,
  })

async function readCache(key: string): Promise<CacheEntry | null> {
  const memoryEntry = memoryCache.get(key)
  if (memoryEntry) {
    memoryCache.delete(key)
    memoryCache.set(key, memoryEntry)
    return memoryEntry
  }
  try {
    const entry = JSON.parse(await readFile(cachePath(key), 'utf8')) as CacheEntry
    memoryCache.set(key, entry)
    return entry
  } catch {
    return null
  }
}

async function writeCache(key: string, data: unknown, meta: UpstreamMeta) {
  memoryCache.delete(key)
  memoryCache.set(key, { timestamp: Date.now(), data, meta })
  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value
    if (!oldestKey) break
    memoryCache.delete(oldestKey)
  }
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(cachePath(key), JSON.stringify({ timestamp: Date.now(), data, meta }), 'utf8')
}

async function request(pathname: string, ttl: number): Promise<{ data: unknown; meta: UpstreamMeta; stale: boolean }> {
  if (!/^(manga\/list|manga\/detail\/[0-9a-f-]{36}|chapter\/[0-9a-f-]{36}\/list|chapter\/detail\/[0-9a-f-]{36})(\?.*)?$/i.test(pathname)) {
    throw new Error('Blocked upstream path')
  }

  const url = `${API_BASE}/${pathname}`
  const cached = await readCache(url)
  if (cached && cached.meta && Date.now() - cached.timestamp < ttl) {
    return { data: cached.data, meta: cached.meta, stale: false }
  }

  const existingRequest = inFlightRequests.get(url)
  if (existingRequest) return existingRequest

  const upstreamRequest = requestUpstream(url, cached)
  inFlightRequests.set(url, upstreamRequest)
  try {
    return await upstreamRequest
  } finally {
    inFlightRequests.delete(url)
  }
}

async function requestUpstream(
  url: string,
  cached: CacheEntry | null,
): Promise<{ data: unknown; meta: UpstreamMeta; stale: boolean }> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Referer: 'https://shinigami.id/',
          'User-Agent': 'KomikaID/1.0',
          'X-Request-ID': randomUUID(),
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (response.status === 429 || response.status >= 500) throw new Error(`Upstream unavailable (${response.status})`)
      if (!response.ok) {
        throw Object.assign(new Error(`Upstream rejected request (${response.status})`), { status: response.status })
      }
      const parsed = upstreamEnvelope.parse(await response.json())
      await writeCache(url, parsed.data, parsed.meta)
      return { data: parsed.data, meta: parsed.meta, stale: false }
    } catch (error) {
      lastError = error
      if (attempt < 2) await sleep(500 * 2 ** attempt)
    }
  }

  if (cached?.meta) return { data: cached.data, meta: cached.meta, stale: true }
  throw lastError instanceof Error ? lastError : new Error('Upstream request failed')
}

export class ShinigamiProvider implements ComicProvider {
  async list({ page, pageSize, query, sort, genre }: {
    page: number
    pageSize: number
    query?: string
    sort?: string
    genre?: string
  }) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (query) params.set('q', query)
    if (sort) params.set('sort', sort)
    if (genre) params.set('genre', genre)
    const result = await request(`manga/list?${params}`, 5 * 60_000)
    const data = z.array(upstreamComic).parse(result.data).map(normalizeComic)
    return comicListSchema.parse({
      data,
      meta: {
        page,
        pageSize,
        totalPages: result.meta.total_page ?? (data.length < pageSize ? page : page + 1),
        totalRecords: result.meta.total_record ?? Math.max(data.length, page * pageSize),
      },
      stale: result.stale,
    })
  }

  async filteredList({ page, pageSize, includedGenres, excludedGenres }: {
    page: number
    pageSize: number
    includedGenres: string[]
    excludedGenres: string[]
  }) {
    if (includedGenres.length === 1 && excludedGenres.length === 0) {
      return this.list({ page, pageSize, genre: includedGenres[0], sort: 'latest' })
    }

    const first = await this.list({
      page: 1,
      pageSize: 50,
      genre: includedGenres[0],
      sort: 'latest',
    })
    const totalSourcePages = Math.min(first.meta.totalPages, 20)
    const remaining = await Promise.all(
      Array.from(
        { length: Math.max(0, totalSourcePages - 1) },
        (_, index) => this.list({
          page: index + 2,
          pageSize: 50,
          genre: includedGenres[0],
          sort: 'latest',
        }),
      ),
    )
    const all = [first, ...remaining].flatMap((result) => result.data)
    const excluded = new Set(excludedGenres)
    const filtered = all.filter((comic) => {
      const genres = new Set(comic.genres.map((genre) => genre.slug))
      return includedGenres.every((genre) => genres.has(genre))
        && [...excluded].every((genre) => !genres.has(genre))
    })
    const start = (page - 1) * pageSize

    return comicListSchema.parse({
      data: filtered.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        totalPages: Math.ceil(filtered.length / pageSize),
        totalRecords: filtered.length,
      },
      stale: [first, ...remaining].some((result) => result.stale),
    })
  }

  async detail(comicId: string) {
    uuidSchema.parse(comicId)
    const result = await request(`manga/detail/${comicId}`, 30 * 60_000)
    return normalizeComic(upstreamComic.parse(result.data))
  }

  async chapters(comicId: string, page: number, pageSize: number) {
    uuidSchema.parse(comicId)
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    const result = await request(`chapter/${comicId}/list?${params}`, 10 * 60_000)
    const data = z.array(upstreamChapter).parse(result.data).map((value) => ({
      id: value.chapter_id,
      comicId: value.manga_id,
      number: value.chapter_number,
      title: value.chapter_title ?? '',
      releaseDate: value.release_date,
      views: value.view_count,
    }))
    return chapterListSchema.parse({
      data,
      meta: {
        page,
        pageSize,
        totalPages: result.meta.total_page ?? (data.length < pageSize ? page : page + 1),
        totalRecords: result.meta.total_record ?? Math.max(data.length, page * pageSize),
      },
      stale: result.stale,
    })
  }

  async allChapters(comicId: string) {
    uuidSchema.parse(comicId)
    return collectAllChapters((page, pageSize) => this.chapters(comicId, page, pageSize))
  }

  async firstChapter(comicId: string) {
    uuidSchema.parse(comicId)
    const firstPage = await this.chapters(comicId, 1, 100)
    const lastPage = firstPage.meta.totalPages > 1
      ? await this.chapters(comicId, firstPage.meta.totalPages, 100)
      : firstPage
    return lastPage.data.reduce<Chapter | null>(
      (earliest, chapter) => !earliest || chapter.number < earliest.number ? chapter : earliest,
      null,
    )
  }

  async chapter(chapterId: string) {
    uuidSchema.parse(chapterId)
    const result = await request(`chapter/detail/${chapterId}`, 60 * 60_000)
    const value = upstreamChapterDetail.parse(result.data)
    const base = new URL(value.base_url)
    if (!['assets.shngm.id', 'images.shngm.id'].includes(base.hostname)) throw new Error('Blocked chapter asset host')
    return chapterDetailSchema.parse({
      id: value.chapter_id,
      comicId: value.manga_id,
      number: value.chapter_number,
      title: value.chapter_title ?? '',
      releaseDate: value.release_date,
      views: value.view_count,
      pages: value.chapter.data.map((filename) => new URL(`${value.chapter.path}${filename}`, base).href),
      previousChapterId: value.prev_chapter_id ?? null,
      nextChapterId: value.next_chapter_id ?? null,
    })
  }
}
