import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { books, makeBookFixture } from '../../../mock-data/books'
import { Book } from './Book'

const baseBook = books[0]

const fallbackBooks = Array.from({ length: 8 }, (_, index) =>
  makeBookFixture({
    id: index + 1,
    title: `Book without a cover ${index + 1}`,
  }),
)

function InteractiveBook(props: ComponentProps<typeof Book>) {
  const [isSelected, setIsSelected] = useState(props.isSelected)

  return (
    <div className="w-60">
      <Book
        {...props}
        isSelected={isSelected}
        onSelect={() => setIsSelected((selected) => !selected)}
      />
    </div>
  )
}

const meta = {
  title: 'Atoms/Library/Book',
  component: Book,
  tags: ['autodocs'],
  args: {
    book: baseBook,
    isSelected: false,
    onSelect: () => undefined,
  },
  argTypes: {
    onSelect: {
      table: { disable: true },
    },
  },
  render: (args) => (
    <div className="w-60">
      <Book {...args} />
    </div>
  ),
} satisfies Meta<typeof Book>

export default meta
type Story = StoryObj<typeof meta>

export const WithCover: Story = {}

export const InSeries: Story = {
  args: {
    book: makeBookFixture({
      series_id: 1,
      series_title: 'The Library Collection',
      series_index: 2,
    }),
  },
}

export const WithoutCover: Story = {
  args: {
    book: makeBookFixture({
      id: 2,
      title: 'A Book Waiting for Its Cover',
    }),
  },
}

export const BrokenCoverImage: Story = {
  args: {
    book: makeBookFixture({
      id: 3,
      title: 'A Cover That Could Not Be Loaded',
      cover_url: '/covers/this-cover-does-not-exist.jpg',
    }),
  },
}

export const OverflowingTitle: Story = {
  args: {
    book: makeBookFixture({
      id: 4,
      title:
        'The Astonishingly Comprehensive Chronicle of Pneumonoultramicroscopicsilicovolcanoconiosis and Other Unnecessarily Long Words',
    }),
  },
}

export const KannadaTitle: Story = {
  args: {
    book: makeBookFixture({
      id: 5,
      title: 'ಗೀತಾಭಾವಧಾರೆ',
    }),
  },
}

export const Selected: Story = {
  args: {
    isSelected: true,
  },
}

export const InteractiveSelection: Story = {
  render: (args) => <InteractiveBook {...args} />,
}

export const FallbackPaletteCycle: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-8">
      {fallbackBooks.map((book, index) => (
        <Book
          key={book.id}
          book={book}
          bookIndex={index}
          isSelected={false}
          onSelect={() => undefined}
        />
      ))}
    </div>
  ),
}
