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
  | 'pageScope'
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
        setPageScope: (pageScope) => updateArgs({ pageScope }),
        requestPageNavigation: (intent) => {
          args.requestPageNavigation(intent)
          const currentPage =
            intent.scope === 'global' ? args.globalPage! : args.currentPage
          const pageNumber =
            intent.kind === 'absolute'
              ? intent.pageNumber
              : currentPage + intent.delta

          // The synthetic book uses equal-length chapters, without loading content.
          updateArgs(
            intent.scope === 'global'
              ? {
                  globalPage: pageNumber,
                  currentPage: args.pageCount
                    ? ((pageNumber - 1) % args.pageCount) + 1
                    : 1,
                }
              : {
                  currentPage: pageNumber,
                  globalPage:
                    args.globalPage === null
                      ? null
                      : args.globalPage + pageNumber - args.currentPage,
                },
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
        <div className="w-[min(600px,calc(100vw-2rem))]">
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
    pageScope: 'local',
    currentPage: 7,
    pageCount: 24,
    globalPage: 55,
    totalPageCount: 120,
    indexedPageCount: 120,
    isPageNavigationPending: false,
    requestPageNavigation: fn(),
  },

  argTypes: {
    pageScope: { control: 'inline-radio', options: ['local', 'global'] },
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
  args: { pageScope: 'global', totalPageCount: null, indexedPageCount: 72 },
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
