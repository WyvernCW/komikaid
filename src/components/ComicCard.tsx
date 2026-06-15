import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Chapter, Comic, ReadingProgress } from '../../shared/contracts'
import { api } from '../lib/api'
import { formatUpdateAge } from '../lib/catalog-utils'

type ComicCardProps = {
  comic: Comic
  href?: string
  progress?: ReadingProgress
  onClick?: () => void
  priority?: boolean
  releases?: Chapter[]
<<<<<<< HEAD
}

export function ComicCard({ comic, href = `/comic/${comic.id}`, progress, onClick, priority = false, releases }: ComicCardProps) {
  const queryClient = useQueryClient()
  const chapterRows = releases ?? (
    comic.latestChapterNumber == null ? [] : [{
=======
  releasesLoading?: boolean
}

function buildChapterRows(comic: Comic, releases: Chapter[] | undefined): Chapter[] {
  const fromApi = releases?.length ? releases : []
  const rows = fromApi.slice(0, 2)
  if (rows.length < 2 && comic.latestChapterNumber != null && !rows.some((c) => c.number === comic.latestChapterNumber)) {
    rows.push({
>>>>>>> 3e83d39 (some changes on mobile.)
      id: comic.latestChapterId ?? comic.id,
      comicId: comic.id,
      number: comic.latestChapterNumber,
      title: '',
      releaseDate: comic.latestChapterTime ?? '',
      views: 0,
<<<<<<< HEAD
    }]
  )
=======
    })
  }
  return rows
}

export function ComicCard({ comic, href = `/comic/${comic.id}`, progress, onClick, priority = false, releases, releasesLoading }: ComicCardProps) {
  const queryClient = useQueryClient()
  const chapterLoading = releasesLoading || releases === undefined
  const chapterRows = chapterLoading ? [] : buildChapterRows(comic, releases)
  const hasChapters = chapterRows.length > 0
>>>>>>> 3e83d39 (some changes on mobile.)
  const content = (
    <>
      <div className="comic-cover">
        <img
          src={api.image(comic.coverUrl)}
          alt={`Sampul ${comic.title}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </div>
      <div className="comic-copy">
        {onClick ? (
          <Link
            to={href}
            state={{ comic }}
            className="comic-title-link"
            onClick={(event) => {
              event.stopPropagation()
              queryClient.setQueryData(['comic', comic.id], comic)
            }}
          >
            <h3>{comic.title}</h3>
          </Link>
        ) : <h3>{comic.title}</h3>}
<<<<<<< HEAD
        {chapterRows.length > 0 && (
=======
        {chapterLoading ? (
          <div className="comic-releases comic-releases-loading">
            <span><strong>—</strong><em>Memuat...</em></span>
          </div>
        ) : hasChapters ? (
>>>>>>> 3e83d39 (some changes on mobile.)
          <div className="comic-releases">
            {chapterRows.map((chapter) => {
              const age = formatUpdateAge(chapter.releaseDate)
              return (
                <span key={chapter.id}>
                  <strong>Chapter {chapter.number}</strong>
                  <em>{age?.isNew ? 'Baru!' : age?.label ?? 'Terbaru'}</em>
                </span>
              )
            })}
          </div>
<<<<<<< HEAD
        )}
=======
        ) : null}
>>>>>>> 3e83d39 (some changes on mobile.)
        {progress && (
          <strong className="reading-progress">
            Lanjut Ch. {progress.chapterNumber} · Hal. {progress.pageIndex + 1}
          </strong>
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <div
        className="comic-card comic-card-button"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
          }
        }}
      >
        {content}
      </div>
    )
  }
  return (
    <Link
      to={href}
      state={{ comic }}
      className="comic-card"
      onPointerDown={() => queryClient.setQueryData(['comic', comic.id], comic)}
      onClick={() => queryClient.setQueryData(['comic', comic.id], comic)}
    >
      {content}
    </Link>
  )
}
