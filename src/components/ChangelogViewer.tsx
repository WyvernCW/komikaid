import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'

type ReleaseInfo = {
  version: string
  tag: string
  title: string
  changelog: string
  publishedAt: string
}

const CACHE_KEY = 'komikaid.changelog-cache'
const CACHE_TTL = 10 * 60_000

function loadCached(): ReleaseInfo[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, expires } = JSON.parse(raw) as { data: ReleaseInfo[]; expires: number }
    return Date.now() < expires ? data : null
  } catch {
    return null
  }
}

function saveCache(releases: ReleaseInfo[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: releases, expires: Date.now() + CACHE_TTL }))
  } catch { /* empty */ }
}

function htmlToMarkdown(text: string): string {
  let result = text
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?(?:html|head|body|meta|link|title|base|col|colgroup|tbody|thead|tfoot)[^>]*>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  result = result
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, content) => {
      const inner = content.replace(/<code[^>]*>/gi, '').replace(/<\/code>/gi, '')
      return `\`\`\`\n${inner.trim()}\n\`\`\`\n\n`
    })

  result = result
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')

  result = result
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')

  result = result
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (_, content) => {
      const quoted = content.trim().replace(/\n/g, '\n> ')
      return `> ${quoted}\n\n`
    })

  result = result
    .replace(/<hr[^>]*>/gi, '---\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')

  result = result
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_: string, content: string) => {
      const items = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_li: string, liContent: string) => {
        return `- ${liContent.trim()}\n`
      })
      return `${items}\n`
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_: string, content: string) => {
      let idx = 0
      const items = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_li: string, liContent: string) => {
        idx++
        return `${idx}. ${liContent.trim()}\n`
      })
      return `${items}\n`
    })

  result = result
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<a[^>]*href='([^']*)'[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

  result = result
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src='([^']*)'[^>]*alt='([^']*)'[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')

  result = result.replace(/<[^>]+>/g, '')

  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))

  return result
    .replace(/\n{5,}/g, '\n\n\n')
    .trim()
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatDate(iso: string) {
  const d = new Date(iso)
  const day = d.getDate()
  const month = MONTHS[d.getMonth()]
  const year = d.getFullYear()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${day} ${month} ${year}, ${hours}:${minutes}`
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Hari ini'
  if (days === 1) return 'Kemarin'
  if (days < 30) return `${days} hari lalu`
  if (days < 365) return `${Math.floor(days / 30)} bulan lalu`
  return `${Math.floor(days / 365)} tahun lalu`
}

export default function ChangelogViewer({ onClose }: { onClose: () => void }) {
  const [releases, setReleases] = useState<ReleaseInfo[]>(loadCached() ?? [])
  const [loading, setLoading] = useState(!releases.length)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (releases.length) return
    let active = true
    setLoading(true)
    setError('')
    api.releases()
      .then((data) => {
        if (!active) return
        const parsed = data as { releases: ReleaseInfo[] }
        if (!parsed.releases?.length) {
          setError('Belum ada rilis yang tersedia.')
          return
        }
        saveCache(parsed.releases)
        setReleases(parsed.releases)
      })
      .catch(() => {
        if (active) setError('Gagal memuat riwayat rilis. Periksa koneksi.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [releases.length])

  useEffect(() => {
    if (!listRef.current || !releases.length) return
    const btn = listRef.current.querySelector('.is-current') as HTMLElement | null
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [index, releases.length])

  const current = releases[index]
  const hasPrev = index > 0
  const hasNext = index < releases.length - 1
  const goTo = (next: number) => {
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  return (
    <div className="changelog-backdrop" role="presentation" onMouseDown={(e) => {
      if (e.currentTarget === e.target) onClose()
    }}>
      <section className="changelog-sheet" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
        <header>
          <div>
            <span className="eyebrow">RIWAYAT RILIS</span>
            <h2 id="changelog-title">Catatan Rilis</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </button>
        </header>

        {loading && (
          <div className="changelog-loading">
            <div className="changelog-skeleton" />
            <div className="changelog-skeleton" style={{ width: '65%' }} />
            <div className="changelog-skeleton" style={{ width: '80%' }} />
          </div>
        )}

        {error && !loading && (
          <div className="changelog-error">
            <p>{error}</p>
          </div>
        )}

        {current && !loading && (
          <>
            <div className="changelog-nav">
              <button
                type="button"
                className="changelog-nav__arrow"
                disabled={!hasPrev}
                onClick={() => goTo(index - 1)}
                aria-label="Rilis sebelumnya"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="changelog-nav__versions" ref={listRef}>
                {releases.map((r, i) => (
                  <button
                    key={r.tag}
                    type="button"
                    className={
                      'changelog-nav__pill'
                      + (i === index ? ' is-current' : '')
                      + (i === 0 ? ' is-latest' : '')
                    }
                    onClick={() => goTo(i)}
                    title={`v${r.version} — ${relativeTime(r.publishedAt)}`}
                  >
                    {r.version}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="changelog-nav__arrow"
                disabled={!hasNext}
                onClick={() => goTo(index + 1)}
                aria-label="Rilis berikutnya"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="changelog-release-header">
              <h3 className="changelog-release-header__title">{current.title}</h3>
              <div className="changelog-release-header__meta">
                <span>{relativeTime(current.publishedAt)}</span>
                <span className="changelog-release-header__sep">·</span>
                <time dateTime={current.publishedAt}>{formatDate(current.publishedAt)}</time>
              </div>
            </div>

            <div className="changelog-body" key={current.tag} data-direction={direction}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
                }}
              >
                {htmlToMarkdown(current.changelog)}
              </ReactMarkdown>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
