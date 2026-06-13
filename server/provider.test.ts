import { describe, expect, it, vi } from 'vitest'
import type { ChapterList } from '../shared/contracts.js'
import { findEarliestChapter, ShinigamiProvider } from './provider.js'

describe('ShinigamiProvider security boundaries', () => {
  it('finds the true earliest chapter across paginated newest-first results', async () => {
    const chapter = (number: number) => ({
      id: `${String(number).padStart(8, '0')}-0000-4000-8000-000000000000`,
      comicId: '2555b94b-b381-41ac-973f-2c76132fe924',
      number,
      title: '',
      releaseDate: '2026-06-12T00:00:00Z',
      views: 0,
    })
    const pages = [
      [chapter(5), chapter(4)],
      [chapter(3), chapter(2)],
      [chapter(1)],
    ]
    const loadPage = vi.fn(async (page: number, pageSize: number): Promise<ChapterList> => ({
      data: pages[page - 1] ?? [],
      meta: { page, pageSize, totalPages: 3, totalRecords: 5 },
      stale: false,
    }))

    await expect(findEarliestChapter(loadPage, 2)).resolves.toMatchObject({ number: 1 })
    expect(loadPage).toHaveBeenCalledTimes(3)
  })

  it('accepts catalog entries with missing optional portrait artwork', async () => {
    const provider = new ShinigamiProvider()
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          retcode: 0,
          message: 'success',
          data: [
            {
              manga_id: '2555b94b-b381-41ac-973f-2c76132fe924',
              title: 'Comic without portrait artwork',
              alternative_title: null,
              description: null,
              cover_image_url: 'https://storage.shngm.id/cover.jpg',
              cover_portrait_url: '',
              latest_chapter_id: null,
              latest_chapter_number: null,
              latest_chapter_time: null,
              status: 1,
              country_id: 'KR',
              user_rate: 0,
              view_count: 0,
              bookmark_count: 0,
              taxonomy: { Genre: [] },
              updated_at: '2026-06-12T00:00:00Z',
            },
          ],
          meta: {},
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    await expect(provider.list({ page: 77, pageSize: 1 })).resolves.toMatchObject({
      data: [{ bannerUrl: null }],
    })
    request.mockRestore()
  })

  it('uses upstream genre pagination for a single included genre', async () => {
    const provider = new ShinigamiProvider()
    const genre = `test-romance-pagination-${Date.now()}`
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        retcode: 0,
        message: 'success',
        data: [],
        meta: { page: 2, page_size: 24, total_page: 5, total_record: 119 },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )

    await expect(provider.filteredList({
      page: 2,
      pageSize: 24,
      includedGenres: [genre],
      excludedGenres: [],
    })).resolves.toMatchObject({
      meta: { page: 2, pageSize: 24, totalPages: 5, totalRecords: 119 },
    })
    expect(request.mock.calls[0]?.[0].toString()).toContain(`genre=${genre}`)
    request.mockRestore()
  })

  it('rejects malformed comic IDs before making a request', async () => {
    const provider = new ShinigamiProvider()
    await expect(provider.detail('../admin')).rejects.toThrow()
  })

  it('rejects malformed chapter IDs before making a request', async () => {
    const provider = new ShinigamiProvider()
    await expect(provider.chapter('not-a-uuid')).rejects.toThrow()
  })
})
