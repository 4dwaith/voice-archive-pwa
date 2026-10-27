import type { Meta, StoryObj } from '@storybook/react-vite'
import { ReaderSegmentContent } from './ReaderSegmentContent'
import type { ReaderSegment } from '../../../models/reader'
import {
  readerSegments,
  arbitraryClassSegment,
  unsafeReaderSegment,
} from '../../../mock-data/readerSegments'
import {
  ProvideReaderStory,
  type ReaderStoryArgs,
} from '../../../../.storybook/helpers/ReaderStoryProvider'

function ReaderSegmentExamples({
  segments,
  isKeyboardEntry = true,
}: {
  segments: ReaderSegment[]
  isKeyboardEntry?: boolean
}) {
  return (
    <div className="max-w-2xl p-6">
      {segments.map((segment, index) => (
        <ReaderSegmentContent
          key={segment.id}
          segment={segment}
          isKeyboardEntry={isKeyboardEntry && index === 0}
        />
      ))}
    </div>
  )
}

const meta = {
  title: 'Atoms/Reader/ReaderSegmentContent',
  component: ReaderSegmentContent,
  tags: ['autodocs'],
  parameters: { controls: { sort: 'alpha' } },
  decorators: [ProvideReaderStory],

  args: {
    segment: readerSegments[1],
    selectedSegmentId: null,
    highlightedSegmentId: null,
    isKeyboardEntry: true,
  },

  argTypes: {
    segment: { control: 'object', table: { category: 'Example content' } },
    isKeyboardEntry: { table: { category: 'Example content' } },
    selectedSegmentId: {
      control: 'select',
      options: [null, 1, 2, 3, 4, 5, 6, 7, 10],
      description:
        'Selected segment ID. Null clears selection; choose an ID present in this example.',
      table: { category: 'Reader context' },
    },
    highlightedSegmentId: {
      control: 'select',
      options: [null, 1, 2, 3, 4, 5, 6, 7, 10],
      description:
        'External highlight ID, independent of selection. Null clears the highlight.',
      table: { category: 'Reader context' },
    },
    segments: { control: 'object', table: { category: 'Example content' } },
  },

  render: ({ segment, segments, isKeyboardEntry }) => (
    <ReaderSegmentExamples
      segments={segments ?? [segment]}
      isKeyboardEntry={isKeyboardEntry}
    />
  ),
} satisfies Meta<ReaderStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const SimpleText: Story = {
  args: {
    segment: {
      id: 10,
      source_key: 'simple',
      kind: 'prose',
      html_content: '<p>A quiet place to read.</p>',
      text_content: 'A quiet place to read.',
      language: 'en',
    },
  },
}

export const HeadingsProseVerseAndFormatting: Story = {
  args: { segments: readerSegments },
}

export const NestedEmphasis: Story = {}

export const SelectedAndExternalHighlight: Story = {
  args: {
    segments: readerSegments,
    selectedSegmentId: 2,
    highlightedSegmentId: 3,
  },
}

export const SelectAndHighlightOnSameSegment: Story = {
  args: { selectedSegmentId: 2, highlightedSegmentId: 2 },
}

export const ArbitraryClassNames: Story = {
  args: { segment: arbitraryClassSegment },
}

export const InvalidBetweenValidNeighbors: Story = {
  args: {
    segments: [readerSegments[0], unsafeReaderSegment, readerSegments[1]],
  },
}
