export function createApiIndex(origin: string) {
  return {
    name: 'KomikaID Public API',
    description: 'Public read-only API for the KomikaID Indonesian comics catalog.',
    version: '1.0.0',
    status: 'available',
    baseUrl: `${origin}/api`,
    documentation: `${origin}/api/openapi.json`,
    aiGuide: `${origin}/llms.txt`,
    aiGuideFull: `${origin}/llms-full.txt`,
    cors: 'Public GET endpoints can be called from any origin.',
    endpoints: [
      ['GET', '/api/health', 'API availability'],
      ['GET', '/api/comics?page=1&pageSize=24&sort=latest', 'Comic catalog'],
      ['GET', '/api/comics/search?q=solo&page=1&pageSize=24', 'Comic search'],
      ['GET', '/api/comics/filter?include=action&page=1&pageSize=24', 'Genre filter'],
      ['GET', '/api/comics/{mangaId}', 'Comic details'],
      ['GET', '/api/comics/{mangaId}/chapters?page=1&pageSize=50', 'Chapter list'],
      ['GET', '/api/chapters/{chapterId}', 'Chapter pages'],
    ].map(([method, path, description]) => ({
      method,
      path,
      description,
      url: `${origin}${path}`,
    })),
  }
}

export function createOpenApiDocument(origin: string) {
  const idParameter = (name: string) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  const pageParameters = [
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
  ]

  return {
    openapi: '3.1.0',
    info: {
      title: 'KomikaID Public API',
      version: '1.0.0',
      description: 'Read-only catalog, comic detail, chapter list, and reader endpoints.',
    },
    servers: [{ url: `${origin}/api` }],
    paths: {
      '/health': {
        get: { summary: 'API health check', responses: { 200: { description: 'API is available.' } } },
      },
      '/comics': {
        get: {
          summary: 'Browse comics',
          parameters: [
            ...pageParameters,
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'popular'] } },
          ],
          responses: { 200: { description: 'Paginated comic catalog.' } },
        },
      },
      '/comics/search': {
        get: {
          summary: 'Search comics',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 1 } },
            ...pageParameters,
          ],
          responses: { 200: { description: 'Paginated search results.' } },
        },
      },
      '/comics/filter': {
        get: {
          summary: 'Filter comics by genre',
          parameters: [
            { name: 'include', in: 'query', schema: { type: 'string' } },
            { name: 'exclude', in: 'query', schema: { type: 'string' } },
            ...pageParameters,
          ],
          responses: { 200: { description: 'Filtered comic results.' } },
        },
      },
      '/comics/{mangaId}': {
        get: {
          summary: 'Get comic details',
          parameters: [idParameter('mangaId')],
          responses: { 200: { description: 'Comic details.' }, 404: { description: 'Not found.' } },
        },
      },
      '/comics/{mangaId}/chapters': {
        get: {
          summary: 'Get comic chapters',
          parameters: [idParameter('mangaId'), ...pageParameters],
          responses: { 200: { description: 'Paginated chapter list.' } },
        },
      },
      '/chapters/{chapterId}': {
        get: {
          summary: 'Get chapter pages',
          parameters: [idParameter('chapterId')],
          responses: { 200: { description: 'Chapter metadata and page URLs.' }, 404: { description: 'Not found.' } },
        },
      },
    },
  }
}
