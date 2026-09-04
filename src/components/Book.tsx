import { useState } from 'react'
import type { BookModel } from '../models/book'

type BookProps = {
  book: BookModel
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

export function Book({ book, isSelected, onSelect }: BookProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showCoverImage = Boolean(book.coverImage) && !imageFailed
  const colorIndex =
    ((book.id - 1) % fallbackCoverColors.length + fallbackCoverColors.length) %
    fallbackCoverColors.length
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
              src={book.coverImage}
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <>
              <span className="text-lg font-semibold opacity-90">
                Voice Archive
              </span>
              <span
                aria-hidden="true"
                className="text-5xl font-black opacity-20"
              >
                {book.mark}
              </span>
              <span className="text-2xl font-bold leading-tight">
                {book.title}
              </span>
            </>
          )}
        </span>
      </button>

      <h2 className="mt-5 text-xl font-bold leading-snug">{book.title}</h2>
    </article>
  )
}
