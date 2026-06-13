import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Home, Search, SunMedium } from 'lucide-react'
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { filterChapters } from '../lib/catalog-utils'
import {
  areReaderControlsVisible,
  isReaderDoublePress,
  toggleReaderControls,
  type TapPoint,
} from '../lib/reader-controls'
import { library } from '../lib/store'
import { useUiStore } from '../lib/ui-store'

export function ReaderPage() {
  const { chapterId = '' } = useParams()
  const [search] = useSearchParams()
  const comicId = search.get('comic') ?? ''
  const brightness = useUiStore((state) => state.brightness)
  const setBrightness = useUiStore((state) => state.setBrightness)
  const chapter = useQuery({ queryKey: ['chapter', chapterId], queryFn: () => api.chapter(chapterId) })
  const comic = useQuery({
    queryKey: ['comic', comicId],
    queryFn: () => api.comic(comicId),
    enabled: Boolean(comicId),
  })
  const observer = useRef<IntersectionObserver | null>(null)
  const controlsElement = useRef<HTMLElement | null>(null)
  const currentChapterOption = useRef<HTMLAnchorElement | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const lastPress = useRef<TapPoint | null>(null)
  const [controls, setControls] = useState({ chapterId, visible: false })
  const [picker, setPicker] = useState({ chapterId, open: false })
  const [chapterSearch, setChapterSearch] = useState('')
  const [pickerBottom, setPickerBottom] = useState(280)
  const controlsVisible = areReaderControlsVisible(controls, chapterId)
  const pickerOpen = picker.chapterId === chapterId && picker.open
  const allChapters = useQuery({
    queryKey: ['all-chapters', comicId],
    queryFn: () => api.allChapters(comicId),
    enabled: controlsVisible && Boolean(comicId),
    staleTime: 10 * 60_000,
  })
  const chapterOptions = (() => {
    const items = allChapters.data?.data ?? []
    if (chapterSearch) return filterChapters(items, chapterSearch, items.length)
    return items
  })()
  const hideControls = useCallback(
    () => {
      setControls({ chapterId, visible: false })
      setPicker({ chapterId, open: false })
      setChapterSearch('')
    },
    [chapterId],
  )
  const toggleControls = useCallback(() => {
    setControls((current) => toggleReaderControls(current, chapterId))
    setPicker({ chapterId, open: false })
    setChapterSearch('')
  }, [chapterId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideControls()
      if (event.key.toLowerCase() === 'c' && !(event.target instanceof HTMLInputElement)) {
        toggleControls()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hideControls, toggleControls])

  useEffect(() => {
    if (comic.data) library.cacheComics([comic.data])
  }, [comic.data])

  useEffect(() => {
    if (!pickerOpen || chapterSearch || allChapters.isPending) return
    window.requestAnimationFrame(() => {
      currentChapterOption.current?.scrollIntoView({ block: 'center' })
    })
  }, [allChapters.isPending, chapterSearch, pickerOpen])

  useEffect(() => {
    if (!pickerOpen) return

    const positionPicker = () => {
      const controlsTop = controlsElement.current?.getBoundingClientRect().top
      if (controlsTop === undefined) return
      setPickerBottom(Math.max(16, window.innerHeight - controlsTop + 8))
    }
    const frame = window.requestAnimationFrame(positionPicker)
    const resizeObserver = new ResizeObserver(positionPicker)
    if (controlsElement.current) resizeObserver.observe(controlsElement.current)
    window.addEventListener('resize', positionPicker)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', positionPicker)
    }
  }, [pickerOpen])

  useEffect(() => {
    if (!chapter.data || !comicId) return
    const chapterData = chapter.data
    const pages = document.querySelectorAll<HTMLImageElement>('[data-page-index]')
    let cancelled = false

    const initializeProgress = async () => {
      const progress = await library.getProgress(comicId)
      if (cancelled) return
      if (progress?.chapterId === chapterId) {
        const target = pages[Math.min(progress.pageIndex, pages.length - 1)]
        if (target && !target.complete) {
          await Promise.race([
            new Promise<void>((resolve) => {
              target.addEventListener('load', () => resolve(), { once: true })
              target.addEventListener('error', () => resolve(), { once: true })
            }),
            new Promise<void>((resolve) => window.setTimeout(resolve, 2_500)),
          ])
        }
        if (!cancelled) target?.scrollIntoView({ block: 'start' })
      }
      if (cancelled) return

      observer.current = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => (
            Math.abs(a.boundingClientRect.top + a.boundingClientRect.height / 2 - window.innerHeight / 2)
            - Math.abs(b.boundingClientRect.top + b.boundingClientRect.height / 2 - window.innerHeight / 2)
          ))[0]
        if (!visible) return
        const pageIndex = Number((visible.target as HTMLElement).dataset.pageIndex)
        library.saveProgress({
          comicId,
          chapterId,
          chapterNumber: chapterData.number,
          pageIndex,
          pageCount: chapterData.pages.length,
          updatedAt: Date.now(),
        })
      }, { rootMargin: '-49% 0px -49% 0px', threshold: 0 })
      pages.forEach((page) => observer.current?.observe(page))
    }

    initializeProgress()
    return () => {
      cancelled = true
      observer.current?.disconnect()
    }
  }, [chapter.data, chapterId, comicId])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return
    const travel = Math.hypot(
      event.clientX - pointerStart.current.x,
      event.clientY - pointerStart.current.y,
    )
    pointerStart.current = null
    if (travel > 28) return

    const now = performance.now()
    const previous = lastPress.current
    const current = { time: now, x: event.clientX, y: event.clientY }
    if (isReaderDoublePress(previous, current)) {
      lastPress.current = null
      toggleControls()
      return
    }
    lastPress.current = current
  }

  if (!chapter.data) return <div className="reader-loading">Menyiapkan halaman...</div>
  return (
    <div
      className="reader"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <main
        className="reader-pages"
        style={{ filter: `brightness(${brightness}%)` }}
        aria-label={`Chapter ${chapter.data.number}, ${chapter.data.pages.length} halaman. Klik dua kali untuk menampilkan kontrol.`}
      >
        {chapter.data.pages.map((page, index) => <img key={page} data-page-index={index} src={api.image(page)} alt={`Halaman ${index + 1}`} loading={index < 3 ? 'eager' : 'lazy'} />)}
      </main>
      {pickerOpen && (
        <section
          className="reader-chapter-picker__panel"
          style={{
            bottom: `${pickerBottom}px`,
            maxHeight: `min(320px, calc(100vh - ${pickerBottom + 16}px))`,
          }}
          aria-label="Daftar chapter"
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <label>
            <Search size={17} aria-hidden="true" />
            <input
              value={chapterSearch}
              onChange={(event) => setChapterSearch(event.target.value)}
              placeholder="Cari chapter 1..."
              aria-label="Cari chapter di pembaca"
            />
          </label>
          {!allChapters.isPending && (
            <small className="reader-chapter-picker__count">
              {chapterOptions.length} dari {allChapters.data?.data.length ?? 0} chapter
            </small>
          )}
          <div className="reader-chapter-picker__list">
            {allChapters.isPending ? (
              <span className="reader-chapter-picker__empty">Memuat chapter...</span>
            ) : chapterOptions.length ? chapterOptions.map((item) => (
              <Link
                key={item.id}
                ref={item.id === chapterId ? currentChapterOption : undefined}
                to={`/reader/${item.id}?comic=${comicId}`}
                className={item.id === chapterId ? 'is-current' : ''}
                onClick={() => {
                  hideControls()
                  setChapterSearch('')
                }}
              >
                <strong>Chapter {item.number}</strong>
                <span>{item.title || 'Tanpa judul'}</span>
              </Link>
            )) : (
              <span className="reader-chapter-picker__empty">Chapter tidak ditemukan.</span>
            )}
          </div>
        </section>
      )}
      <aside
        ref={controlsElement}
        className={`reader-controls${controlsVisible ? ' is-visible' : ''}`}
        aria-label="Kontrol pembaca"
        aria-hidden={!controlsVisible}
        inert={!controlsVisible}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <div className="reader-controls__status">
          <span>
            <small className="reader-controls__title">
              {comic.data?.title ?? 'Memuat judul komik...'}
            </small>
            <strong>Chapter {chapter.data.number}</strong>
            <small>{chapter.data.pages.length} halaman</small>
          </span>
          <label>
            <SunMedium size={18} aria-hidden="true" />
            <input
              type="range"
              min="45"
              max="110"
              value={brightness}
              onChange={(event) => setBrightness(Number(event.target.value))}
              aria-label="Kecerahan"
              tabIndex={controlsVisible ? 0 : -1}
            />
          </label>
        </div>
        <div className={`reader-chapter-picker${pickerOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="reader-chapter-picker__toggle"
            aria-expanded={pickerOpen}
            onClick={() => setPicker((current) => ({
              chapterId,
              open: current.chapterId === chapterId ? !current.open : true,
            }))}
            tabIndex={controlsVisible ? 0 : -1}
          >
            <BookOpen size={18} aria-hidden="true" />
            <span>Pilih chapter</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="reader-controls__actions" aria-label="Navigasi chapter">
          {chapter.data.previousChapterId ? (
            <Link
              to={`/reader/${chapter.data.previousChapterId}?comic=${comicId}`}
              aria-label="Buka chapter sebelumnya"
              tabIndex={controlsVisible ? 0 : -1}
              onClick={hideControls}
            >
              <ChevronLeft aria-hidden="true" />
              <span>Sebelumnya</span>
            </Link>
          ) : (
            <button type="button" disabled aria-label="Tidak ada chapter sebelumnya">
              <ChevronLeft aria-hidden="true" />
              <span>Sebelumnya</span>
            </button>
          )}
          <Link
            to="/"
            state={{ scrollToTop: true }}
            aria-label="Kembali ke beranda"
            tabIndex={controlsVisible ? 0 : -1}
            onClick={hideControls}
          >
            <Home aria-hidden="true" />
            <span>Beranda</span>
          </Link>
          {chapter.data.nextChapterId ? (
            <Link
              to={`/reader/${chapter.data.nextChapterId}?comic=${comicId}`}
              aria-label="Buka chapter berikutnya"
              tabIndex={controlsVisible ? 0 : -1}
              onClick={hideControls}
            >
              <ChevronRight aria-hidden="true" />
              <span>Berikutnya</span>
            </Link>
          ) : (
            <button type="button" disabled aria-label="Tidak ada chapter berikutnya">
              <ChevronRight aria-hidden="true" />
              <span>Berikutnya</span>
            </button>
          )}
        </nav>
      </aside>
    </div>
  )
}
