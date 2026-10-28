import { describe, expect, it } from 'vitest'
import reducer, {
  openReader,
  reportLayoutKey,
  requestPageNavigation,
  completePageNavigation,
  selectSection,
  setReaderAnchor,
  setPageScope,
  closeReader,
} from '../../src/store/readerSlice'

const scope = { bookId: 7, contentVersion: 'version' }
const anchor = { segmentId: 1, offset: 0 }

function createReaderState() {
  return reducer(
    reducer(undefined, openReader(scope)),
    reportLayoutKey('layout'),
  )
}

function requestPage(pageNumber: number) {
  return requestPageNavigation({
    scope: 'local',
    kind: 'absolute',
    pageNumber,
    currentPage: 2,
    pageCount: 20,
  })
}

function completeRequest(state: ReturnType<typeof createReaderState>) {
  return completePageNavigation({
    ...scope,
    layoutKey: 'layout',
    requestId: state.pageNavigationIntent!.requestId,
    sectionId: 10,
    anchor,
  })
}

describe('Footer intent ordering', () => {
  it('accumulates relative requests from a pending absolute destination', () => {
    let state = reducer(createReaderState(), requestPage(10))
    const relative = () =>
      requestPageNavigation({
        scope: 'local',
        kind: 'relative',
        delta: 5,
        currentPage: 2,
        pageCount: 20,
      })

    state = reducer(reducer(state, relative()), relative())

    expect(state.pageNavigationIntent?.pageNumber).toBe(20)

    state = reducer(state, requestPage(3))

    expect(state.pageNavigationIntent?.pageNumber).toBe(3)
  })

  it('starts a different scope from its current anchor position', () => {
    const state = reducer(createReaderState(), requestPage(10))

    const next = reducer(
      state,
      requestPageNavigation({
        scope: 'global',
        kind: 'relative',
        delta: 1,
        currentPage: 4,
        pageCount: 30,
      }),
    )

    expect(next.pageNavigationIntent?.pageNumber).toBe(5)
  })

  it('does not let an old completion clear a newer request for the same page', () => {
    const old = reducer(createReaderState(), requestPage(10))
    const newer = reducer(old, requestPage(10))

    const next = reducer(newer, completeRequest(old))

    expect(next).toEqual(newer)
    expect(next.pageNavigationIntent?.requestId).not.toBe(
      old.pageNavigationIntent?.requestId,
    )
  })

  it.each([
    selectSection(10),
    setReaderAnchor({ ...scope, anchor }),
    setPageScope('global'),
    openReader({ ...scope, contentVersion: 'replacement' }),
    closeReader(scope),
    reportLayoutKey('changed'),
  ])('rejects completion after $type', (action) => {
    const pending = reducer(createReaderState(), requestPage(10))
    const changed = reducer(pending, action)

    const next = reducer(changed, completeRequest(pending))

    expect(next).toEqual(changed)
  })

  it('commits the anchor and clears only the current intent atomically', () => {
    const pending = reducer(createReaderState(), requestPage(10))

    const next = reducer(pending, completeRequest(pending))

    expect(next.anchor).toEqual(anchor)
    expect(next.pageNavigationIntent).toBeNull()
    expect(next.pageNavigationError).toBeNull()
  })
})
