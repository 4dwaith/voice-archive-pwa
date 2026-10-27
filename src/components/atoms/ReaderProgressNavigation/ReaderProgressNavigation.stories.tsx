import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useArgs } from 'storybook/preview-api'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../contexts/ReaderContext'
import { ReaderProgressNavigation } from './ReaderProgressNavigation'

type StoryArgs = Pick<
  ReaderContextValue['navigation'],
  | 'currentPage'
  | 'pageCount'
  | 'globalPage'
  | 'totalPageCount'
  | 'indexedPageCount'
  | 'isPageNavigationPending'
  | 'requestPageNavigation'
>

const ProvideProgressStory: Decorator<StoryArgs> =
  function ProvideProgressStory(Story) {
    const [args, updateArgs] = useArgs<StoryArgs>()
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
        ...args,
        requestPageNavigation: (intent) => {
          args.requestPageNavigation(intent)
          const currentPage =
            intent.scope === 'global' ? args.globalPage! : args.currentPage
          const pageNumber =
            intent.kind === 'absolute'
              ? intent.pageNumber
              : currentPage + intent.delta

          // These fixtures show one section whose local and book numbers match.
          updateArgs(
            intent.scope === 'global'
              ? { currentPage: pageNumber, globalPage: pageNumber }
              : { currentPage: pageNumber },
          )
        },
        setCurrentPage: () => undefined,
        reportPageCount: () => undefined,
      },
      reader: {
        textSizePercent: 100,
        selectedSegmentId: null,
        highlightedSegmentId: null,
        selectSegment: () => undefined,
        highlightSegment: () => undefined,
        reportSegmentError: () => undefined,
      },
    }

    return (
      <ReaderContext value={value}>
        <div className="max-w-sm">
          <Story />
        </div>
      </ReaderContext>
    )
  }

const meta = {
  title: 'Atoms/Reader/ReaderProgressNavigation',
  component: ReaderProgressNavigation,
  decorators: [ProvideProgressStory],
  tags: ['autodocs'],

  args: {
    currentPage: 3,
    pageCount: 6,
    globalPage: 3,
    totalPageCount: 6,
    indexedPageCount: 6,
    isPageNavigationPending: false,
    requestPageNavigation: fn(),
  },

  argTypes: {
    currentPage: { control: { type: 'number', min: 1, step: 1 } },
    pageCount: { control: { type: 'number', min: 0, step: 1 } },
    globalPage: { control: { type: 'number', min: 1, step: 1 } },
    totalPageCount: { control: { type: 'number', min: 0, step: 1 } },
    indexedPageCount: { control: { type: 'number', min: 0, step: 1 } },
    isPageNavigationPending: { control: 'boolean' },
    requestPageNavigation: { control: false },
  },

  render: () => <ReaderProgressNavigation />,
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const KnownTotal: Story = {}

export const PartialIndex: Story = {
  args: { totalPageCount: null },
}

export const EmptyUnknownPosition: Story = {
  args: {
    currentPage: 1,
    pageCount: 0,
    globalPage: null,
    totalPageCount: null,
    indexedPageCount: 0,
  },
}
