import { createApiIndex, createOpenApiDocument } from '../../shared/api-document'

interface PagesContext {
  request: Request
<<<<<<< HEAD
=======
  env: Record<string, string>
>>>>>>> 3e83d39 (some changes on mobile.)
  waitUntil(promise: Promise<unknown>): void
}

const API_ORIGIN = 'https://komikaid.vercel.app'
const IMAGE_HOSTS = new Set(['assets.shngm.id', 'images.shngm.id'])
const APP_ORIGINS = new Set(['https://komikaid.pages.dev', 'https://app.komikaid.pages.dev'])
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

<<<<<<< HEAD
=======

>>>>>>> 3e83d39 (some changes on mobile.)
function withCors(response: Response, request: Request): Response {
  const requestUrl = new URL(request.url)
  const requestedMethod = request.method === 'OPTIONS'
    ? request.headers.get('access-control-request-method')?.toUpperCase()
    : request.method
  const isPublicRead = requestedMethod === 'GET'
    && !requestUrl.pathname.startsWith('/api/sync')
    && !requestUrl.pathname.startsWith('/api/auth/')
  const origin = request.headers.get('origin')
  const result = new Response(response.body, response)
  if (isPublicRead) {
    result.headers.set('Access-Control-Allow-Origin', '*')
    return result
  }
  if (!origin || !APP_ORIGINS.has(origin)) return response
  result.headers.set('Access-Control-Allow-Origin', origin)
  result.headers.set('Access-Control-Allow-Credentials', 'true')
  result.headers.append('Vary', 'Origin')
  return result
}

async function proxyImage(request: Request, waitUntil: PagesContext['waitUntil']): Promise<Response> {
  const requestUrl = new URL(request.url)
  const sourceValue = requestUrl.searchParams.get('url')
  if (!sourceValue) return Response.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })

  let source: URL
  try {
    source = new URL(sourceValue)
  } catch {
    return Response.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })
  }
  if (source.protocol !== 'https:' || !IMAGE_HOSTS.has(source.hostname)) {
    return Response.json({ error: { code: 'BLOCKED_IMAGE_HOST' } }, { status: 400 })
  }
  const cache = caches.default
  const cacheKey = new Request(requestUrl.toString(), { method: 'GET' })
  const cached = await cache.match(cacheKey)
  if (cached) {
    const response = new Response(cached.body, cached)
    response.headers.set('X-KomikaID-Cache', 'HIT')
    return response
  }

  const upstream = await fetch(source, {
    headers: {
      Accept: 'image/avif,image/webp,image/*',
      Referer: 'https://shinigami.id/',
    },
    redirect: 'manual',
  })
  const contentType = upstream.headers.get('content-type') ?? ''
  const declaredLength = Number(upstream.headers.get('content-length') ?? 0)
  if (!upstream.ok || !contentType.startsWith('image/')) {
    return Response.json({ error: { code: 'IMAGE_UPSTREAM_ERROR' } }, { status: 502 })
  }
  if (declaredLength > MAX_IMAGE_BYTES) {
    return Response.json({ error: { code: 'IMAGE_TOO_LARGE' } }, { status: 413 })
  }

  const body = await upstream.arrayBuffer()
  if (body.byteLength > MAX_IMAGE_BYTES) {
    return Response.json({ error: { code: 'IMAGE_TOO_LARGE' } }, { status: 413 })
  }

  const headers = new Headers({
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    'Content-Length': String(body.byteLength),
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-KomikaID-Cache': 'MISS',
  })
  const response = new Response(body, { status: 200, headers })
  waitUntil(cache.put(cacheKey, response.clone()))
  return response
}

<<<<<<< HEAD
export async function onRequest({ request, waitUntil }: PagesContext): Promise<Response> {
=======
async function githubFetch(path: string, env: PagesContext['env']) {
  const headers = new Headers({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'KomikaID-Updater',
    'X-GitHub-Api-Version': '2022-11-28',
  })
  const token = (env as Record<string, string>)['GITHUB_TOKEN']
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`https://api.github.com/repos/WyvernCW/komikaid${path}`, { headers, signal: AbortSignal.timeout(10_000) })
}

async function handleAppUpdateReleases(request: Request, env: PagesContext['env']): Promise<Response> {
  const response = await githubFetch('/releases?per_page=20', env)
  if (!response.ok) {
    return Response.json({ error: { code: 'UPSTREAM_ERROR', detail: await response.text() } }, { status: 502 })
  }

  const raw = await response.json() as Array<Record<string, unknown>>
  const releases = raw.filter((r) => !r.draft && !r.prerelease).map((r) => ({
    version: String(r.tag_name ?? '').replace(/^v/i, ''),
    tag: r.tag_name,
    title: (r.name as string) || (r.tag_name as string),
    changelog: ((r.body as string) || 'Pembaruan dan perbaikan terbaru untuk KomikaID.').trim(),
    publishedAt: r.published_at,
  }))

  return Response.json({ releases }, {
    headers: { 'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=1800' },
  })
}

