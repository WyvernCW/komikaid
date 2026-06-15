import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import type { ChapterDetail, Comic, DownloadRecord } from '../../shared/contracts'
import { api } from './api'
import { library } from './store'

type Listener = (record: DownloadRecord) => void
type StorageReport = { downloadedBytes: number; completed: number; active: number; failed: number }

const WEB_CACHE = 'komikaid-downloads-v1'
const activeJobs = new Set<string>()
<<<<<<< HEAD
=======
const enqueueLocks = new Set<string>()
>>>>>>> 3e83d39 (some changes on mobile.)

export function normalizeDownloadRecord(record: DownloadRecord): DownloadRecord {
  return {
    ...record,
    downloadedBytes: record.downloadedBytes ?? 0,
    localPaths: record.localPaths ?? [],
    retryCount: record.retryCount ?? 0,
    verification: record.verification ?? (record.status === 'complete' ? 'verified' : 'partial'),
  }
}

class DownloadManager {
  private listeners = new Set<Listener>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private async save(record: DownloadRecord) {
    const normalized = normalizeDownloadRecord(record)
    await library.saveDownload(normalized)
    for (const listener of this.listeners) listener(normalized)
    return normalized
  }

  async initialize() {
    const records = (await library.getDownloads()).map(normalizeDownloadRecord)
    await Promise.all(records.map((record) => library.saveDownload(record)))
    for (const record of records) {
      if ((record.status === 'queued' || record.status === 'downloading') && record.pageUrls?.length) {
        void this.process({ ...record, status: 'queued' })
      }
    }
    return records
  }

  async pause(chapterId: string) {
    const record = await this.find(chapterId)
    if (!record || record.status === 'complete') return
    await this.save({ ...record, status: 'paused', verification: 'partial', updatedAt: Date.now() })
  }

  async resume(chapterId: string) {
    const record = await this.find(chapterId)
    if (!record?.pageUrls?.length || record.status === 'complete') return
    await this.process({ ...record, status: 'queued', error: undefined, updatedAt: Date.now() })
  }

  async retry(chapterId: string) {
    const record = await this.find(chapterId)
    if (!record?.pageUrls?.length) return
    await this.process({
      ...record,
      status: 'queued',
      retryCount: (record.retryCount ?? 0) + 1,
      error: undefined,
      updatedAt: Date.now(),
    })
  }

  async cancel(chapterId: string) {
    await this.pause(chapterId)
    await this.remove(chapterId)
  }

