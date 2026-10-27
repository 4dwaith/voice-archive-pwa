import type { ComponentProps } from 'react'
import type { Decorator } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../src/contexts/ReaderContext'
import type { ReaderSegmentContent } from '../../src/components/atoms/ReaderSegmentContent/ReaderSegmentContent'
import type { ReaderSegment } from '../../src/models/reader'

type ReaderStoryState = Pick<
  ReaderContextValue,
  'selectedSegmentId' | 'highlightedSegmentId'
>

export type ReaderStoryArgs = ComponentProps<typeof ReaderSegmentContent> &
  ReaderStoryState & {
    segments?: ReaderSegment[]
  }

export const ProvideReaderStory: Decorator<ReaderStoryArgs> =
  function ProvideReaderStory(Story) {
    const [args, updateArgs] = useArgs<ReaderStoryArgs>()

    const value: ReaderContextValue = {
      selectedSegmentId: args.selectedSegmentId,
      highlightedSegmentId: args.highlightedSegmentId,
      selectSegment: (segmentId) =>
        updateArgs({ selectedSegmentId: segmentId }),
      highlightSegment: (segmentId) =>
        updateArgs({ highlightedSegmentId: segmentId }),
      reportSegmentError: () => undefined,
    }

    return (
      <ReaderContext value={value}>
        <Story />
      </ReaderContext>
    )
  }
