import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { isSearchQueryValid } from '../data/searchBookText'
import type { TextSearchResult } from '../data/searchBookText'
import type { ReaderScope } from '../models/reader'
import {
  openReader,
  closeReader,
  requestPageNavigation,
  selectSection,
  setReaderAnchor,
} from './readerSlice'
import { requestBookClose } from './bookDownloadsSlice'

type ReaderSearchState = {
  scope: ReaderScope | null
  submittedQuery: string
  resultsQuery: string
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  results: TextSearchResult[]
  isOpen: boolean
  error: string | null
}

const initialState: ReaderSearchState = {
  scope: null,
  submittedQuery: '',
  resultsQuery: '',
  status: 'idle',
  results: [],
  isOpen: false,
  error: null,
}

function hasMatchingScope(current: ReaderScope | null, expected: ReaderScope) {
  return (
    current?.bookId === expected.bookId &&
    current.contentVersion === expected.contentVersion
  )
}

type ReaderSearchRequest = { scope: ReaderScope; query: string }

function hasMatchingSearch(
  state: ReaderSearchState,
  request: ReaderSearchRequest,
) {
  return (
    hasMatchingScope(state.scope, request.scope) &&
    state.submittedQuery === request.query
  )
}

const readerSearchSlice = createSlice({
  name: 'readerSearch',
  initialState,
  reducers: {
    clearReaderSearch: (state) => ({
      ...initialState,
      scope: state.scope,
      isOpen: state.isOpen,
    }),
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.isOpen = action.payload
    },
    submitReaderSearch(state, { payload }: PayloadAction<ReaderSearchRequest>) {
      if (
        !hasMatchingScope(state.scope, payload.scope) ||
        !isSearchQueryValid(payload.query)
      )
        return
      state.submittedQuery = payload.query
      state.status = 'loading'
      state.error = null
      state.isOpen = true
      // Note that the results' query and search are unchanged - while the current search is loading, the previous search results are still displayed.
    },
    recordSearchSuccess(
      state,
      {
        payload,
      }: PayloadAction<ReaderSearchRequest & { results: TextSearchResult[] }>,
    ) {
      if (!hasMatchingSearch(state, payload)) return
      state.results = payload.results
      state.resultsQuery = state.submittedQuery
      state.status = 'succeeded'
      state.error = null
    },
    recordSearchFailure(
      state,
      { payload }: PayloadAction<ReaderSearchRequest>,
    ) {
      if (!hasMatchingSearch(state, payload) || state.status !== 'loading')
        return
      state.status = 'failed'
      state.error = 'Search could not be completed. Try again.'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(openReader, (state, action) => {
        if (!hasMatchingScope(state.scope, action.payload))
          return { ...initialState, scope: action.payload }
      })
      .addCase(closeReader, (state, action) => {
        if (hasMatchingScope(state.scope, action.payload)) return initialState
      })
      .addCase(requestBookClose, (state, action) => {
        if (state.scope?.bookId === action.payload) return initialState
      })
      .addCase(setReaderAnchor, (state, action) => {
        if (hasMatchingScope(state.scope, action.payload)) state.isOpen = false
      })
      .addMatcher(isAnyOf(requestPageNavigation, selectSection), (state) => {
        state.isOpen = false
      })
  },
  selectors: {
    isSearchPending: (state, request: ReaderSearchRequest) =>
      state.status === 'loading' && hasMatchingSearch(state, request),
    getSearchResultsQuery: (state) => state.resultsQuery,
    getSearchStatus: (state) => state.status,
    getSearchResults: (state) => state.results,
    isSearchOpen: (state) => state.isOpen,
    getSearchError: (state) => state.error,
  },
})

export const {
  clearReaderSearch,
  setSearchOpen,
  submitReaderSearch,
  recordSearchSuccess,
  recordSearchFailure,
} = readerSearchSlice.actions
export const {
  isSearchPending,
  getSearchResultsQuery,
  getSearchStatus,
  getSearchResults,
  isSearchOpen,
  getSearchError,
} = readerSearchSlice.selectors
export default readerSearchSlice.reducer
