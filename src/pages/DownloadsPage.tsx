import {
  AlertCircle,
  CheckCircle2,
  Download,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { DownloadRecord } from '../../shared/contracts'
import { CatalogPagination } from '../components/CatalogPagination'
import { EmptyState } from '../components/States'
import { downloadManager } from '../lib/download-manager'

const PAGE_SIZE = 20

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function statusLabel(item: DownloadRecord) {
  if (item.status === 'complete') return 'Siap dibaca offline'
  if (item.status === 'paused') return 'Dijeda'
  if (item.status === 'failed') return item.error || 'Unduhan gagal'
  if (item.status === 'queued') return 'Menunggu'
  return 'Mengunduh'
}

export function DownloadsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const pageStart = useRef<HTMLElement>(null)
  const [items, setItems] = useState<DownloadRecord[]>([])
  const [storageBytes, setStorageBytes] = useState(0)

  const refresh = async () => {
    const [records, report] = await Promise.all([
      downloadManager.initialize(),
      downloadManager.getStorageReport(),
    ])
    setItems(records)
    setStorageBytes(report.downloadedBytes)
  }

  useEffect(() => {
    void refresh()
    return downloadManager.subscribe((record) => {
      setItems((current) => [record, ...current.filter((item) => item.chapterId !== record.chapterId)])
      void downloadManager.getStorageReport().then((report) => setStorageBytes(report.downloadedBytes))
    })
  }, [])

  const sorted = useMemo(() => [...items].sort((left, right) => {
    const rank = (status: DownloadRecord['status']) => (
      status === 'downloading' ? 0 : status === 'queued' ? 1 : status === 'paused' ? 2 : status === 'failed' ? 3 : 4
    )
    return rank(left.status) - rank(right.status) || right.updatedAt - left.updatedAt
  }), [items])
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const groups = [
    { title: 'Sedang diproses', items: visible.filter((item) => ['queued', 'downloading', 'paused'].includes(item.status)) },
    { title: 'Perlu perhatian', items: visible.filter((item) => item.status === 'failed') },
    { title: 'Siap offline', items: visible.filter((item) => item.status === 'complete') },
  ].filter((group) => group.items.length)

  const remove = async (chapterId: string) => {
    await downloadManager.remove(chapterId)
    setItems((current) => current.filter((entry) => entry.chapterId !== chapterId))
    const report = await downloadManager.getStorageReport()
    setStorageBytes(report.downloadedBytes)
  }
  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) return
    setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) })
    window.requestAnimationFrame(() => pageStart.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <section className="section page-section downloads-page" ref={pageStart}>
      <div className="section-heading downloads-heading">
        <div>
          <span className="eyebrow">Baca tanpa internet</span>
          <h1 className="page-title">Unduhan</h1>
        </div>
        {items.some((item) => item.status === 'complete') && (
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              await downloadManager.clearCompleted()
              await refresh()
            }}
          >
            Bersihkan
          </button>
        )}
      </div>
      {items.length > 0 && (
        <div className="download-summary" aria-label="Ringkasan penyimpanan">
          <strong>{formatBytes(storageBytes)}</strong>
          <span>{items.filter((item) => item.status === 'complete').length} chapter siap offline</span>
        </div>
      )}
      {items.length ? groups.map((group) => (
        <section className="download-group" key={group.title}>
          <h2>{group.title}</h2>
          <div className="download-list">
            {group.items.map((item) => {
              const percentage = item.totalPages ? Math.round(item.completedPages / item.totalPages * 100) : 0
              const icon = item.status === 'complete'
                ? <CheckCircle2 />
                : item.status === 'failed'
                  ? <AlertCircle />
                  : item.status === 'paused'
                    ? <Pause />
                    : <Download />
              const content = (
                <>
                  <div className={`download-icon is-${item.status}`}>{icon}</div>
                  <div className="download-copy">
                    <strong>{item.title}</strong>
                    <span>Chapter {item.chapterNumber} · {statusLabel(item)}</span>
                    {item.status !== 'complete' && (
                      <>
                        <div className="progress-track" aria-label={`${percentage}%`}>
                          <i style={{ width: `${percentage}%` }} />
                        </div>
                        <small>{item.completedPages}/{item.totalPages} halaman · {percentage}%</small>
                      </>
                    )}
                  </div>
                </>
              )
              return (
                <div className="download-row" key={item.chapterId}>
                  {item.status === 'complete' ? (
                    <Link className="download-main" to={`/reader/${item.chapterId}?comic=${item.comicId}`}>
                      {content}
                    </Link>
                  ) : <div className="download-main">{content}</div>}
                  <div className="download-actions">
                    {item.status === 'downloading' && (
                      <button type="button" onClick={() => void downloadManager.pause(item.chapterId)} aria-label="Jeda unduhan">
                        <Pause size={18} />
                      </button>
                    )}
                    {item.status === 'paused' && (
                      <button type="button" onClick={() => void downloadManager.resume(item.chapterId)} aria-label="Lanjutkan unduhan">
                        <Play size={18} />
                      </button>
                    )}
                    {item.status === 'failed' && (
                      <button type="button" onClick={() => void downloadManager.retry(item.chapterId)} aria-label="Coba ulang unduhan">
                        <RefreshCw size={18} />
                      </button>
                    )}
                    <button type="button" aria-label="Hapus unduhan" onClick={() => void remove(item.chapterId)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )) : (
        <EmptyState title="Belum ada unduhan" message="Unduh chapter dari halaman komik untuk membacanya kapan saja." />
      )}
      <CatalogPagination page={safePage} totalPages={totalPages} onPageChange={goToPage} label="Halaman unduhan" />
    </section>
  )
}
