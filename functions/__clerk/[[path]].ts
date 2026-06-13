interface Env {
  CLERK_SECRET_KEY: string
}

interface PagesContext {
  env: Env
  request: Request
}

const CLERK_FAPI = 'https://frontend-api.clerk.dev'
const CLERK_PROXY_URL = 'https://komikaid.pages.dev/__clerk'
const CLOUDFLARE_COOKIES = /^(?:__cf_bm|_cfuvid)=/i

export async function onRequest({ env, request }: PagesContext): Promise<Response> {
  if (!env.CLERK_SECRET_KEY?.startsWith('sk_live_')) {
    return new Response('Clerk production secret is not configured.', { status: 503 })
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(
    `${incomingUrl.pathname.replace(/^\/__clerk\/?/, '/')}${incomingUrl.search}`,
    CLERK_FAPI,
  )
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('Clerk-Proxy-Url', CLERK_PROXY_URL)
  headers.set('Clerk-Secret-Key', env.CLERK_SECRET_KEY)
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '')

  const response = await fetch(upstreamUrl, new Request(request, {
    headers,
    redirect: 'manual',
  }))
  const responseHeaders = new Headers(response.headers)
  const cookieHeaders = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.() ?? []
  if (cookieHeaders.length) {
    responseHeaders.delete('set-cookie')
    for (const cookie of cookieHeaders) {
      if (!CLOUDFLARE_COOKIES.test(cookie)) responseHeaders.append('set-cookie', cookie)
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
