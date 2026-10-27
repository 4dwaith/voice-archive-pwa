import { useCallback } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import {
  ReaderContext,
  type ReaderContextValue,
} from '../../../contexts/ReaderContext'
import { ReaderTableOfContents } from './ReaderTableOfContents'
import { readerSections } from '../../../mock-data/readerSections.ts'

type StoryArgs = Pick<
  ReaderContextValue['toc'],
  'selectedSectionId' | 'tocPresentation'
> & {
  sectionExpansion: Record<number, boolean>
  sections: typeof readerSections
  width: number
}

const ProvideTocStory: Decorator<StoryArgs> = function ProvideTocStory(Story) {
  const [args, updateArgs] = useArgs<StoryArgs>()
  const isSectionExpanded = useCallback(
    (sectionId: number) => args.sectionExpansion[sectionId] ?? true,
    [args.sectionExpansion],
  )

  const value: ReaderContextValue = {
    toc: {
      selectedSectionId: args.selectedSectionId,
      isSectionExpanded,
      tocPresentation: args.tocPresentation,
      selectSection: (selectedSectionId) => updateArgs({ selectedSectionId }),
      setSectionExpanded: ({ sectionId, isExpanded }) =>
        updateArgs({
          sectionExpansion: {
            ...args.sectionExpansion,
            [sectionId]: isExpanded,
          },
        }),
      setTocPresentation: (tocPresentation) => updateArgs({ tocPresentation }),
    },
    navigation: {
      globalPage: null,
      totalPageCount: null,
      indexedPageCount: 0,
      isPageNavigationPending: false,
      requestPageNavigation: () => undefined,
      currentPage: 1,
      pageCount: null,
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
      <div className="h-80" style={{ width: args.width }}>
        <Story />
      </div>
    </ReaderContext>
  )
}

const meta = {
  title: 'Atoms/Reader/ReaderTableOfContents',
  component: ReaderTableOfContents,
  decorators: [ProvideTocStory],
  tags: ['autodocs'],

  args: {
    sections: readerSections,
    selectedSectionId: 7,
    sectionExpansion: {},
    tocPresentation: 'shown',
    width: 280,
  },

  argTypes: {
    selectedSectionId: { control: 'number' },
    sectionExpansion: { control: 'object' },
    tocPresentation: {
      control: 'select',
      options: ['shown', 'dimmed', 'collapsed'],
    },
    width: { control: { type: 'number', min: 160 } },
  },

  render: ({ sections }) => <ReaderTableOfContents sections={sections} />,
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Flat: Story = {
  args: { sections: readerSections.filter((s) => !s.parent_id) },
}

export const Nested: Story = {}

export const DimmedNarrow: Story = {
  args: { tocPresentation: 'dimmed', width: 180, selectedSectionId: 5 },
}

export const Empty: Story = { args: { sections: [], selectedSectionId: null } }
