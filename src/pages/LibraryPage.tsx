import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { readSavedLibrary } from '../data/libraryRepository'
import { useAppNavigate } from '../routing/navigation'
import { useSelector } from 'react-redux'
import { booksApi } from '../api-client/resources/booksApi'
import { BookShelf } from '../components/molecules/BookShelf/BookShelf'

const selectLibrary = booksApi.endpoints.libraryBooks.select()

export function LibraryPage() {
  const navigate = useAppNavigate()

  const query = booksApi.useLibraryBooksInfiniteQuery(undefined, {
    refetchOnMountOrArgChange: true,
  })
  const saved = useLiveQuery(readSavedLibrary)
  const isShowingSaved = !query.data && !!saved?.catalog

  const nextPageFailed = useSelector(selectLibrary).isFetchNextPageError

  // Offset pages may overlap when records change between requests.
  const books = query.data
    ? [
        ...new Map(
          query.data?.pages.flatMap((page) =>
            page.items.map((book) => [book.id, book] as const),
          ),
        ).values(),
      ]
    : (saved?.books ?? [])

  const { isFetching, isError, fetchNextPage, refetch } = query

  const loadMore = useCallback(() => {
    if (!isFetching && !isError) void fetchNextPage()
  }, [isFetching, isError, fetchNextPage])

  const retry = () => {
    if (nextPageFailed) void fetchNextPage()
    else void refetch()
  }

  return (
    <BookShelf
      books={books}
      total={query.data?.pages[0]?.total ?? saved?.catalog?.total}
      savedCatalogStatus={
        isShowingSaved
          ? saved.catalog?.complete
            ? 'complete'
            : 'partial'
          : undefined
      }
      isLoading={isFetching && !query.data && !isShowingSaved}
      isLoadingMore={isFetching && (!!query.data || isShowingSaved)}
      hasMore={query.hasNextPage}
      hasError={isError}
      selectedBookId={null}
      onSelect={(id) => {
        const book = books.find((book) => book.id === id)
        if (!book) return

        void navigate(`/books/${id}`, {
          state: {
            book: {
              id: book.id,
              cover_url: book.cover_url,
              title: book.title,
            },
          },
        })
      }}
      onLoadMore={loadMore}
      onRetry={retry}
    />
  )
}
