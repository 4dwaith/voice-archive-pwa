import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { fn } from 'storybook/test'
import {
  ReaderContext,
  type ReaderContextValue,
  type ReaderSearchValue,
} from '../../../contexts/ReaderContext'
import { ReaderSearch } from './ReaderSearch'

const meta = {
  title: 'Molecules/ReaderSearch',
  component: ReaderSearch,
  args: {
    status: 'succeeded',
    isOpen: false,
    error: null,
    resultsQuery: 'river',
    results: [
      {
        segmentId: 1,
        offset: 10,
        chapterId: '1',
        chapterTitle: 'Chapter one',
        before: 'Beside the ',
        match: 'river',
        after: ' stood an old tree.',
      },
    ],
    submitQuery: fn(),
    openResult: fn(),
    setOpen: fn(),
    clear: fn(),
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['idle', 'loading', 'succeeded', 'failed'],
    },
    isOpen: { control: 'boolean' },
    error: { control: 'text' },
    resultsQuery: { control: 'text' },
    results: { control: 'object' },
  },
  decorators: [
    function ProvideSearchStory(Story) {
      const [args, updateArgs] = useArgs<ReaderSearchValue>()
      const value: ReaderContextValue = {
        toc: {
          selectedSectionId: null,
          isSectionExpanded: () => true,
          tocPresentation: 'shown',
          selectSection: () => {},
          setSectionExpanded: () => {},
          setTocPresentation: () => {},
        },
        navigation: {
          pageScope: 'local',
          setPageScope: () => {},
          currentPage: 1,
          pageCount: null,
          globalPage: null,
          totalPageCount: null,
          indexedPageCount: 0,
          isPageNavigationPending: false,
          requestPageNavigation: () => {},
          setCurrentPage: () => {},
          reportPageMeasurement: () => {},
        },
        reader: {
          areControlsVisible: true,
          setControlsVisible: () => {},
          reportLayoutKey: () => {},
          textSizePercent: 100,
          selectedSegmentId: null,
          highlightedSegmentId: null,
          selectSegment: () => {},
          highlightSegment: () => {},
          reportSegmentError: () => {},
          search: {
            ...args,
            setOpen: (isOpen) => updateArgs({ isOpen }),
            clear: () =>
              updateArgs({
                results: [],
                resultsQuery: '',
                status: 'idle',
                error: null,
              }),
            openResult: (result) => {
              args.openResult(result)
              updateArgs({ isOpen: false })
            },
            submitQuery: (query) => {
              args.submitQuery(query)
              updateArgs({ isOpen: true })
            },
          },
        },
      }

      return (
        <ReaderContext value={value}>
          <div className="max-w-xl p-4">
            <Story />
          </div>
        </ReaderContext>
      )
    },
  ],
} satisfies Meta<ReaderSearchValue>

export default meta

type Story = StoryObj<typeof meta>

export const RetainedResults: Story = {}

export const LoadingWithRetainedResults: Story = {
  args: { status: 'loading', isOpen: true },
}

export const EmptySearch: Story = {
  args: { status: 'idle', isOpen: true, resultsQuery: '', results: [] },
}
