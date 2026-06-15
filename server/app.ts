import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClerkClient } from '@clerk/backend'
import { clerkMiddleware, getAuth } from '@clerk/express'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { OAuth2Client } from 'google-auth-library'
import helmet from 'helmet'
import { z } from 'zod'
import { ShinigamiProvider, type ComicProvider } from './provider.js'
import { getUserSync, mergeUserSync } from './sync-store.js'
import { createApiIndex, createOpenApiDocument } from '../shared/api-document.js'

const imageCache = process.env.VERCEL
  ? path.join(tmpdir(), 'komikaid-images')
  : path.join(process.cwd(), '.cache', 'images')
const imageHosts = new Set(['assets.shngm.id', 'images.shngm.id'])
const imageUrlSchema = z.string().url().transform((value) => new URL(value))
const nativeGoogleSchema = z.object({
  idToken: z.string().min(100).max(10_000),
})
const latestChapterCache = new Map<string, {
  expiresAt: number
  data: Awaited<ReturnType<ComicProvider['chapters']>>['data']
}>()
const githubReleaseSchema = z.object({
  tag_name: z.string().min(1).max(80),
  name: z.string().max(200).nullable(),
  body: z.string().max(100_000).nullable(),
  published_at: z.string().datetime(),
  html_url: z.string().url(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  assets: z.array(z.object({
    name: z.string().min(1).max(255),
    browser_download_url: z.string().url(),
    size: z.number().int().nonnegative().max(300 * 1024 * 1024),
    content_type: z.string().max(100),
  })).max(100),
})
let appUpdateCache: { expiresAt: number; data: unknown } | null = null

const queryInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

const setCatalogCache = (res: Response, seconds = 300) => {
  res.setHeader('Cache-Control', `public, max-age=60, s-maxage=${seconds}, stale-while-revalidate=1800`)
}

function apiError(error: unknown, req: Request, res: Response, next: NextFunction) {
  void next
  const status = error instanceof z.ZodError ? 400 : Number((error as { status?: number })?.status ?? 500)
  const safeStatus = status >= 400 && status < 600 ? status : 500
  console.error(JSON.stringify({
    level: 'error',
    requestId: req.headers['x-request-id'],
    path: req.path,
    message: error instanceof Error ? error.message : 'Unknown error',
  }))
  res.status(safeStatus).json({
    error: {
      code: safeStatus === 400 ? 'INVALID_REQUEST' : safeStatus === 404 ? 'NOT_FOUND' : 'SERVICE_ERROR',
      message: safeStatus >= 500 ? 'Layanan sedang bermasalah. Coba lagi nanti.' : 'Permintaan tidak valid.',
    },
  })
}

export function createApp(provider: ComicProvider = new ShinigamiProvider()) {
  const app = express()
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY
  const clerkConfigured = Boolean(clerkSecretKey && clerkPublishableKey)
  const clerkOptions = clerkConfigured
    ? { secretKey: clerkSecretKey, publishableKey: clerkPublishableKey }
    : undefined
  const allowedOrigins = (
    process.env.CORS_ORIGINS
    ?? 'http://localhost:5173,capacitor://localhost,https://localhost,https://komikaid.pages.dev,https://app.komikaid.pages.dev'
  ).split(',')
  app.disable('x-powered-by')
  if (process.env.VERCEL) app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: allowedOrigins, credentials: true }))
  app.use(express.json({ limit: '256kb' }))
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }))

  app.get('/api', (req, res) => {
    res.json(createApiIndex(`${req.protocol}://${req.get('host')}`))
  })
  app.get('/api/openapi.json', (req, res) => {
    res.json(createOpenApiDocument(`${req.protocol}://${req.get('host')}`))
  })
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'komikaid-api' }))

