// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import {
  BookShelf,
  type BookShelfProps,
} from '../../src/components/molecules/BookShelf/BookShelf'
import { book } from '../api-client/fixtures/book'

afterEach(cleanup)

const props: BookShelfProps = {
  books: [{ ...book, id: 1, title: 'ಗೀತಾಭಾವಧಾರೆ' }],
  selectedBookId: null,
  onSelect: vi.fn(),
  onLoadMore: vi.fn(),
  onRetry: vi.fn(),
}

it('requests one batch per observation and disconnects observers on unmount', () => {
  let intersect!: IntersectionObserverCallback
  const disconnect = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      observe = vi.fn()
      disconnect = disconnect
    },
  )
  const view = render(<BookShelf {...props} hasMore />)

  act(() => {
    intersect(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    intersect(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  })

  expect(props.onLoadMore).toHaveBeenCalledTimes(1)

  view.unmount()

  expect(disconnect).toHaveBeenCalledOnce()
})

it.each([
  { isLoading: true },
  { isLoadingMore: true },
  { hasError: true },
  { hasMore: false },
])('does not observe while unavailable: %o', (state) => {
  const observer = vi.fn()
  vi.stubGlobal('IntersectionObserver', observer)

  render(<BookShelf {...props} hasMore {...state} />)

  expect(observer).not.toHaveBeenCalled()
})

it('provides manual loading when IntersectionObserver is unavailable', () => {
  render(<BookShelf {...props} hasMore />)

  expect(
    screen.getByRole('button', { name: 'Load more books' }),
  ).toHaveAccessibleDescription(
    'Books load automatically as you scroll. If they don’t, use the button below.',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Load more books' }))

  expect(props.onLoadMore).toHaveBeenCalled()
})

it('shows distinct empty, failure, loading, and end states', () => {
  const view = render(<BookShelf {...props} books={[]} isLoading />)

  expect(screen.getByRole('status')).toHaveTextContent('Loading your library')

  view.rerender(<BookShelf {...props} books={[]} />)

  expect(screen.getByText('Your shelf is waiting')).toBeVisible()

  view.rerender(<BookShelf {...props} books={[]} hasError />)

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Your library couldn’t be loaded',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(props.onRetry).toHaveBeenCalledOnce()

  view.rerender(<BookShelf {...props} isLoadingMore />)

  expect(screen.getByRole('status')).toHaveTextContent('Loading more books')
  expect(
    screen.getByRole('button', { name: 'Select ಗೀತಾಭಾವಧಾರೆ' }),
  ).toBeVisible()

  view.rerender(<BookShelf {...props} />)

  expect(
    screen.getByText('You’ve reached the end of your library.'),
  ).toBeVisible()
})
