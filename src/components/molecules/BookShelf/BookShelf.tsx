import { useEffect, useRef } from 'react'
import type { BookResponseOutput } from '../../../api-client/generated/schemas'
import { Book } from '../../atoms/Book/Book'

export type BookShelfProps = {
  books: BookResponseOutput[]
  total?: number
  isLoading?: boolean
  isLoadingMore?: boolean
  hasMore?: boolean
  hasError?: boolean
  selectedBookId: number | null
  onSelect: (id: number) => void
  onLoadMore: () => void
  onRetry: () => void
}

const actionClass =
  'min-h-12 rounded-xl bg-accent px-6 py-3 text-lg font-bold text-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-accent'

export function BookShelf({
  books,
  total,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  hasError = false,
  selectedBookId,
  onSelect,
  onLoadMore,
  onRetry,
}: BookShelfProps) {
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (
      !hasMore ||
      isLoading ||
      isLoadingMore ||
      hasError ||
      !sentinel.current ||
      !('IntersectionObserver' in window)
    ) {
      return
    }

    // One request per observer; re-arm after the next batch arrives.
    let requested = false

    const observer = new IntersectionObserver(
      (entries) => {
        if (!requested && entries.some((entry) => entry.isIntersecting)) {
          requested = true
          onLoadMore()
        }
      },
      { rootMargin: '240px' },
    )

    observer.observe(sentinel.current)

    return () => observer.disconnect()
  }, [hasMore, isLoading, isLoadingMore, hasError, onLoadMore])

  const selectedBook = books.find((book) => book.id === selectedBookId)

  return (
    <section
      className="mx-auto px-5 py-8 sm:px-8"
      aria-labelledby="books-heading"
    >
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id="books-heading" className="text-3xl font-bold tracking-tight">
          Books
        </h2>

        {total !== undefined && (
          <p className="text-lg font-medium text-muted">
            {total} {total === 1 ? 'book' : 'books'}
          </p>
        )}
      </div>

      {books.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-x-6 gap-y-9">
          {books.map((book, index) => (
            <Book
              key={book.id}
              book={book}
              bookIndex={index}
              isSelected={book.id === selectedBookId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {isLoading && (
        <div
          className="min-h-80 rounded-2xl border-2 border-ink/10 bg-white p-8"
          role="status"
        >
          <p className="text-xl font-semibold">Loading your library…</p>

          <p className="mt-2 text-lg text-muted">
            Your books will appear here.
          </p>
        </div>
      )}

      {!isLoading && hasError && (
        <div
          className="my-8 rounded-2xl border-2 border-ink/15 bg-white p-6"
          role="alert"
        >
          <h3 className="text-xl font-bold">
            {books.length
              ? 'More books couldn’t be loaded'
              : 'Your library couldn’t be loaded'}
          </h3>

          <p className="my-4 text-lg text-muted">
            Please check your connection and try again.
          </p>

          <button className={actionClass} onClick={onRetry} type="button">
            Try again
          </button>
        </div>
      )}

      {!isLoading && !hasError && books.length === 0 && (
        <div className="min-h-64 rounded-2xl border-2 border-dashed border-ink/20 p-8">
          <h3 className="text-2xl font-bold">Your shelf is waiting</h3>

          <p className="mt-3 text-lg text-muted">
            There are no books in your library yet.
          </p>
        </div>
      )}

      <div
        ref={sentinel}
        className="mt-8 flex min-h-20 items-center justify-center text-center"
        aria-live="polite"
      >
        {isLoadingMore ? (
          <p
            role="status"
            className="flex items-center gap-3 text-lg font-semibold text-muted"
          >
            <span
              aria-hidden="true"
              className="size-6 shrink-0 animate-spin rounded-full border-4 border-accent/20 border-t-accent motion-reduce:animate-none"
            />
            Loading more books…
          </p>
        ) : (
          !isLoading &&
          !hasError &&
          books.length > 0 &&
          (hasMore ? (
            <div className="flex flex-col items-center gap-3">
              <p id="manual-load-hint" className="text-lg text-muted">
                Books load automatically as you scroll. If they don’t, use the
                button below.
              </p>

              <button
                type="button"
                className={actionClass}
                onClick={onLoadMore}
                aria-describedby="manual-load-hint"
              >
                Load more books
              </button>
            </div>
          ) : (
            <p className="w-full border-t-2 border-ink/10 pt-6 text-lg text-muted">
              You’ve reached the end of your library.
            </p>
          ))
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {selectedBook ? `${selectedBook.title} selected` : ''}
      </p>
    </section>
  )
}
