import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { openDB, type IDBPDatabase } from 'idb'
import type {
  Comic,
  DownloadRecord,
  ReadingHistoryItem,
  ReadingProgress,
  ReleaseInboxItem,
  SyncPayload,
} from '../../shared/contracts'
import { emitLibraryChanged } from './library-events'

export interface LibraryRepository {
  initialize(): Promise<void>
  cacheComics(comics: Comic[]): Promise<void>
  getCachedComics(): Promise<Comic[]>
  toggleFavorite(comic: Comic): Promise<boolean>
  isFavorite(comicId: string): Promise<boolean>
  getFavorites(): Promise<Comic[]>
  saveProgress(progress: ReadingProgress): Promise<void>
  getProgress(comicId: string): Promise<ReadingProgress | null>
  getReadingHistory(): Promise<ReadingHistoryItem[]>
  getChapterHistory(comicId: string): Promise<ReadingProgress[]>
  saveDownload(record: DownloadRecord): Promise<void>
  getDownloads(): Promise<DownloadRecord[]>
  deleteDownload(chapterId: string): Promise<void>
  getSyncPayload(): Promise<SyncPayload>
  applySync(payload: SyncPayload): Promise<void>
  addInbox(item: ReleaseInboxItem): Promise<void>
  getInbox(): Promise<ReleaseInboxItem[]>
}

const DB_NAME = 'komikaid'
const WEB_DB_OPEN_TIMEOUT_MS = 8_000
const SCHEMA = `
CREATE TABLE IF NOT EXISTS comics (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS favorites (comic_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS progress (comic_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chapter_progress (chapter_id TEXT PRIMARY KEY, comic_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS downloads (chapter_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notification_preferences (comic_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, quiet_start TEXT, quiet_end TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_comics_updated ON comics(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_comic ON chapter_progress(comic_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_updated ON downloads(updated_at DESC);
`

class NativeRepository implements LibraryRepository {
  private connection: SQLiteDBConnection | null = null

  async initialize() {
    if (this.connection) return
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const consistency = await sqlite.checkConnectionsConsistency()
    const existing = (await sqlite.isConnection(DB_NAME, false)).result
    this.connection = consistency.result && existing
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
    await this.connection.open()
    await this.connection.execute(SCHEMA)
  }

  private db() {
    if (!this.connection) throw new Error('Database not initialized')
    return this.connection
  }

