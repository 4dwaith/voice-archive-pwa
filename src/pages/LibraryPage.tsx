import { useCallback, useState } from 'react'
import { useSelector } from 'react-redux'
import { booksApi } from '../api-client/resources/booksApi'
import { BookShelf } from '../components/BookShelf/BookShelf'

const selectLibrary = booksApi.endpoints.libraryBooks.select()

export function LibraryPage() {
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null)

  const query = booksApi.useLibraryBooksInfiniteQuery()

  const nextPageFailed = useSelector(selectLibrary).isFetchNextPageError

  // Offset pages may overlap when records change between requests.
  const books = [
    ...new Map(
      query.data?.pages.flatMap((page) =>
        page.items.map((book) => [book.id, book] as const),
      ),
    ).values(),
  ]

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
      total={query.data?.pages[0]?.total}
      isLoading={isFetching && !query.data}
      isLoadingMore={isFetching && !!query.data}
      hasMore={query.hasNextPage}
      hasError={isError}
      selectedBookId={selectedBookId}
      onSelect={setSelectedBookId}
      onLoadMore={loadMore}
      onRetry={retry}
    />
  )
}
