// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
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
