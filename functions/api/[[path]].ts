import { createApiIndex, createOpenApiDocument } from '../../shared/api-document'

interface PagesContext {
  request: Request
  waitUntil(promise: Promise<unknown>): void
}

const API_ORIGIN = 'https://komikaid.vercel.app'
const IMAGE_HOSTS = new Set(['assets.shngm.id', 'images.shngm.id'])
const APP_ORIGINS = new Set(['https://komikaid.pages.dev', 'https://app.komikaid.pages.dev'])
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

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

export async function onRequest({ request, waitUntil }: PagesContext): Promise<Response> {
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
