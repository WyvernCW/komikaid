import { createApiIndex } from '../../shared/api-document'

interface PagesContext {
  request: Request
}

export async function onRequest({ request }: PagesContext): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (request.method !== 'GET') {
    return Response.json({ error: { code: 'METHOD_NOT_ALLOWED' } }, { status: 405 })
  }

  return Response.json(createApiIndex(new URL(request.url).origin), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
