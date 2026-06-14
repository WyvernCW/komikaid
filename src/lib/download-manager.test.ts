import { describe, expect, it } from 'vitest'
import type { DownloadRecord } from '../../shared/contracts'
import { normalizeDownloadRecord } from './download-manager'

describe('normalizeDownloadRecord', () => {
  it('keeps legacy records compatible while adding resumable defaults', () => {
    const legacy: DownloadRecord = {
      chapterId: 'chapter-1',
      comicId: 'comic-1',
      title: 'Komik',
      chapterNumber: 1,
      status: 'paused',
      completedPages: 3,
      totalPages: 10,
      updatedAt: 100,
    }

    expect(normalizeDownloadRecord(legacy)).toMatchObject({
      ...legacy,
      downloadedBytes: 0,
      localPaths: [],
      retryCount: 0,
      verification: 'partial',
    })
  })

  it('marks legacy completed records as verified', () => {
    expect(normalizeDownloadRecord({
      chapterId: 'chapter-2',
      comicId: 'comic-1',
      title: 'Komik',
      chapterNumber: 2,
      status: 'complete',
      completedPages: 10,
      totalPages: 10,
      updatedAt: 200,
    }).verification).toBe('verified')
  })
})
