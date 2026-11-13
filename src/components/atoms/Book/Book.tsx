import { useState } from 'react'
import type { BookResponseOutput } from '../../../api-client/generated/schemas'
import { titleInitials } from './titleInitials'

type BookProps = {
  book: BookResponseOutput
  bookIndex?: number
  isSelected: boolean
  onSelect: (bookId: number) => void
}

const fallbackCoverColors = [
  'bg-[#b94133] text-white',
  'bg-[#23655d] text-white',
  'bg-[#76528b] text-white',
  'bg-[#c18422] text-[#17130b]',
  'bg-[#334b38] text-white',
  'bg-[#31577a] text-white',
] as const

export function Book({ book, bookIndex, isSelected, onSelect }: BookProps) {
  const [failedCoverImage, setFailedCoverImage] = useState<string | null>()

  const showCoverImage = !!book.cover_url && book.cover_url !== failedCoverImage

  const colorIndex = (bookIndex ?? 0) % fallbackCoverColors.length
  const fallbackColor = fallbackCoverColors[colorIndex]

  return (
    <article className="rounded-2xl">
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={`Select ${book.title}`}
        onClick={() => onSelect(book.id)}
        className="group block w-full rounded-2xl text-left focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <span
          className={`relative flex aspect-3/4 flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-[0_12px_30px_rgba(24,32,48,0.15)] transition group-hover:-translate-y-1 group-hover:shadow-[0_18px_36px_rgba(24,32,48,0.22)] motion-reduce:transform-none ${fallbackColor} ${isSelected ? 'ring-4 ring-accent ring-offset-4 ring-offset-page' : ''}`}
        >
          {showCoverImage ? (
            <img
              crossOrigin="use-credentials"
              src={book.cover_url ?? undefined}
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setFailedCoverImage(book.cover_url)}
            />
          ) : (
            <>
              <span
                aria-hidden="true"
                className="text-5xl font-black opacity-20"
              >
                {titleInitials(book.title)}
              </span>

              <span className="line-clamp-4 text-2xl font-bold leading-tight wrap-anywhere">
                {book.title}
              </span>
            </>
          )}
        </span>
      </button>

      <h3 className="mt-5 text-xl font-bold leading-snug wrap-anywhere">
        {book.title}
      </h3>
      {book.series_title && (
        <p className="mt-1 text-base leading-snug text-ink wrap-anywhere">
          {book.series_title}
          {book.series_index != null && ` · Book ${book.series_index}`}
        </p>
      )}
    </article>
  )
}
