import {
  chapterDetailSchema,
  chapterSchema,
  chapterListSchema,
  comicListSchema,
  comicSchema,
  syncPayloadSchema,
  type ChapterDetail,
  type Chapter,
  type ChapterList,
  type Comic,
  type ComicList,
  type SyncPayload,
} from '../../shared/contracts'
import { Capacitor, CapacitorHttp, type HttpResponse } from '@capacitor/core'
import { z } from 'zod'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const baseUrl = configuredBaseUrl
  || (Capacitor.isNativePlatform() ? 'https://komikaid.pages.dev' : '')

type RequestOptions = {
  method?: 'GET' | 'PUT'
  token?: string | null
  data?: unknown
}

async function requestJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.data !== undefined) headers['Content-Type'] = 'application/json'

  if (Capacitor.isNativePlatform()) {
    const response: HttpResponse = await CapacitorHttp.request({
      url: `${baseUrl}${path}`,
      method,
      headers,
      data: options.data,
      connectTimeout: 6_000,
      readTimeout: 20_000,
      responseType: 'json',
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Request failed (${response.status})`)
    }
    return response.data
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json()
}

async function getJson<T>(path: string, parser: { parse(value: unknown): T }, token?: string | null): Promise<T> {
  return parser.parse(await requestJson(path, { token }))
}

export const api = {
  comics(page = 1): Promise<ComicList> {
    return getJson(`/api/comics?page=${page}&pageSize=24&sort=latest`, comicListSchema)
  },
  search(query: string, page = 1): Promise<ComicList> {
    return getJson(`/api/comics/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=24`, comicListSchema)
  },
  filter(includedGenres: string[], excludedGenres: string[], page = 1): Promise<ComicList> {
    const params = new URLSearchParams({
      include: includedGenres.join(','),
      exclude: excludedGenres.join(','),
      page: String(page),
      pageSize: '24',
    })
    return getJson(`/api/comics/filter?${params}`, comicListSchema)
  },
  comic(id: string): Promise<Comic> {
    return getJson(`/api/comics/${id}`, comicSchema)
  },
  chapters(id: string, page = 1, pageSize = 100): Promise<ChapterList> {
    return getJson(`/api/comics/${id}/chapters?page=${page}&pageSize=${pageSize}`, chapterListSchema)
  },
  latestChapters(ids: string[]): Promise<Record<string, Chapter[]>> {
    if (!ids.length) return Promise.resolve({})
    const schema = z.record(z.string(), z.array(chapterSchema).max(2))
    return getJson(`/api/comics/chapters/latest?ids=${encodeURIComponent(ids.join(','))}`, schema)
  },
  allChapters(id: string): Promise<ChapterList> {
    return getJson(`/api/comics/${id}/chapters/all`, chapterListSchema)
  },
  firstChapter(id: string): Promise<Chapter | null> {
    return getJson(`/api/comics/${id}/chapters/first`, chapterSchema.nullable())
  },
  chapter(id: string): Promise<ChapterDetail> {
    return getJson(`/api/chapters/${id}`, chapterDetailSchema)
  },
  image(url: string) {
    return url
  },
  cachedImage(url: string) {
    return `${baseUrl}/api/images?url=${encodeURIComponent(url)}`
  },
  async sync(payload: SyncPayload, token: string): Promise<SyncPayload> {
    return syncPayloadSchema.parse(await requestJson('/api/sync', {
      method: 'PUT',
      token,
      data: payload,
    }))
  },
}