<<<<<<< HEAD
=======
  app.get('/api/app-update/releases', async (_req, res, next) => {
    try {
      const response = await fetch('https://api.github.com/repos/WyvernCW/komikaid/releases?per_page=20', {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'KomikaID-Updater',
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) {
        throw Object.assign(new Error(`GitHub releases API returned ${response.status}`), { status: 502 })
      }
      const releases = z.array(githubReleaseSchema).parse(await response.json())
      const filtered = releases.filter((r) => !r.draft && !r.prerelease)
      const result = filtered.map((release) => ({
        version: release.tag_name.replace(/^v/i, ''),
        tag: release.tag_name,
        title: release.name || release.tag_name,
        changelog: (release.body || 'Pembaruan dan perbaikan terbaru untuk KomikaID.').trim(),
        publishedAt: release.published_at,
      }))
      res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1800')
      return res.json({ releases: result })
    } catch (error) {
      return next(error)
    }
  })

>>>>>>> 3e83d39 (some changes on mobile.)
  app.get('/api/app-update/latest', async (_req, res, next) => {
    try {
      if (appUpdateCache && appUpdateCache.expiresAt > Date.now()) {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
        return res.json(appUpdateCache.data)
      }
      const response = await fetch('https://api.github.com/repos/WyvernCW/komikaid/releases/latest', {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'KomikaID-Updater',
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) {
        throw Object.assign(new Error(`GitHub release API returned ${response.status}`), { status: 502 })
      }
      const release = githubReleaseSchema.parse(await response.json())
      if (release.draft || release.prerelease) {
        return res.status(404).json({ error: { code: 'NO_STABLE_RELEASE', message: 'No stable release found.' } })
      }
      const apk = release.assets.find((asset) => (
        asset.name.toLowerCase() === 'komikaid.apk'
        || (asset.name.toLowerCase().endsWith('.apk') && asset.content_type.includes('android'))
      )) ?? release.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'))
      if (!apk) {
        return res.status(404).json({ error: { code: 'APK_NOT_FOUND', message: 'Release has no APK asset.' } })
      }
      const apkUrl = new URL(apk.browser_download_url)
      if (apkUrl.protocol !== 'https:' || apkUrl.hostname !== 'github.com') {
        throw Object.assign(new Error('Release APK URL is not trusted'), { status: 502 })
      }
      const rawChangelog = release.body || 'Pembaruan dan perbaikan terbaru untuk KomikaID.'
      const changelog = rawChangelog.trim()
      const data = {
        version: release.tag_name.replace(/^v/i, ''),
        tag: release.tag_name,
        title: release.name || release.tag_name,
        changelog,
        publishedAt: release.published_at,
        releaseUrl: release.html_url,
        downloadUrl: apk.browser_download_url,
        fileName: apk.name,
        size: apk.size,
      }
      appUpdateCache = { expiresAt: Date.now() + 5 * 60_000, data }
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=900')
      return res.json(data)
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/auth/google/native', async (req, res, next) => {
    try {
      const googleClientId = process.env.GOOGLE_WEB_CLIENT_ID ?? process.env.VITE_GOOGLE_WEB_CLIENT_ID
      if (!clerkSecretKey || !googleClientId) {
        return res.status(503).json({
          error: { code: 'AUTH_NOT_CONFIGURED', message: 'Server authentication is not configured.' },
        })
      }

      const { idToken } = nativeGoogleSchema.parse(req.body)
      const google = new OAuth2Client(googleClientId)
      const verification = await google.verifyIdToken({
        idToken,
        audience: googleClientId,
      })
      const payload = verification.getPayload()
      const email = payload?.email?.trim().toLowerCase()
      if (!payload?.sub || !email || payload.email_verified !== true) {
        return res.status(401).json({
          error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Google account could not be verified.' },
        })
      }

      const clerk = createClerkClient({ secretKey: clerkSecretKey })
      const existing = await clerk.users.getUserList({ emailAddress: [email], limit: 1 })
      const user = existing.data[0] ?? await clerk.users.createUser({
        emailAddress: [email],
        firstName: payload.given_name,
        lastName: payload.family_name,
        skipPasswordRequirement: true,
        privateMetadata: { nativeGoogleSubject: payload.sub },
      })
      const signInToken = await clerk.signInTokens.createSignInToken({
        userId: user.id,
        expiresInSeconds: 60,
      })

      res.setHeader('Cache-Control', 'no-store')
      return res.json({ ticket: signInToken.token })
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/comics', async (req, res, next) => {
    try {
      setCatalogCache(res)
      res.json(await provider.list({
        page: queryInt(req.query.page, 1, 500),
        pageSize: queryInt(req.query.pageSize, 20, 50),
        sort: typeof req.query.sort === 'string' ? req.query.sort : 'latest',
      }))
    } catch (error) { next(error) }
  })

  app.get('/api/comics/search', async (req, res, next) => {
    try {
      setCatalogCache(res, 180)
      const query = z.string().trim().min(2).max(80).parse(req.query.q)
      res.json(await provider.list({
        page: queryInt(req.query.page, 1, 500),
        pageSize: queryInt(req.query.pageSize, 20, 50),
        query,
      }))
    } catch (error) { next(error) }
  })

  app.get('/api/comics/filter', async (req, res, next) => {
    try {
      setCatalogCache(res, 180)
      const genreList = z.string().max(400).optional().transform((value) => (
        value?.split(',').map((genre) => genre.trim()).filter(Boolean) ?? []
      ))
      const includedGenres = genreList.parse(req.query.include)
      const excludedGenres = genreList.parse(req.query.exclude)
      if (!includedGenres.length && !excludedGenres.length) {
        return res.json(await provider.list({
          page: queryInt(req.query.page, 1, 500),
          pageSize: queryInt(req.query.pageSize, 20, 50),
          sort: 'latest',
        }))
      }
      return res.json(await provider.filteredList({
        page: queryInt(req.query.page, 1, 500),
        pageSize: queryInt(req.query.pageSize, 20, 50),
        includedGenres,
        excludedGenres,
      }))
    } catch (error) { return next(error) }
  })

  app.get('/api/comics/chapters/latest', async (req, res, next) => {
    try {
      const ids = z.array(z.string().uuid()).min(1).max(50).parse(
        typeof req.query.ids === 'string'
          ? [...new Set(req.query.ids.split(',').map((id) => id.trim()).filter(Boolean))]
          : [],
      )
      const result: Record<string, Awaited<ReturnType<ComicProvider['chapters']>>['data']> = {}
      let hasPartialFailure = false
      for (let start = 0; start < ids.length; start += 10) {
        const batch = ids.slice(start, start + 10)
        const settled = await Promise.allSettled(
          batch.map(async (id) => {
            const cached = latestChapterCache.get(id)
            if (cached && cached.expiresAt > Date.now()) return cached.data
            const chapters = (await provider.chapters(id, 1, 10)).data.slice(0, 2)
            latestChapterCache.set(id, {
              expiresAt: Date.now() + 30 * 60_000,
              data: chapters,
            })
            return chapters
          }),
        )
        await Promise.all(settled.map(async (entry, index) => {
          const id = batch[index]
          if (entry.status === 'fulfilled') {
            result[id] = entry.value
            return
          }
          try {
            await new Promise((resolve) => setTimeout(resolve, 200))
            const chapters = (await provider.chapters(id, 1, 10)).data.slice(0, 2)
            latestChapterCache.set(id, {
              expiresAt: Date.now() + 30 * 60_000,
              data: chapters,
            })
            result[id] = chapters
          } catch {
            hasPartialFailure = true
            result[id] = []
          }
        }))
      }
      res.setHeader(
        'Cache-Control',
        hasPartialFailure
          ? 'no-store'
          : 'public, max-age=300, stale-while-revalidate=1800',
      )
      if (hasPartialFailure) res.setHeader('X-KomikaID-Partial', 'true')
      res.json(result)
    } catch (error) { next(error) }
  })

  app.get('/api/comics/:mangaId', async (req, res, next) => {
    try {
      setCatalogCache(res, 1800)
      res.json(await provider.detail(req.params.mangaId))
    } catch (error) { next(error) }
  })

  app.get('/api/comics/:mangaId/chapters', async (req, res, next) => {
    try {
      setCatalogCache(res, 600)
      res.json(await provider.chapters(
        req.params.mangaId,
        queryInt(req.query.page, 1, 1000),
        queryInt(req.query.pageSize, 50, 100),
      ))
    } catch (error) { next(error) }
  })

  app.get('/api/comics/:mangaId/chapters/first', async (req, res, next) => {
    try {
      setCatalogCache(res, 600)
      res.json(await provider.firstChapter(req.params.mangaId))
    } catch (error) { next(error) }
  })

  app.get('/api/comics/:mangaId/chapters/all', async (req, res, next) => {
    try {
      setCatalogCache(res, 600)
      res.json(await provider.allChapters(req.params.mangaId))
    } catch (error) { next(error) }
  })

  app.get('/api/chapters/:chapterId', async (req, res, next) => {
    try {
      setCatalogCache(res, 3600)
      res.json(await provider.chapter(req.params.chapterId))
    } catch (error) { next(error) }
  })

  app.get('/api/images', async (req, res, next) => {
    try {
      const target = imageUrlSchema.parse(req.query.url)
      if (target.protocol !== 'https:' || !imageHosts.has(target.hostname)) {
        return res.status(400).json({ error: { code: 'BLOCKED_IMAGE_HOST', message: 'Image host is not allowed.' } })
      }

      const key = createHash('sha256').update(target.href).digest('hex')
      const dataPath = path.join(imageCache, key)
      const metaPath = `${dataPath}.json`
      try {
        const [data, metaRaw] = await Promise.all([readFile(dataPath), readFile(metaPath, 'utf8')])
        const meta = JSON.parse(metaRaw) as { contentType: string }
        res.setHeader('Content-Type', meta.contentType)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        return res.send(data)
      } catch {
        // Cache miss.
      }

      const response = await fetch(target, {
        headers: { Accept: 'image/avif,image/webp,image/*', Referer: 'https://shinigami.id/' },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw Object.assign(new Error(`Image upstream returned ${response.status}`), { status: 502 })
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.startsWith('image/')) throw Object.assign(new Error('Upstream was not an image'), { status: 502 })
      const declaredLength = Number(response.headers.get('content-length') ?? 0)
      if (declaredLength > 25 * 1024 * 1024) throw Object.assign(new Error('Image too large'), { status: 413 })
      const data = Buffer.from(await response.arrayBuffer())
      if (data.byteLength > 25 * 1024 * 1024) throw Object.assign(new Error('Image too large'), { status: 413 })
      await mkdir(imageCache, { recursive: true })
      await Promise.all([
        writeFile(dataPath, data),
        writeFile(metaPath, JSON.stringify({ contentType, source: target.hostname })),
      ])
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      return res.send(data)
    } catch (error) { next(error) }
  })

  const unavailableAuth = (_req: Request, res: Response) => {
    res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'Server authentication is not configured.' } })
  }
  if (clerkOptions) app.use('/api/sync', clerkMiddleware(clerkOptions))
  const auth = clerkOptions
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : unavailableAuth

  app.get('/api/sync', auth, async (req, res, next) => {
    try {
      const { userId } = getAuth(req)
      if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } })
      return res.json(await getUserSync(userId))
    } catch (error) { return next(error) }
  })

  app.put('/api/sync', auth, async (req, res, next) => {
    try {
      const { userId } = getAuth(req)
      if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } })
      return res.json(await mergeUserSync(userId, req.body))
    } catch (error) { return next(error) }
  })

  app.use(apiError)
  return app
}