  async cacheComics(comics: Comic[]) {
    for (const comic of comics) {
      await this.db().run('INSERT OR REPLACE INTO comics (id,payload,updated_at) VALUES (?,?,?)', [
        comic.id, JSON.stringify(comic), Date.now(),
      ])
    }
  }
  async getCachedComics() {
    const result = await this.db().query('SELECT payload FROM comics ORDER BY updated_at DESC LIMIT 100')
    return (result.values ?? []).map((row) => JSON.parse(String(row.payload)) as Comic)
  }
  async toggleFavorite(comic: Comic) {
    await this.cacheComics([comic])
    const active = await this.isFavorite(comic.id)
    await this.db().run('INSERT OR REPLACE INTO favorites (comic_id,enabled,updated_at) VALUES (?,?,?)', [
      comic.id, active ? 0 : 1, Date.now(),
    ])
    return !active
  }
  async isFavorite(comicId: string) {
    const result = await this.db().query('SELECT enabled FROM favorites WHERE comic_id=?', [comicId])
    return Number(result.values?.[0]?.enabled ?? 0) === 1
  }
  async getFavorites() {
    const result = await this.db().query(
      'SELECT c.payload FROM favorites f JOIN comics c ON c.id=f.comic_id WHERE f.enabled=1 ORDER BY f.updated_at DESC',
    )
    return (result.values ?? []).map((row) => JSON.parse(String(row.payload)) as Comic)
  }
  async saveProgress(progress: ReadingProgress) {
    await this.db().run('INSERT OR REPLACE INTO progress (comic_id,payload,updated_at) VALUES (?,?,?)', [
      progress.comicId, JSON.stringify(progress), progress.updatedAt,
    ])
    await this.db().run(
      'INSERT OR REPLACE INTO chapter_progress (chapter_id,comic_id,payload,updated_at) VALUES (?,?,?,?)',
      [progress.chapterId, progress.comicId, JSON.stringify(progress), progress.updatedAt],
    )
  }
  async getProgress(comicId: string) {
    const result = await this.db().query('SELECT payload FROM progress WHERE comic_id=?', [comicId])
    return result.values?.[0] ? JSON.parse(String(result.values[0].payload)) as ReadingProgress : null
  }
  async getReadingHistory() {
    const result = await this.db().query(
      `SELECT c.payload AS comic_payload, p.payload AS progress_payload
       FROM progress p JOIN comics c ON c.id=p.comic_id
       ORDER BY p.updated_at DESC`,
    )
    return (result.values ?? []).map((row) => ({
      comic: JSON.parse(String(row.comic_payload)) as Comic,
      progress: JSON.parse(String(row.progress_payload)) as ReadingProgress,
    }))
  }
  async getChapterHistory(comicId: string) {
    const result = await this.db().query(
      'SELECT payload FROM chapter_progress WHERE comic_id=? ORDER BY updated_at DESC',
      [comicId],
    )
    const chapters = (result.values ?? []).map(
      (row) => JSON.parse(String(row.payload)) as ReadingProgress,
    )
    if (chapters.length) return chapters
    const latest = await this.getProgress(comicId)
    return latest ? [latest] : []
  }
  async saveDownload(record: DownloadRecord) {
    await this.db().run('INSERT OR REPLACE INTO downloads (chapter_id,payload,updated_at) VALUES (?,?,?)', [
      record.chapterId, JSON.stringify(record), record.updatedAt,
    ])
  }
  async getDownloads() {
    const result = await this.db().query('SELECT payload FROM downloads ORDER BY updated_at DESC')
    return (result.values ?? []).map((row) => JSON.parse(String(row.payload)) as DownloadRecord)
  }
  async deleteDownload(chapterId: string) {
    await this.db().run('DELETE FROM downloads WHERE chapter_id=?', [chapterId])
  }
  async getSyncPayload() {
    const [favorites, progress, preferences] = await Promise.all([
      this.db().query('SELECT comic_id,enabled,updated_at FROM favorites'),
      this.db().query('SELECT payload FROM progress'),
      this.db().query('SELECT comic_id,enabled,quiet_start,quiet_end,updated_at FROM notification_preferences'),
    ])
    return {
      favorites: (favorites.values ?? []).map((row) => ({
        comicId: String(row.comic_id), enabled: Number(row.enabled) === 1, updatedAt: Number(row.updated_at),
      })),
      progress: (progress.values ?? []).map((row) => JSON.parse(String(row.payload)) as ReadingProgress),
      notificationPreferences: (preferences.values ?? []).map((row) => ({
        comicId: String(row.comic_id),
        enabled: Number(row.enabled) === 1,
        quietStart: row.quiet_start ? String(row.quiet_start) : null,
        quietEnd: row.quiet_end ? String(row.quiet_end) : null,
        updatedAt: Number(row.updated_at),
      })),
    }
  }
  async applySync(payload: SyncPayload) {
    for (const favorite of payload.favorites) {
      await this.db().run('INSERT OR REPLACE INTO favorites VALUES (?,?,?)', [
        favorite.comicId, favorite.enabled ? 1 : 0, favorite.updatedAt,
      ])
    }
    for (const progress of payload.progress) await this.saveProgress(progress)
    for (const preference of payload.notificationPreferences) {
      await this.db().run('INSERT OR REPLACE INTO notification_preferences VALUES (?,?,?,?,?)', [
        preference.comicId, preference.enabled ? 1 : 0, preference.quietStart, preference.quietEnd, preference.updatedAt,
      ])
    }
  }
  async addInbox(item: ReleaseInboxItem) {
    await this.db().run('INSERT OR REPLACE INTO inbox VALUES (?,?,?)', [item.id, JSON.stringify(item), item.createdAt])
  }
  async getInbox() {
    const result = await this.db().query('SELECT payload FROM inbox ORDER BY created_at DESC')
    return (result.values ?? []).map((row) => JSON.parse(String(row.payload)) as ReleaseInboxItem)
  }
}

