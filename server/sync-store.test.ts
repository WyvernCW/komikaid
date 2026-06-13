import { describe, expect, it } from 'vitest'
import type { SyncPayload } from '../shared/contracts.js'
import { mergeSyncPayloads } from './sync-store.js'

const comicId = '2555b94b-b381-41ac-973f-2c76132fe924'
const chapterId = '3555b94b-b381-41ac-973f-2c76132fe924'

const empty = (): SyncPayload => ({
  favorites: [],
  progress: [],
  notificationPreferences: [],
})

describe('account data reconciliation', () => {
  it('migrates anonymous progress into an empty account', () => {
    const anonymous = empty()
    anonymous.progress.push({
      comicId,
      chapterId,
      chapterNumber: 4,
      pageIndex: 8,
      pageCount: 20,
      updatedAt: 200,
    })

    expect(mergeSyncPayloads(empty(), anonymous).progress).toEqual(anonymous.progress)
  })

  it('keeps newer account progress and avoids duplicate comics', () => {
    const account = empty()
    account.progress.push({
      comicId,
      chapterId,
      chapterNumber: 5,
      pageIndex: 3,
      pageCount: 18,
      updatedAt: 300,
    })
    const anonymous = empty()
    anonymous.progress.push({
      comicId,
      chapterId,
      chapterNumber: 4,
      pageIndex: 8,
      pageCount: 20,
      updatedAt: 200,
    })

    const merged = mergeSyncPayloads(account, anonymous)
    expect(merged.progress).toHaveLength(1)
    expect(merged.progress[0]).toEqual(account.progress[0])
  })

  it('uses newer anonymous progress when it was read after account data', () => {
    const account = empty()
    account.progress.push({
      comicId,
      chapterId,
      chapterNumber: 4,
      pageIndex: 2,
      pageCount: 20,
      updatedAt: 100,
    })
    const anonymous = empty()
    anonymous.progress.push({
      comicId,
      chapterId,
      chapterNumber: 6,
      pageIndex: 9,
      pageCount: 24,
      updatedAt: 400,
    })

    expect(mergeSyncPayloads(account, anonymous).progress).toEqual(anonymous.progress)
  })
})
