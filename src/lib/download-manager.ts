import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import type { ChapterDetail, Comic, DownloadRecord } from '../../shared/contracts'
import { api } from './api'
import { library } from './store'

type Listener = (record: DownloadRecord) => void

class DownloadManager {
  private paused = new Set<string>()
  private listeners = new Set<Listener>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private emit(record: DownloadRecord) {
    for (const listener of this.listeners) listener(record)
  }
  pause(chapterId: string) { this.paused.add(chapterId) }
  resume(chapterId: string) { this.paused.delete(chapterId) }

  async remove(chapterId: string) {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.rmdir({ path: `downloads/${chapterId}`, directory: Directory.Data, recursive: true })
      } catch {
        // Already absent.
      }
    } else {
      const cache = await caches.open('komikaid-downloads-v1')
      for (const request of await cache.keys()) {
        if (request.headers.get('x-komikaid-chapter') === chapterId) await cache.delete(request)
      }
    }
    await library.deleteDownload(chapterId)
  }

  async enqueue(comic: Comic, chapter: ChapterDetail) {
    const record: DownloadRecord = {
      chapterId: chapter.id,
      comicId: comic.id,
      title: comic.title,
      chapterNumber: chapter.number,
      status: 'queued',
      completedPages: 0,
      totalPages: chapter.pages.length,
      updatedAt: Date.now(),
    }
    await library.saveDownload(record)
    this.emit(record)
    await this.process(record, chapter)
  }

  private async process(record: DownloadRecord, chapter: ChapterDetail) {
    const next: DownloadRecord = { ...record, status: 'downloading', updatedAt: Date.now() }
    await library.saveDownload(next)
    this.emit(next)
    try {
      for (let index = next.completedPages; index < chapter.pages.length; index += 1) {
        if (this.paused.has(chapter.id)) {
          const paused: DownloadRecord = { ...next, status: 'paused', completedPages: index, updatedAt: Date.now() }
          await library.saveDownload(paused)
          this.emit(paused)
          return
        }
        const url = api.cachedImage(chapter.pages[index])
        if (Capacitor.isNativePlatform()) {
          await Filesystem.downloadFile({
            url,
            path: `downloads/${chapter.id}/${String(index).padStart(4, '0')}.img`,
            directory: Directory.Data,
          })
        } else {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Page ${index + 1} failed`)
          const request = new Request(url, { headers: { 'x-komikaid-chapter': chapter.id } })
          await (await caches.open('komikaid-downloads-v1')).put(request, response)
        }
        next.completedPages = index + 1
        next.updatedAt = Date.now()
        await library.saveDownload(next)
        this.emit({ ...next })
      }
      next.status = 'complete'
      next.updatedAt = Date.now()
      await library.saveDownload(next)
      this.emit({ ...next })
    } catch (error) {
      const failed: DownloadRecord = {
        ...next,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Download failed',
        updatedAt: Date.now(),
      }
      await library.saveDownload(failed)
      this.emit(failed)
    }
  }
}

export const downloadManager = new DownloadManager()
