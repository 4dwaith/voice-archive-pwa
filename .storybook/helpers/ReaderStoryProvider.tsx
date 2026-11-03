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
  ReaderContextValue['reader'],
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
      toc: {
        selectedSectionId: null,
        isSectionExpanded: () => true,
        tocPresentation: 'shown',
        selectSection: () => undefined,
        setSectionExpanded: () => undefined,
        setTocPresentation: () => undefined,
      },
      navigation: {
        pageScope: 'local',
        setPageScope: () => undefined,
        globalPage: null,
        totalPageCount: null,
        indexedPageCount: 0,
        isPageNavigationPending: false,
        requestPageNavigation: () => undefined,
        currentPage: 1,
        pageCount: null,
        setCurrentPage: () => undefined,
        reportPageMeasurement: () => undefined,
      },
      reader: {
        areControlsVisible: true,
        setControlsVisible: () => undefined,
        textSizePercent: 100,
        selectedSegmentId: args.selectedSegmentId,
        highlightedSegmentId: args.highlightedSegmentId,
        selectSegment: (segmentId) =>
          updateArgs({ selectedSegmentId: segmentId }),
        reportLayoutKey: () => undefined,
        reportSegmentError: () => undefined,
      },
    }

    return (
      <ReaderContext value={value}>
        <Story />
      </ReaderContext>
    )
  }
