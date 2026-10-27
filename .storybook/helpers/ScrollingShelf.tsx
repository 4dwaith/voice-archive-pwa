import { useCallback, useEffect, useRef, useState } from 'react'
import { BookShelf } from '../../src/components/molecules/BookShelf/BookShelf'
import { scrollingBooks } from '../../src/mock-data/books'

const batchSize = 12
const loadDelay = 2500

// Storybook-only controller: demonstrate real observer-driven transitions without
// a backend. The first next-page request can fail; retry then recovers.
export function ScrollingShelf({
  failNextLoad = false,
}: {
  failNextLoad?: boolean
}) {
  const [count, setCount] = useState(batchSize)
  const [selectedBookId, selectBook] = useState<number | null>(null)
  const [isLoadingMore, setLoadingMore] = useState(false)
  const [hasError, setError] = useState(false)

  const pending = useRef(false)
  const shouldFail = useRef(failNextLoad)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  const loadMore = useCallback(() => {
    if (pending.current || count >= scrollingBooks.length) return

    pending.current = true
    setLoadingMore(true)
    setError(false)

    timer.current = setTimeout(() => {
      pending.current = false
      timer.current = null
      setLoadingMore(false)

      if (shouldFail.current) {
        shouldFail.current = false
        setError(true)
        return
      }

      setCount((value) => Math.min(value + batchSize, scrollingBooks.length))
    }, loadDelay)
  }, [count])

  return (
    <>
      <aside
        className="mx-5 mt-6 rounded-2xl bg-accent-soft p-5 text-ink sm:mx-8"
        aria-label="Infinite scroll demonstration"
      >
        <p className="text-xl font-bold">Scroll down to explore the library</p>

        <p className="mt-2 text-lg">
          {failNextLoad
            ? 'The next batch takes a moment, then fails. Try again to continue loading.'
            : 'Each new batch takes a moment to arrive. Keep scrolling until the shelf is complete.'}
        </p>

        <p className="mt-3 text-lg font-semibold" role="status">
          Showing {count} of {scrollingBooks.length} books
        </p>
      </aside>

      <BookShelf
        books={scrollingBooks.slice(0, count)}
        total={scrollingBooks.length}
        selectedBookId={selectedBookId}
        onSelect={selectBook}
        isLoadingMore={isLoadingMore}
        hasMore={count < scrollingBooks.length}
        hasError={hasError}
        onLoadMore={loadMore}
        onRetry={loadMore}
      />
    </>
  )
}