type WebSchema = {
  comics: { key: string; value: Comic }
  favorites: { key: string; value: { comic: Comic; enabled: boolean; updatedAt: number } }
  progress: { key: string; value: ReadingProgress }
  chapterProgress: { key: string; value: ReadingProgress }
  downloads: { key: string; value: DownloadRecord }
  preferences: { key: string; value: SyncPayload['notificationPreferences'][number] }
  inbox: { key: string; value: ReleaseInboxItem }
}

class WebRepository implements LibraryRepository {
  private connection: IDBPDatabase<WebSchema> | null = null
  private opening: Promise<void> | null = null

  async initialize() {
    if (this.connection) return
    if (this.opening) return this.opening

    this.opening = this.open().finally(() => {
      this.opening = null
    })
    return this.opening
  }

  private async open() {
    let timeout: ReturnType<typeof setTimeout> | undefined
    const openRequest = openDB<WebSchema>(DB_NAME, 2, {
      upgrade(db) {
        for (const name of ['comics', 'favorites', 'progress', 'chapterProgress', 'downloads', 'preferences', 'inbox'] as const) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
        }
      },
      blocking: () => {
        this.connection?.close()
        this.connection = null
      },
      terminated: () => {
        this.connection = null
      },
    })

    try {
      this.connection = await Promise.race([
        openRequest,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error('Penyimpanan lokal terlalu lama merespons. Tutup tab KomikaID lain lalu coba lagi.'))
          }, WEB_DB_OPEN_TIMEOUT_MS)
        }),
      ])
    } catch (error) {
      openRequest.then((connection) => connection.close()).catch(() => undefined)
      throw error
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }
  private db() {
    if (!this.connection) throw new Error('Database not initialized')
    return this.connection
  }
  async cacheComics(comics: Comic[]) {
    const tx = this.db().transaction('comics', 'readwrite')
    for (const comic of comics) await tx.store.put(comic, comic.id)
    await tx.done
  }
  async getCachedComics() { return (await this.db().getAll('comics')).slice(-100).reverse() }
  async toggleFavorite(comic: Comic) {
    await this.cacheComics([comic])
    const current = await this.db().get('favorites', comic.id)
    const enabled = !current?.enabled
    await this.db().put('favorites', { comic, enabled, updatedAt: Date.now() }, comic.id)
    return enabled
  }
  async isFavorite(id: string) { return Boolean((await this.db().get('favorites', id))?.enabled) }
  async getFavorites() { return (await this.db().getAll('favorites')).filter((item) => item.enabled).map((item) => item.comic) }
  async saveProgress(progress: ReadingProgress) {
    const tx = this.db().transaction(['progress', 'chapterProgress'], 'readwrite')
    await Promise.all([
      tx.objectStore('progress').put(progress, progress.comicId),
      tx.objectStore('chapterProgress').put(progress, progress.chapterId),
    ])
    await tx.done
  }
  async getProgress(id: string) { return (await this.db().get('progress', id)) ?? null }
  async getReadingHistory() {
    const progress = (await this.db().getAll('progress')).sort((a, b) => b.updatedAt - a.updatedAt)
    const history = await Promise.all(progress.map(async (item) => {
      const comic = await this.db().get('comics', item.comicId)
      return comic ? { comic, progress: item } : null
    }))
    return history.filter((item): item is ReadingHistoryItem => item !== null)
  }
  async getChapterHistory(comicId: string) {
    const chapters = (await this.db().getAll('chapterProgress'))
      .filter((item) => item.comicId === comicId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
    if (chapters.length) return chapters
    const latest = await this.getProgress(comicId)
    return latest ? [latest] : []
  }
  async saveDownload(record: DownloadRecord) { await this.db().put('downloads', record, record.chapterId) }
  async getDownloads() { return (await this.db().getAll('downloads')).sort((a, b) => b.updatedAt - a.updatedAt) }
  async deleteDownload(id: string) { await this.db().delete('downloads', id) }
  async getSyncPayload(): Promise<SyncPayload> {
    return {
      favorites: (await this.db().getAll('favorites')).map((item) => ({
        comicId: item.comic.id, enabled: item.enabled, updatedAt: item.updatedAt,
      })),
      progress: await this.db().getAll('progress'),
      notificationPreferences: await this.db().getAll('preferences'),
    }
  }
  async applySync(payload: SyncPayload) {
    for (const favorite of payload.favorites) {
      const current = await this.db().get('favorites', favorite.comicId)
      const comic = current?.comic ?? await this.db().get('comics', favorite.comicId)
      if (comic && (!current || favorite.updatedAt >= current.updatedAt)) {
        await this.db().put('favorites', {
          comic, enabled: favorite.enabled, updatedAt: favorite.updatedAt,
        }, favorite.comicId)
      }
    }
    for (const progress of payload.progress) await this.saveProgress(progress)
    for (const preference of payload.notificationPreferences) {
      await this.db().put('preferences', preference, preference.comicId)
    }
  }
  async addInbox(item: ReleaseInboxItem) { await this.db().put('inbox', item, item.id) }
  async getInbox() { return (await this.db().getAll('inbox')).sort((a, b) => b.createdAt - a.createdAt) }
}

