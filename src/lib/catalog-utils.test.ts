import { describe, expect, it } from 'vitest'
import type { Chapter, Comic } from '../../shared/contracts.js'
import {
  buildPageItems,
  cycleGenreFilter,
  filterChapters,
  filterComicsByGenres,
  formatChapterTimestamp,
  formatUpdateAge,
  rankHotComics,
} from './catalog-utils.js'

it('formats chapter age with hours and minutes', () => {
  expect(formatChapterTimestamp(
    '2026-06-13T10:00:00Z',
    Date.parse('2026-06-14T09:01:00Z'),
  )).toBe('23 jam 01 menit')
})

it('keeps chapter age in hours and minutes until 72 hours', () => {
  expect(formatChapterTimestamp(
    '2026-06-12T14:00:00Z',
    Date.parse('2026-06-14T09:36:00Z'),
  )).toBe('43 jam 36 menit')
})

it('formats chapter age in weeks and days from 72 hours until four weeks', () => {
  expect(formatChapterTimestamp(
    '2026-06-11T09:36:00Z',
    Date.parse('2026-06-14T09:36:00Z'),
  )).toBe('0 minggu 3 hari')
  expect(formatChapterTimestamp(
    '2026-05-28T09:36:00Z',
    Date.parse('2026-06-14T09:36:00Z'),
  )).toBe('2 minggu 3 hari')
})

it('formats chapter age in months and days from four weeks until twelve months', () => {
  expect(formatChapterTimestamp(
    '2026-05-14T09:36:00Z',
    Date.parse('2026-06-14T09:36:00Z'),
  )).toBe('1 bulan 1 hari')
})

it('formats chapter age in years and months after twelve months', () => {
  expect(formatChapterTimestamp(
    '2025-04-14T09:36:00Z',
    Date.parse('2026-06-14T09:36:00Z'),
  )).toBe('1 tahun 2 bulan')
})

const chapter = (number: number, title = ''): Chapter => ({
  id: `${String(number).padStart(8, '0')}-0000-4000-8000-000000000000`,
  comicId: '2555b94b-b381-41ac-973f-2c76132fe924',
  number,
  title,
  releaseDate: '2026-06-12T00:00:00Z',
  views: 0,
})

const comic = (id: string, genres: string[]): Comic => ({
  id,
  title: id,
  alternativeTitle: '',
  description: '',
  coverUrl: 'https://assets.shngm.id/cover.jpg',
  bannerUrl: null,
  latestChapterId: null,
  latestChapterNumber: null,
  latestChapterTime: null,
  status: 1,
  country: 'ID',
  rating: 0,
  views: 0,
  bookmarks: 0,
  genres: genres.map((name) => ({ name, slug: name.toLowerCase() })),
  updatedAt: '2026-06-12T00:00:00Z',
})

describe('catalog presentation helpers', () => {
  it('puts an exact chapter number before partial matches', () => {
    expect(filterChapters([chapter(100), chapter(10), chapter(1)], '1').map((item) => item.number))
      .toEqual([1, 100, 10])
  })

  it('uses New only within the first hour', () => {
    const now = Date.parse('2026-06-12T12:00:00Z')
    expect(formatUpdateAge('2026-06-12T11:30:00Z', now)).toEqual({ label: 'Baru', isNew: true })
    expect(formatUpdateAge('2026-06-12T07:00:00Z', now)).toEqual({ label: '5 jam', isNew: false })
  })

  it('rounds partial days up on compact catalog cards', () => {
    const now = Date.parse('2026-06-14T12:00:00Z')
    const releasedAt = '2026-06-11T22:41:00Z'
    expect(formatUpdateAge(releasedAt, now)).toEqual({
      label: '3 hari',
      isNew: false,
    })
    expect(formatChapterTimestamp(releasedAt, now)).toBe('61 jam 19 menit')
  })

  it('builds compact page controls around the current page', () => {
    expect(buildPageItems(1, 49)).toEqual([1, 2, 'ellipsis', 49])
    expect(buildPageItems(5, 12)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 12])
    expect(buildPageItems(49, 49)).toEqual([1, 'ellipsis', 48, 49])
    expect(buildPageItems(1, 3)).toEqual([1, 2, 3])
  })

  it('cycles a genre from include to blacklist to clear', () => {
    expect(cycleGenreFilter()).toBe('include')
    expect(cycleGenreFilter('include')).toBe('exclude')
    expect(cycleGenreFilter('exclude')).toBeUndefined()
  })

  it('includes required genres and rejects blacklisted genres', () => {
    const comics = [
      comic('2555b94b-b381-41ac-973f-2c76132fe924', ['Action', 'Fantasy']),
      comic('3555b94b-b381-41ac-973f-2c76132fe924', ['Action', 'Romance']),
    ]
    expect(filterComicsByGenres(comics, { action: 'include', romance: 'exclude' }))
      .toEqual([comics[0]])
  })

  it('ranks hot comics by bookmarks, views, then rating without duplicates', () => {
    const first = { ...comic('2555b94b-b381-41ac-973f-2c76132fe924', ['Action']), bookmarks: 10, views: 100 }
    const second = { ...comic('3555b94b-b381-41ac-973f-2c76132fe924', ['Fantasy']), bookmarks: 20, views: 50 }
    const third = { ...comic('4555b94b-b381-41ac-973f-2c76132fe924', ['Drama']), bookmarks: 10, views: 200 }

    expect(rankHotComics([first, second, third, first], 3).map((item) => item.id))
      .toEqual([second.id, third.id, first.id])
  })
})