async function handleAppUpdateLatest(request: Request, env: PagesContext['env']): Promise<Response> {
  const response = await githubFetch('/releases/latest', env)
  if (!response.ok) {
    return Response.json({ error: { code: 'UPSTREAM_ERROR', detail: await response.text() } }, { status: 502 })
  }

  const release = await response.json() as Record<string, unknown>
  if (release.draft || release.prerelease) {
    return Response.json({ error: { code: 'NO_STABLE_RELEASE' } }, { status: 404 })
  }

  const assets = (release.assets as Array<Record<string, unknown>>) ?? []
  const apk = assets.find((a) =>
    String(a.name).toLowerCase() === 'komikaid.apk'
    || (String(a.name).toLowerCase().endsWith('.apk') && String(a.content_type).includes('android'))
  ) ?? assets.find((a) => String(a.name).toLowerCase().endsWith('.apk'))

  if (!apk) {
    return Response.json({ error: { code: 'APK_NOT_FOUND' } }, { status: 404 })
  }

  const data = {
    version: String(release.tag_name ?? '').replace(/^v/i, ''),
    tag: release.tag_name,
    title: (release.name as string) || (release.tag_name as string),
    changelog: ((release.body as string) || 'Pembaruan dan perbaikan terbaru untuk KomikaID.').trim(),
    publishedAt: release.published_at,
    releaseUrl: release.html_url,
    downloadUrl: apk.browser_download_url,
    fileName: apk.name,
    size: apk.size,
  }

  return Response.json(data, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900' },
  })
}

export async function onRequest({ request, waitUntil, env }: PagesContext): Promise<Response> {
>>>>>>> 3e83d39 (some changes on mobile.)
  const incomingUrl = new URL(request.url)
  if (request.method === 'GET' && /^\/api\/?$/.test(incomingUrl.pathname)) {
    return withCors(Response.json(createApiIndex(incomingUrl.origin), {
      headers: { 'Cache-Control': 'public, max-age=300' },
    }), request)
  }
  if (request.method === 'GET' && incomingUrl.pathname === '/api/openapi.json') {
    return withCors(Response.json(createOpenApiDocument(incomingUrl.origin), {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    }), request)
  }
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    }), request)
  }
  if (request.method === 'GET' && incomingUrl.pathname === '/api/images') {
    return withCors(await proxyImage(request, waitUntil), request)
  }

<<<<<<< HEAD
=======
  if (request.method === 'GET' && incomingUrl.pathname === '/api/app-update/releases') {
    return withCors(await handleAppUpdateReleases(request, env), request)
  }
  if (request.method === 'GET' && incomingUrl.pathname === '/api/app-update/latest') {
    return withCors(await handleAppUpdateLatest(request, env), request)
  }

>>>>>>> 3e83d39 (some changes on mobile.)
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, API_ORIGIN)
  const isPublicGet = request.method === 'GET' && !incomingUrl.pathname.startsWith('/api/sync')
  const cache = caches.default
  const cacheKey = new Request(incomingUrl.toString(), { method: 'GET' })
  if (isPublicGet) {
    const cached = await cache.match(cacheKey)
    if (cached) return withCors(cached, request)
  }
  const headers = new Headers(request.headers)
  headers.delete('host')
  if (isPublicGet) {
    headers.delete('authorization')
    headers.delete('cookie')
  }
  headers.set('X-Forwarded-Host', incomingUrl.host)
  headers.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''))

  const response = await fetch(upstreamUrl, new Request(request, {
    headers,
    redirect: 'manual',
  }))
  if (!isPublicGet || !response.ok) return withCors(response, request)
  if (response.headers.get('Cache-Control')?.includes('no-store')) {
    return withCors(response, request)
  }
  if (incomingUrl.pathname === '/api/comics/chapters/latest') {
    const payload = await response.clone().json() as Record<string, unknown>
    const isPartial = Object.values(payload).some(
      (chapters) => !Array.isArray(chapters) || chapters.length === 0,
    )
    if (isPartial) return withCors(response, request)
  }

  const cachedResponse = new Response(response.body, response)
  cachedResponse.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400')
  waitUntil(cache.put(cacheKey, cachedResponse.clone()))
  return withCors(cachedResponse, request)
}
