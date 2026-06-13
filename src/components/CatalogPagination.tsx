import { ArrowLeft, ArrowRight } from 'lucide-react'
import { buildPageItems } from '../lib/catalog-utils'

type CatalogPaginationProps = {
  page: number
  totalPages: number
  onPageChange(page: number): void
  label: string
}

export function CatalogPagination({
  page,
  totalPages,
  onPageChange,
  label,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null
  const pageItems = buildPageItems(page, totalPages)

  return (
    <nav className="catalog-pagination" aria-label={label}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Halaman sebelumnya"
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      {pageItems.map((item, index) => item === 'ellipsis' ? (
        <span key={`ellipsis-${index}`} aria-hidden="true">...</span>
      ) : (
        <button
          type="button"
          key={item}
          className={item === page ? 'is-current' : ''}
          aria-current={item === page ? 'page' : undefined}
          onClick={() => onPageChange(item)}
        >
          {item}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Halaman berikutnya"
      >
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </nav>
  )
}
