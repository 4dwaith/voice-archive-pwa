import type { Meta, StoryObj } from '@storybook/react-vite'
import { ReaderPage } from './ReaderPage'
import {
  ProvideReaderPageStory,
  type ReaderPageStoryArgs,
} from '../../../../.storybook/helpers/ReaderPageStoryProvider'
import {
  readerPageSegments,
  continuingReaderSegment,
  flowingReaderSegment,
  unbrokenReaderSegment,
} from '../../../mock-data/readerPages'

const meta = {
  title: 'Atoms/Reader/ReaderPage',
  component: ReaderPage,
  decorators: [ProvideReaderPageStory],
  tags: ['autodocs'],

  args: {
    segments: readerPageSegments,
    label: 'A synthetic chapter',
    width: 360,
    height: 252,
    currentPage: 1,
    pageCount: 3,
    textSizePercent: 100,
    selectedSegmentId: null,
    highlightedSegmentId: null,
  },

  argTypes: {
    width: {
      control: { type: 'number', min: 100 },
      table: { category: 'Parent size' },
    },
    height: {
      control: { type: 'number', min: 100 },
      table: { category: 'Parent size' },
    },
    currentPage: {
      control: { type: 'number', min: 1, step: 1 },
      table: { category: 'Reader context' },
    },
    pageCount: {
      control: { type: 'number', min: 0, step: 1 },
      description:
        'Supplied chapter count; adjust alongside viewport and typography controls. Null represents preparing.',
      table: { category: 'Reader context' },
    },
    textSizePercent: {
      control: 'select',
      options: [100, 112.5, 125, 137.5],
      table: { category: 'Reader context' },
    },
    selectedSegmentId: {
      control: 'number',
      table: { category: 'Reader context' },
    },
    highlightedSegmentId: {
      control: 'number',
      table: { category: 'Reader context' },
    },
  },

  render: ({ segments, label }) => (
    <ReaderPage segments={segments} label={label} />
  ),
} satisfies Meta<ReaderPageStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const OverflowOnPageOne: Story = {}

export const NumberedLaterPage: Story = {
  args: { currentPage: 2 },
}

export const SelectedSegment: Story = {
  args: { currentPage: 2, selectedSegmentId: 102, highlightedSegmentId: 103 },
}

export const LongParagraph: Story = {
  args: { currentPage: 2, segments: [flowingReaderSegment] },
}

export const ContinuingVerse: Story = {
  args: { currentPage: 2, segments: [continuingReaderSegment] },
}

export const UnbrokenText: Story = {
  args: { segments: [unbrokenReaderSegment], pageCount: 4 },
}
