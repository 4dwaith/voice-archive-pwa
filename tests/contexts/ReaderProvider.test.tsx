// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { database } from '../../src/data/database'
import { seedContent } from '../helpers/readerMeasurements'
import { Provider } from 'react-redux'
import { ReaderProvider } from '../../src/contexts/ReaderProvider'
import { useReaderContext } from '../../src/contexts/ReaderContext'
import { createAppStore } from '../../src/store/store'
import {
  selectSegment,
  highlightSegment,
  reportSegmentError,
} from '../../src/store/readerSlice'

afterEach(cleanup)

function ShowReaderActions() {
  const { reader } = useReaderContext()

  return (
    <>
      <output aria-label="Selected segment">
        {reader.selectedSegmentId ?? 'none'}
      </output>
      <output aria-label="Highlighted segment">
        {reader.highlightedSegmentId ?? 'none'}
      </output>
      <button onClick={() => reader.selectSegment(2)}>Select segment</button>
      <button onClick={() => reader.highlightSegment(1)}>
        Highlight segment
      </button>
      <button
        onClick={() =>
          reader.reportSegmentError({
            segmentId: 7,
            error: 'unsupported-markup',
          })
        }
      >
        Report segment error
      </button>
      <button
        onClick={() => reader.reportSegmentError({ segmentId: 7, error: null })}
      >
        Clear segment error
      </button>
    </>
  )
}

function ShowPdfInput() {
  const { pdf } = useReaderContext().reader
  return (
    <output aria-label="PDF input">
      {JSON.stringify({ url: pdf?.url, regions: pdf?.regions })}
    </output>
  )
}

describe('ReaderProvider PDF inputs', () => {
  beforeEach(async () => {
    await database.delete()
    await database.open()
  })

  afterEach(async () => {
    cleanup()
    await database.delete()
  })

  it('resolves cached media and clears old geometry when the dataset changes', async () => {
    const content = await seedContent()
    content.manifest.source_pdf_file_id = 9
    content.manifest.files = [
      {
        id: 9,
        kind: 'source_pdf',
        book_id: 7,
        section_id: null,
        url: '/api/v1/files/9',
        byte_size: 1000,
        metadata: { page_count: 3 },
      },
    ]
    await database.content.put(content)
    const regions = [{ page_index: 1, x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.4 }]
    await database.segments.update([7, 'version', 3], { regions })
    const store = createAppStore()
    const show = (version: string) => (
      <Provider store={store}>
        <ReaderProvider bookId={7} contentVersion={version}>
          <ShowPdfInput />
        </ReaderProvider>
      </Provider>
    )
    const view = render(show('version'))

    act(() => {
      store.dispatch(selectSegment(1))
    })

    await waitFor(() =>
      expect(
        JSON.parse(screen.getByLabelText('PDF input').textContent!),
      ).toEqual({ url: 'http://127.0.0.1:8000/api/v1/files/9', regions }),
    )

    view.rerender(show('new-version'))

    expect(JSON.parse(screen.getByLabelText('PDF input').textContent!)).toEqual(
      { url: null, regions: [] },
    )
  })
})

function renderReaderProvider() {
  const store = createAppStore()

  render(
    <Provider store={store}>
      <ReaderProvider>
        <ShowReaderActions />
      </ReaderProvider>
    </Provider>,
  )

  return store
}

describe('ReaderProvider production adapter', () => {
  it('dispatches context selection to Redux', () => {
    const store = renderReaderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Select segment' }))

    expect(store.getState().reader.selectedSegmentId).toBe(2)
  })

  it('dispatches context highlighting to Redux without changing selection', () => {
    const store = renderReaderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Highlight segment' }))

    expect(store.getState().reader.highlightedSegmentId).toBe(1)
    expect(store.getState().reader.selectedSegmentId).toBeNull()
  })

  it('reflects selection dispatched outside the UI into context', () => {
    const store = renderReaderProvider()

    act(() => {
      store.dispatch(selectSegment(2))
    })

    expect(screen.getByLabelText('Selected segment')).toHaveTextContent('2')
  })

  it('reflects highlighting dispatched outside the UI into context', () => {
    const store = renderReaderProvider()

    act(() => {
      store.dispatch(highlightSegment(1))
    })

    expect(screen.getByLabelText('Highlighted segment')).toHaveTextContent('1')
  })

  it('dispatches segment errors reported through context', () => {
    const store = renderReaderProvider()

    fireEvent.click(
      screen.getByRole('button', { name: 'Report segment error' }),
    )

    expect(store.getState().reader.segmentErrors).toEqual({
      7: 'unsupported-markup',
    })
  })

  it('clears an existing segment error through context', () => {
    const store = renderReaderProvider()
    act(() => {
      store.dispatch(
        reportSegmentError({ segmentId: 7, error: 'unsupported-markup' }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear segment error' }))

    expect(store.getState().reader.segmentErrors).toEqual({})
  })
})
