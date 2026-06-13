import { CheckCircle2, Download, Pause, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DownloadRecord } from '../../shared/contracts'
import { EmptyState } from '../components/States'
import { downloadManager } from '../lib/download-manager'
import { library } from '../lib/store'

export function DownloadsPage() {
  const [items, setItems] = useState<DownloadRecord[]>([])
  useEffect(() => {
    library.getDownloads().then(setItems)
    return downloadManager.subscribe((record) => {
      setItems((current) => [record, ...current.filter((item) => item.chapterId !== record.chapterId)])
    })
  }, [])
  return <section className="section page-section"><span className="eyebrow">Baca tanpa internet</span><h1 className="page-title">Unduhan</h1>{items.length ? <div className="download-list">{items.map((item) => <div className="download-row" key={item.chapterId}><div className="download-icon">{item.status === 'complete' ? <CheckCircle2 /> : item.status === 'paused' ? <Pause /> : <Download />}</div><div><strong>{item.title}</strong><span>Chapter {item.chapterNumber} · {item.completedPages}/{item.totalPages} halaman</span><div className="progress-track"><i style={{ width: `${item.totalPages ? item.completedPages / item.totalPages * 100 : 0}%` }} /></div></div><button aria-label="Hapus unduhan" onClick={async () => { await downloadManager.remove(item.chapterId); setItems((current) => current.filter((entry) => entry.chapterId !== item.chapterId)) }}><Trash2 size={19} /></button></div>)}</div> : <EmptyState title="Belum ada unduhan" message="Unduh chapter dari halaman komik untuk membacanya kapan saja." />}</section>
}
