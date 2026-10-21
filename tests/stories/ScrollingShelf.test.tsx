// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ScrollingShelf } from '../../.storybook/helpers/ScrollingShelf'

let intersect: IntersectionObserverCallback

beforeEach(() => {
  vi.useFakeTimers()

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }

      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function scrollToBottom() {
  act(() => {
    intersect(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  })
}

async function finishLoading() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500)
  })
}

it('demonstrates delayed batches from scrolling until the library ends', async () => {
  render(<ScrollingShelf />)

  expect(screen.getAllByRole('button', { name: /^Select / })).toHaveLength(12)

  scrollToBottom()

  expect(screen.getByText('Loading more books…')).toBeVisible()
  expect(screen.getAllByRole('button', { name: /^Select / })).toHaveLength(12)

  await finishLoading()

  expect(screen.getByText('Showing 24 of 30 books')).toBeVisible()

  scrollToBottom()
  await finishLoading()

  expect(screen.getAllByRole('button', { name: /^Select / })).toHaveLength(30)
  expect(
    screen.getByText('You’ve reached the end of your library.'),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Load more books' })).toBeNull()
})

it('waits before failing, retains books, and recovers on retry', async () => {
  render(<ScrollingShelf failNextLoad />)

  scrollToBottom()

  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByText('Loading more books…')).toBeVisible()

  await finishLoading()

  expect(screen.getByRole('alert')).toHaveTextContent(
    'More books couldn’t be loaded',
  )
  expect(screen.getAllByRole('button', { name: /^Select / })).toHaveLength(12)

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByText('Loading more books…')).toBeVisible()

  await finishLoading()

  expect(screen.getByText('Showing 24 of 30 books')).toBeVisible()
})

it('cancels a pending simulated request when the story unmounts', () => {
  const view = render(<ScrollingShelf />)

  scrollToBottom()

  expect(vi.getTimerCount()).toBe(1)

  view.unmount()

  expect(vi.getTimerCount()).toBe(0)
})
