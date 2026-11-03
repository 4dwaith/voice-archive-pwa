// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import * as searchRepository from '../../src/data/searchBookText'
import { createAppStore, type AppStore } from '../../src/store/store'
import {
  openReader,
  closeReader,
  selectSection,
  setReaderAnchor,
  requestPageNavigation,
} from '../../src/store/readerSlice'
import { requestBookClose } from '../../src/store/bookDownloadsSlice'
import {
  default as readerSearchReducer,
  submitReaderSearch,
  clearReaderSearch,
  setSearchOpen,
  getSearchStatus,
  isSearchOpen,
} from '../../src/store/readerSearchSlice'

const scope = { bookId: 7, contentVersion: 'version' }
const result = {
  segmentId: 9,
  offset: 20,
  before: 'before ',
  match: 'hit',
  after: ' after',
  chapterId: '10',
  chapterTitle: 'Root',
}

function createReaderStore() {
  const store = createAppStore()
  store.dispatch(openReader(scope))
  return store
}

async function submitSearchAndWait(store: AppStore, query: string) {
  store.dispatch(submitReaderSearch({ scope, query }))
  await waitFor(() =>
    expect(getSearchStatus(store.getState())).toBe('succeeded'),
  )
}

describe('Search request lifecycle', () => {
  it('records submission before middleware runs', () => {
    const opened = readerSearchReducer(undefined, openReader(scope))

    const state = readerSearchReducer(
      opened,
      submitReaderSearch({ scope, query: 'hit' }),
    )

    expect(state).toMatchObject({
      submittedQuery: 'hit',
      status: 'loading',
      isOpen: true,
    })
  })

  it('retains labelled results while loading and after failure', async () => {
    const search = vi
      .spyOn(searchRepository, 'searchBookText')
      .mockResolvedValueOnce([result])
    const store = createReaderStore()
    await submitSearchAndWait(store, 'hit')
    let fail!: (reason: Error) => void
    search.mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject
      }),
    )

    store.dispatch(submitReaderSearch({ scope, query: 'next' }))

    expect(store.getState().readerSearch).toMatchObject({
      status: 'loading',
      submittedQuery: 'next',
      resultsQuery: 'hit',
      results: [result],
      isOpen: true,
    })

    fail(new Error('database unavailable'))
    await waitFor(() =>
      expect(getSearchStatus(store.getState())).toBe('failed'),
    )

    expect(store.getState().readerSearch).toMatchObject({
      status: 'failed',
      resultsQuery: 'hit',
      results: [result],
      error: expect.any(String),
    })
  })

  it('ignores blank submissions and requests for an inactive dataset', async () => {
    const search = vi
      .spyOn(searchRepository, 'searchBookText')
      .mockResolvedValue([result])
    const store = createReaderStore()
    await submitSearchAndWait(store, 'hit')
    const previous = store.getState().readerSearch

    store.dispatch(submitReaderSearch({ scope, query: ' \n' }))
    store.dispatch(
      submitReaderSearch({
        scope: { ...scope, contentVersion: 'old' },
        query: 'hit',
      }),
    )

    expect(search).toHaveBeenCalledTimes(1)
    expect(store.getState().readerSearch).toEqual(previous)
  })

  it('lets the latest search replace results with an empty list', async () => {
    let finish!: (results: searchRepository.TextSearchResult[]) => void
    const older = new Promise<searchRepository.TextSearchResult[]>(
      (resolve) => {
        finish = resolve
      },
    )
    vi.spyOn(searchRepository, 'searchBookText')
      .mockResolvedValueOnce([result])
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce([])
    const store = createReaderStore()
    await submitSearchAndWait(store, 'hit')
    store.dispatch(submitReaderSearch({ scope, query: 'hit' }))

    await submitSearchAndWait(store, 'missing')
    finish([result])
    await older

    expect(store.getState().readerSearch).toMatchObject({
      status: 'succeeded',
      resultsQuery: 'missing',
      results: [],
    })
  })

  it.each([
    { action: clearReaderSearch(), isOpen: true },
    { action: closeReader(scope), isOpen: false },
    { action: requestBookClose(scope.bookId), isOpen: false },
    { action: openReader({ ...scope, bookId: 8 }), isOpen: false },
    {
      action: openReader({ ...scope, contentVersion: 'replacement' }),
      isOpen: false,
    },
  ])(
    'invalidates pending results on $action.type',
    async ({ action, isOpen }) => {
      let finish!: (results: searchRepository.TextSearchResult[]) => void
      const pending = new Promise<searchRepository.TextSearchResult[]>(
        (resolve) => {
          finish = resolve
        },
      )
      vi.spyOn(searchRepository, 'searchBookText')
        .mockResolvedValueOnce([result])
        .mockReturnValueOnce(pending)
      const store = createReaderStore()
      await submitSearchAndWait(store, 'hit')
      store.dispatch(submitReaderSearch({ scope, query: 'hit' }))

      store.dispatch(action)
      finish([result])
      await pending

      expect(store.getState().readerSearch).toMatchObject({
        submittedQuery: '',
        status: 'idle',
        results: [],
        isOpen,
      })
    },
  )

  it.each([
    { name: 'resubmitting', actions: [] },
    { name: 'clearing and resubmitting', actions: [clearReaderSearch()] },
  ])(
    'accepts an equivalent earlier result after $name',
    async ({ actions }) => {
      let finishEarlier!: (results: searchRepository.TextSearchResult[]) => void
      let finishLatest!: (results: searchRepository.TextSearchResult[]) => void
      const earlier = new Promise<searchRepository.TextSearchResult[]>(
        (resolve) => {
          finishEarlier = resolve
        },
      )
      const latest = new Promise<searchRepository.TextSearchResult[]>(
        (resolve) => {
          finishLatest = resolve
        },
      )
      vi.spyOn(searchRepository, 'searchBookText')
        .mockReturnValueOnce(earlier)
        .mockReturnValueOnce(latest)
      const store = createReaderStore()
      store.dispatch(submitReaderSearch({ scope, query: 'hit' }))
      for (const action of actions) store.dispatch(action)

      store.dispatch(submitReaderSearch({ scope, query: 'hit' }))
      finishEarlier([result])
      await earlier

      expect(store.getState().readerSearch).toMatchObject({
        status: 'succeeded',
        results: [result],
      })

      finishLatest([result])
      await latest
    },
  )

  it('keeps success when an equivalent earlier request fails', async () => {
    let fail!: (error: Error) => void
    const earlier = new Promise<searchRepository.TextSearchResult[]>(
      (_, reject) => {
        fail = reject
      },
    )
    vi.spyOn(searchRepository, 'searchBookText')
      .mockReturnValueOnce(earlier)
      .mockResolvedValueOnce([result])
    const store = createReaderStore()
    store.dispatch(submitReaderSearch({ scope, query: 'hit' }))
    await submitSearchAndWait(store, 'hit')

    fail(new Error('database unavailable'))
    await earlier.catch(() => {})

    expect(store.getState().readerSearch).toMatchObject({
      status: 'succeeded',
      results: [result],
      error: null,
    })
  })

  it.each([
    { ...scope, bookId: 8 },
    { ...scope, contentVersion: 'replacement' },
  ])(
    'rejects an earlier dataset for the same phrase in $bookId/$contentVersion',
    async (nextScope) => {
      let finish!: (results: searchRepository.TextSearchResult[]) => void
      const earlier = new Promise<searchRepository.TextSearchResult[]>(
        (resolve) => {
          finish = resolve
        },
      )
      vi.spyOn(searchRepository, 'searchBookText')
        .mockReturnValueOnce(earlier)
        .mockResolvedValueOnce([result])
      const store = createReaderStore()
      store.dispatch(submitReaderSearch({ scope, query: 'hit' }))

      store.dispatch(openReader(nextScope))
      store.dispatch(submitReaderSearch({ scope: nextScope, query: 'hit' }))
      await waitFor(() =>
        expect(getSearchStatus(store.getState())).toBe('succeeded'),
      )
      finish([])
      await earlier

      expect(store.getState().readerSearch.results).toEqual([result])
    },
  )

  it.each([
    selectSection(10),
    setReaderAnchor({ ...scope, anchor: { segmentId: 9, offset: 20 } }),
    requestPageNavigation({
      scope: 'local',
      kind: 'relative',
      delta: 1,
      currentPage: 1,
      pageCount: 2,
    }),
  ])('closes on $type and reopens without searching again', async (action) => {
    const search = vi
      .spyOn(searchRepository, 'searchBookText')
      .mockResolvedValue([result])
    const store = createReaderStore()
    await submitSearchAndWait(store, 'hit')

    store.dispatch(action)

    expect(store.getState().readerSearch).toMatchObject({
      results: [result],
      isOpen: false,
    })

    store.dispatch(setSearchOpen(true))

    expect(isSearchOpen(store.getState())).toBe(true)
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('keeps dismissed pending results closed when they arrive', async () => {
    let finish!: (results: searchRepository.TextSearchResult[]) => void
    const pending = new Promise<searchRepository.TextSearchResult[]>(
      (resolve) => {
        finish = resolve
      },
    )
    vi.spyOn(searchRepository, 'searchBookText').mockReturnValueOnce(pending)
    const store = createReaderStore()
    store.dispatch(submitReaderSearch({ scope, query: 'hit' }))

    store.dispatch(setSearchOpen(false))
    store.dispatch(closeReader({ ...scope, contentVersion: 'old' }))
    finish([result])
    await pending

    expect(store.getState().readerSearch).toMatchObject({
      results: [result],
      isOpen: false,
    })
  })
})