  async remove(chapterId: string) {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.rmdir({ path: `downloads/${chapterId}`, directory: Directory.Data, recursive: true })
      } catch {
        // The directory may already be absent.
      }
    } else {
      const cache = await caches.open(WEB_CACHE)
      for (const request of await cache.keys()) {
        if (request.headers.get('x-komikaid-chapter') === chapterId) await cache.delete(request)
      }
    }
    await library.deleteDownload(chapterId)
  }

  async clearCompleted() {
    const completed = (await library.getDownloads()).filter((item) => item.status === 'complete')
    await Promise.all(completed.map((item) => this.remove(item.chapterId)))
  }

  async getStorageReport(): Promise<StorageReport> {
    const records = (await library.getDownloads()).map(normalizeDownloadRecord)
    return {
      downloadedBytes: records.reduce((total, record) => total + (record.downloadedBytes ?? 0), 0),
      completed: records.filter((record) => record.status === 'complete').length,
      active: records.filter((record) => ['queued', 'downloading', 'paused'].includes(record.status)).length,
      failed: records.filter((record) => record.status === 'failed').length,
    }
  }

  async enqueue(comic: Comic, chapter: ChapterDetail) {
<<<<<<< HEAD
    const existing = await this.find(chapter.id)
    if (existing?.status === 'complete' || activeJobs.has(chapter.id)) return
    const record: DownloadRecord = {
=======
    if (enqueueLocks.has(chapter.id)) return
    enqueueLocks.add(chapter.id)
    try {
      const existing = await this.find(chapter.id)
      if (existing?.status === 'complete') return
      const record: DownloadRecord = {
>>>>>>> 3e83d39 (some changes on mobile.)
      chapterId: chapter.id,
      comicId: comic.id,
      title: comic.title,
      chapterNumber: chapter.number,
      status: 'queued',
      completedPages: existing?.completedPages ?? 0,
      totalPages: chapter.pages.length,
      pageUrls: chapter.pages,
      localPaths: existing?.localPaths ?? [],
      previousChapterId: chapter.previousChapterId,
      nextChapterId: chapter.nextChapterId,
      downloadedBytes: existing?.downloadedBytes ?? 0,
      retryCount: existing?.retryCount ?? 0,
      verification: 'partial',
      updatedAt: Date.now(),
    }
    await this.save(record)
    await this.process(record)
<<<<<<< HEAD
=======
    } finally {
      enqueueLocks.delete(chapter.id)
    }
>>>>>>> 3e83d39 (some changes on mobile.)
  }

  async getOfflineChapter(chapterId: string): Promise<ChapterDetail | null> {
    const record = await this.find(chapterId)
    if (!record || record.status !== 'complete' || !record.pageUrls?.length) return null
    const pages = Capacitor.isNativePlatform()
      ? (record.localPaths ?? []).map((path) => Capacitor.convertFileSrc(path))
      : await this.webObjectUrls(record)
    if (pages.length !== record.totalPages) return null
    return {
      id: record.chapterId,
      comicId: record.comicId,
      number: record.chapterNumber,
      title: '',
      releaseDate: new Date(record.updatedAt).toISOString(),
      views: 0,
      pages,
      previousChapterId: record.previousChapterId ?? null,
      nextChapterId: record.nextChapterId ?? null,
    }
  }

  private async find(chapterId: string) {
    return (await library.getDownloads()).find((record) => record.chapterId === chapterId)
  }

  private async process(input: DownloadRecord) {
    if (activeJobs.has(input.chapterId) || !input.pageUrls?.length) return
    const pageUrls = input.pageUrls
    activeJobs.add(input.chapterId)
    let next = await this.save({ ...normalizeDownloadRecord(input), status: 'downloading', updatedAt: Date.now() })
    try {
      for (let index = next.completedPages; index < pageUrls.length; index += 1) {
        const persisted = await this.find(next.chapterId)
        if (!persisted || persisted.status === 'paused') return
        const downloaded = await this.downloadPage(next.chapterId, index, pageUrls[index])
        const afterDownload = await this.find(next.chapterId)
        const pausedDuringDownload = afterDownload?.status === 'paused'
        next = await this.save({
          ...next,
          status: pausedDuringDownload ? 'paused' : 'downloading',
          completedPages: index + 1,
          downloadedBytes: (next.downloadedBytes ?? 0) + downloaded.bytes,
          localPaths: [...(next.localPaths ?? []), downloaded.path],
          verification: 'partial',
          updatedAt: Date.now(),
        })
        if (pausedDuringDownload) return
      }
      await this.save({
        ...next,
        status: 'complete',
        verification: next.completedPages === next.totalPages ? 'verified' : 'partial',
        error: undefined,
        updatedAt: Date.now(),
      })
    } catch (error) {
      await this.save({
        ...next,
        status: 'failed',
        verification: 'partial',
        error: error instanceof Error ? error.message : 'Download gagal',
        updatedAt: Date.now(),
      })
    } finally {
      activeJobs.delete(input.chapterId)
    }
  }

  private async downloadPage(chapterId: string, index: number, pageUrl: string) {
    const url = api.cachedImage(pageUrl)
    if (Capacitor.isNativePlatform()) {
      const relativePath = `downloads/${chapterId}/${String(index).padStart(4, '0')}.img`
      await Filesystem.downloadFile({
        url,
        path: relativePath,
        directory: Directory.Data,
      })
      const [stat, uri] = await Promise.all([
        Filesystem.stat({ path: relativePath, directory: Directory.Data }),
        Filesystem.getUri({ path: relativePath, directory: Directory.Data }),
      ])
      return { bytes: stat.size, path: uri.uri }
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Halaman ${index + 1} gagal (${response.status})`)
    const blob = await response.blob()
    const request = new Request(url, { headers: { 'x-komikaid-chapter': chapterId } })
    await (await caches.open(WEB_CACHE)).put(request, new Response(blob, { headers: response.headers }))
    return { bytes: blob.size, path: url }
  }

  private async webObjectUrls(record: DownloadRecord) {
    const cache = await caches.open(WEB_CACHE)
    const pages: string[] = []
    for (const pageUrl of record.pageUrls ?? []) {
      const url = api.cachedImage(pageUrl)
      const requests = await cache.keys()
      const request = requests.find((candidate) => candidate.url === new URL(url, location.origin).href
        && candidate.headers.get('x-komikaid-chapter') === record.chapterId)
      const response = request ? await cache.match(request) : undefined
      if (!response) return []
      pages.push(URL.createObjectURL(await response.blob()))
    }
    return pages
  }
}

export const downloadManager = new DownloadManager()
