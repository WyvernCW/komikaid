import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { ComicProvider } from './provider.js'
import { createApp } from './app.js'

const provider: ComicProvider = {
  async list() { return { data: [], meta: { page: 1, pageSize: 20, totalPages: 0, totalRecords: 0 }, stale: false } },
  async filteredList() { return { data: [], meta: { page: 1, pageSize: 24, totalPages: 0, totalRecords: 0 }, stale: false } },
  async detail() { throw Object.assign(new Error('missing'), { status: 404 }) },
  async chapters() { return { data: [], meta: { page: 1, pageSize: 50, totalPages: 0, totalRecords: 0 }, stale: false } },
  async allChapters() { return { data: [], meta: { page: 1, pageSize: 100, totalPages: 0, totalRecords: 0 }, stale: false } },
  async firstChapter() { return null },
  async chapter() { throw Object.assign(new Error('missing'), { status: 404 }) },
}

describe('KomikaID API', () => {
  it('returns health status', async () => {
    const response = await request(createApp(provider)).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
  })

  it('validates search queries', async () => {
    const response = await request(createApp(provider)).get('/api/comics/search?q=a')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
  })

  it('blocks image SSRF targets', async () => {
    const response = await request(createApp(provider)).get('/api/images').query({ url: 'https://example.com/private.png' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('BLOCKED_IMAGE_HOST')
  })

  it('returns the first chapter for a comic', async () => {
    const response = await request(createApp(provider))
      .get('/api/comics/2555b94b-b381-41ac-973f-2c76132fe924/chapters/first')
    expect(response.status).toBe(200)
    expect(response.body).toBeNull()
  })

  it('batches latest chapters without failing the entire catalog', async () => {
    const comicId = '2555b94b-b381-41ac-973f-2c76132fe924'
    const response = await request(createApp(provider))
      .get('/api/comics/chapters/latest')
      .query({ ids: comicId })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ [comicId]: [] })
  })

  it('reports unavailable account sync when Clerk is not fully configured', async () => {
    const secretKey = process.env.CLERK_SECRET_KEY
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY
    const vitePublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY
    delete process.env.CLERK_SECRET_KEY
    delete process.env.CLERK_PUBLISHABLE_KEY
    delete process.env.VITE_CLERK_PUBLISHABLE_KEY
    try {
      const response = await request(createApp(provider)).put('/api/sync').send({
        favorites: [],
        progress: [],
        notificationPreferences: [],
      })
      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('AUTH_NOT_CONFIGURED')
    } finally {
      if (secretKey) process.env.CLERK_SECRET_KEY = secretKey
      if (publishableKey) process.env.CLERK_PUBLISHABLE_KEY = publishableKey
      if (vitePublishableKey) process.env.VITE_CLERK_PUBLISHABLE_KEY = vitePublishableKey
    }
  })
})
