import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReleaseInboxItem } from '../../shared/contracts'
import { EmptyState } from '../components/States'
import { library } from '../lib/store'

export function InboxPage() {
  const [items, setItems] = useState<ReleaseInboxItem[]>([])
  useEffect(() => { library.getInbox().then(setItems) }, [])
  return <section className="section page-section"><span className="eyebrow">Pembaruan</span><h1 className="page-title">Kotak rilis</h1>{items.length ? <div className="inbox-list">{items.map((item) => <Link key={item.id} to={`/reader/${item.chapterId}?comic=${item.comicId}`}><strong>{item.title}</strong><span>Chapter {item.chapterNumber} sudah tersedia</span></Link>)}</div> : <EmptyState title="Belum ada kabar baru" message="Rilis dari komik favorit akan muncul di sini." />}</section>
}
