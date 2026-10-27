import { useCallback } from 'react'
import type { Decorator } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../src/contexts/ReaderContext'
import type { ReaderSegment } from '../../src/models/reader'

export type ReaderPageStoryArgs = {
  segments: ReaderSegment[]
  label: string
  width: number
  height: number
  currentPage: number
  pageCount: number | null
  textSizePercent: number
  selectedSegmentId: number | null
  highlightedSegmentId: number | null
}

export const ProvideReaderPageStory: Decorator<ReaderPageStoryArgs> =
  function ProvideReaderPageStory(Story) {
    const [args, updateArgs] = useArgs<ReaderPageStoryArgs>()
    const reportPageCount = useCallback(
      (pageCount: number | null) => {
        updateArgs({ pageCount })
      },
      [updateArgs],
    )

    const value: ReaderContextValue = {
      currentPage: args.currentPage,
      pageCount: args.pageCount,
      textSizePercent: args.textSizePercent,
      setCurrentPage: (currentPage) => updateArgs({ currentPage }),
      reportPageCount,
      selectedSegmentId: args.selectedSegmentId,
      highlightedSegmentId: args.highlightedSegmentId,
      selectSegment: (selectedSegmentId) => updateArgs({ selectedSegmentId }),
      highlightSegment: (highlightedSegmentId) =>
        updateArgs({ highlightedSegmentId }),
      reportSegmentError: () => undefined,
    }

    return (
      <ReaderContext value={value}>
        <div
          style={{
            width: args.width,
            height: args.height,
            fontFamily: 'monospace',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Story />
        </div>
      </ReaderContext>
    )
  }
