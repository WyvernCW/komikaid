import { useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { library } from '../lib/store'

const POLL_INTERVAL = 10 * 60_000

export default function InboxServices() {
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const favorites = await library.getFavorites()
        if (!mounted.current || !favorites.length) return

        const ids = favorites.map((c) => c.id)
        const chapters = await api.latestChapters(ids)
        if (!mounted.current) return

        const existing = await library.getInbox()
        const existingKeys = new Set(existing.map((item) => `${item.comicId}:${item.chapterId}`))

        const now = Date.now()
        for (const comic of favorites) {
          const latest = (chapters[comic.id] ?? []).slice(0, 1)
          for (const chapter of latest) {
            const key = `${comic.id}:${chapter.id}`
            if (existingKeys.has(key)) continue
            await library.addInbox({
              id: `${comic.id}:${chapter.id}`,
              comicId: comic.id,
              chapterId: chapter.id,
              title: comic.title,
              chapterNumber: chapter.number,
              createdAt: now,
              read: false,
            })
          }
        }
      } catch {
        // Silently retry next cycle.
      }
      if (mounted.current) timer = setTimeout(poll, POLL_INTERVAL)
    }

    timer = setTimeout(poll, 5_000)
    return () => {
      mounted.current = false
      clearTimeout(timer)
    }
  }, [])

  return null
}
