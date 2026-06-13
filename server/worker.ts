import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ShinigamiProvider } from './provider.js'

type SeenState = Record<string, string>
const statePath = path.join(process.cwd(), '.data', 'release-state.json')

async function loadState(): Promise<SeenState> {
  try { return JSON.parse(await readFile(statePath, 'utf8')) as SeenState } catch { return {} }
}

async function sendNotification(comic: { id: string; title: string; latestChapterId: string; latestChapterNumber: number }) {
  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) {
    console.log(JSON.stringify({ level: 'warn', message: 'OneSignal not configured', comicId: comic.id }))
    return
  }
  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      filters: [{ field: 'tag', key: `comic_${comic.id}`, relation: '=', value: 'true' }],
      headings: { id: 'Chapter baru tersedia' },
      contents: { id: `${comic.title} chapter ${comic.latestChapterNumber} sudah rilis.` },
      data: { comicId: comic.id, chapterId: comic.latestChapterId },
      target_channel: 'push',
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`OneSignal returned ${response.status}`)
}

export async function checkReleases() {
  const provider = new ShinigamiProvider()
  const state = await loadState()
  const latest = await provider.list({ page: 1, pageSize: 50, sort: 'latest' })
  for (const comic of latest.data) {
    if (!comic.latestChapterId || comic.latestChapterNumber == null) continue
    const previous = state[comic.id]
    if (previous && previous !== comic.latestChapterId) {
      await sendNotification({
        id: comic.id,
        title: comic.title,
        latestChapterId: comic.latestChapterId,
        latestChapterNumber: comic.latestChapterNumber,
      })
    }
    state[comic.id] = comic.latestChapterId
  }
  await mkdir(path.dirname(statePath), { recursive: true })
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8')
}

checkReleases().catch((error) => {
  console.error(JSON.stringify({ level: 'error', message: error instanceof Error ? error.message : 'Worker failed' }))
  process.exitCode = 1
})
