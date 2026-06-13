import { z } from 'zod'

export const taxonomyItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
})

export const comicSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  alternativeTitle: z.string().default(''),
  description: z.string().default(''),
  coverUrl: z.string().url(),
  bannerUrl: z.string().url().nullable(),
  latestChapterId: z.string().uuid().nullable(),
  latestChapterNumber: z.number().nullable(),
  latestChapterTime: z.string().nullable(),
  status: z.number(),
  country: z.string(),
  rating: z.number(),
  views: z.number(),
  bookmarks: z.number(),
  genres: z.array(taxonomyItemSchema),
  updatedAt: z.string(),
})

export const chapterSchema = z.object({
  id: z.string().uuid(),
  comicId: z.string().uuid(),
  number: z.number(),
  title: z.string().default(''),
  releaseDate: z.string(),
  views: z.number().default(0),
})

export const chapterDetailSchema = chapterSchema.extend({
  pages: z.array(z.string().url()),
  previousChapterId: z.string().uuid().nullable(),
  nextChapterId: z.string().uuid().nullable(),
})

export const pageMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  totalRecords: z.number().int().nonnegative(),
})

export const comicListSchema = z.object({
  data: z.array(comicSchema),
  meta: pageMetaSchema,
  stale: z.boolean().default(false),
})

export const chapterListSchema = z.object({
  data: z.array(chapterSchema),
  meta: pageMetaSchema,
  stale: z.boolean().default(false),
})

export type Comic = z.infer<typeof comicSchema>
export type Chapter = z.infer<typeof chapterSchema>
export type ChapterDetail = z.infer<typeof chapterDetailSchema>
export type ComicList = z.infer<typeof comicListSchema>
export type ChapterList = z.infer<typeof chapterListSchema>

export type ReadingProgress = {
  comicId: string
  chapterId: string
  chapterNumber: number
  pageIndex: number
  pageCount: number
  updatedAt: number
}

export type ReadingHistoryItem = {
  comic: Comic
  progress: ReadingProgress
}

export type DownloadRecord = {
  chapterId: string
  comicId: string
  title: string
  chapterNumber: number
  status: 'queued' | 'downloading' | 'paused' | 'complete' | 'failed'
  completedPages: number
  totalPages: number
  error?: string
  updatedAt: number
}

export type ReleaseInboxItem = {
  id: string
  comicId: string
  chapterId: string
  title: string
  chapterNumber: number
  createdAt: number
  read: boolean
}

export const syncPayloadSchema = z.object({
  favorites: z.array(z.object({
    comicId: z.string(),
    enabled: z.boolean(),
    updatedAt: z.number(),
  })),
  progress: z.array(z.object({
    comicId: z.string(),
    chapterId: z.string(),
    chapterNumber: z.number(),
    pageIndex: z.number(),
    pageCount: z.number(),
    updatedAt: z.number(),
  })),
  notificationPreferences: z.array(z.object({
    comicId: z.string(),
    enabled: z.boolean(),
    quietStart: z.string().nullable(),
    quietEnd: z.string().nullable(),
    updatedAt: z.number(),
  })),
})

export type SyncPayload = z.infer<typeof syncPayloadSchema>