const repository: LibraryRepository = Capacitor.isNativePlatform() ? new NativeRepository() : new WebRepository()

export const library: LibraryRepository = {
  initialize: () => repository.initialize(),
  async cacheComics(comics) {
    await repository.initialize()
    return repository.cacheComics(comics)
  },
  async getCachedComics() {
    await repository.initialize()
    return repository.getCachedComics()
  },
  async toggleFavorite(comic) {
    await repository.initialize()
    const enabled = await repository.toggleFavorite(comic)
    emitLibraryChanged()
    return enabled
  },
  async isFavorite(comicId) {
    await repository.initialize()
    return repository.isFavorite(comicId)
  },
  async getFavorites() {
    await repository.initialize()
    return repository.getFavorites()
  },
  async saveProgress(progress) {
    await repository.initialize()
    await repository.saveProgress(progress)
    emitLibraryChanged()
  },
  async getProgress(comicId) {
    await repository.initialize()
    return repository.getProgress(comicId)
  },
  async getReadingHistory() {
    await repository.initialize()
    return repository.getReadingHistory()
  },
  async getChapterHistory(comicId) {
    await repository.initialize()
    return repository.getChapterHistory(comicId)
  },
  async saveDownload(record) {
    await repository.initialize()
    return repository.saveDownload(record)
  },
  async getDownloads() {
    await repository.initialize()
    return repository.getDownloads()
  },
  async deleteDownload(chapterId) {
    await repository.initialize()
    return repository.deleteDownload(chapterId)
  },
  async getSyncPayload() {
    await repository.initialize()
    return repository.getSyncPayload()
  },
  async applySync(payload) {
    await repository.initialize()
    return repository.applySync(payload)
  },
  async addInbox(item) {
    await repository.initialize()
    return repository.addInbox(item)
  },
  async getInbox() {
    await repository.initialize()
    return repository.getInbox()
  },
}

let initialization: Promise<void> | null = null

export function initializeLibrary() {
  initialization ??= library.initialize().catch((error) => {
    initialization = null
    throw error
  })
  return initialization
}
