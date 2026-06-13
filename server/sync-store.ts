import { createClerkClient } from '@clerk/express'
import { z } from 'zod'
import type { SyncPayload } from '../shared/contracts.js'

const syncSchema = z.object({
  favorites: z.array(z.object({
    comicId: z.string().uuid(),
    enabled: z.boolean(),
    updatedAt: z.number(),
  })).max(5000),
  progress: z.array(z.object({
    comicId: z.string().uuid(),
    chapterId: z.string().uuid(),
    chapterNumber: z.number(),
    pageIndex: z.number().int().nonnegative(),
    pageCount: z.number().int().nonnegative(),
    updatedAt: z.number(),
  })).max(5000),
  notificationPreferences: z.array(z.object({
    comicId: z.string().uuid(),
    enabled: z.boolean(),
    quietStart: z.string().nullable(),
    quietEnd: z.string().nullable(),
    updatedAt: z.number(),
  })).max(5000),
})

const emptySync = (): SyncPayload => ({ favorites: [], progress: [], notificationPreferences: [] })
const client = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

const mergeByKey = <T extends { updatedAt: number }>(current: T[], incoming: T[], key: (item: T) => string) => {
  const merged = new Map(current.map((item) => [key(item), item]))
  for (const item of incoming) {
    const previous = merged.get(key(item))
    if (!previous || item.updatedAt >= previous.updatedAt) merged.set(key(item), item)
  }
  return [...merged.values()]
}

export function mergeSyncPayloads(current: SyncPayload, incoming: SyncPayload): SyncPayload {
  return {
    favorites: mergeByKey(current.favorites, incoming.favorites, (item) => item.comicId),
    progress: mergeByKey(current.progress, incoming.progress, (item) => item.comicId),
    notificationPreferences: mergeByKey(
      current.notificationPreferences,
      incoming.notificationPreferences,
      (item) => item.comicId,
    ),
  }
}

export async function getUserSync(userId: string): Promise<SyncPayload> {
  const user = await client().users.getUser(userId)
  return syncSchema.catch(emptySync()).parse(user.privateMetadata.komikaidSync) as SyncPayload
}

export async function mergeUserSync(userId: string, input: unknown): Promise<SyncPayload> {
  const incoming = syncSchema.parse(input) as SyncPayload
  const current = await getUserSync(userId)
  const merged = mergeSyncPayloads(current, incoming)
  await client().users.updateUserMetadata(userId, {
    privateMetadata: { komikaidSync: merged },
  })
  return merged
}
