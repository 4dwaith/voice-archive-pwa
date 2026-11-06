// @vitest-environment jsdom
import '../helpers/database'
import { configureStore } from '@reduxjs/toolkit'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { BookListOutput } from '../../src/api-client/generated/schemas'
import { useAppLocation } from '../../src/routing/navigation'
import { LibraryPage } from '../../src/pages/LibraryPage'
import { book } from '../api-client/fixtures/book'

// Supply query results at the service boundary. The page does not own fetching,
// contract validation, pagination storage, or the shelf's presentation details.
const query = vi.hoisted(() => ({
  result: {
    data: undefined as { pages: BookListOutput[] } | undefined,
    isFetching: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
  selection: { isFetchNextPageError: false },
}))

vi.mock('../../src/api-client/resources/booksApi', () => ({
  booksApi: {
    useLibraryBooksInfiniteQuery: () => query.result,
    endpoints: {
      libraryBooks: { select: () => () => query.selection },
    },
  },
}))

beforeEach(() => {
  query.result.data = undefined
  query.result.isFetching = false
  query.result.isError = false
  query.result.hasNextPage = false
  query.selection.isFetchNextPageError = false

  vi.clearAllMocks()
})

afterEach(cleanup)

function mount() {
  const store = configureStore({ reducer: () => ({}) })

  return render(
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/books/:bookId" element={<Destination />} />
    </Routes>,
    {
      wrapper: ({ children }) => (
        <Provider store={store}>
          <MemoryRouter>{children}</MemoryRouter>
        </Provider>
      ),
    },
  )
}

function Destination() {
  const location = useAppLocation()
  return (
    <p>
      {location.pathname}: {location.state?.book?.title}
    </p>
  )
}

const page: BookListOutput = { items: [book], offset: 0, limit: 24, total: 1 }

it('renders overlapping book IDs once, using the latest page values', () => {
  query.result.data = {
    pages: [
      page,
      {
        ...page,
        offset: 1,
        items: [
          { ...book, title: 'Updated book title' },
          { ...book, id: 2, title: 'ಗೀತಾಭಾವಧಾರೆ' },
        ],
      },
    ],
  }

  mount()

  expect(screen.getAllByRole('button', { name: /^Select / })).toHaveLength(2)
  expect(
    screen.getByRole('button', { name: 'Select Updated book title' }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Select ಗೀತಾಭಾವಧಾರೆ' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: `Select ${book.title}` }),
  ).toBeNull()
})

it('opens the selected book and passes library metadata to its route', () => {
  query.result.data = { pages: [page] }

  mount()

  const card = screen.getByRole('button', { name: `Select ${book.title}` })

  expect(card).toHaveAttribute('aria-pressed', 'false')

  fireEvent.click(card)

  expect(screen.getByText(`/books/${book.id}: ${book.title}`)).toBeVisible()
})

it('connects the shelf load action to the next-page request', () => {
  query.result.data = { pages: [page] }
  query.result.hasNextPage = true

  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Load more books' }))

  expect(query.result.fetchNextPage).toHaveBeenCalledOnce()
  expect(query.result.refetch).not.toHaveBeenCalled()
})

it.each([false, true])(
  'chooses the retry action for next-page failure = %s',
  (nextPageFailed) => {
    query.result.isError = true
    query.selection.isFetchNextPageError = nextPageFailed

    if (nextPageFailed) query.result.data = { pages: [page] }

    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(query.result.fetchNextPage).toHaveBeenCalledTimes(
      nextPageFailed ? 1 : 0,
    )
    expect(query.result.refetch).toHaveBeenCalledTimes(nextPageFailed ? 0 : 1)
  },
)

it('maps pending query state to initial loading or loading more', () => {
  query.result.isFetching = true

  const view = mount()

  expect(screen.getByRole('status')).toHaveTextContent('Loading your library')

  query.result.data = { pages: [page] }
  view.rerender(<LibraryPage />)

  expect(screen.getByRole('status')).toHaveTextContent('Loading more books')
})
