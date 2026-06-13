import { api } from './api'
import { emitLibraryUpdated } from './library-events'
import { library } from './store'

export async function reconcileAccount(token: string) {
  const merged = await api.sync(await library.getSyncPayload(), token)
  const comicIds = new Set([
    ...merged.favorites.filter((item) => item.enabled).map((item) => item.comicId),
    ...merged.progress.map((item) => item.comicId),
  ])
  const comics = (await Promise.all(
    [...comicIds].map((comicId) => api.comic(comicId).catch(() => null)),
  )).filter((comic) => comic !== null)

  if (comics.length) await library.cacheComics(comics)
  await library.applySync(merged)
  emitLibraryUpdated()
  return merged
}
