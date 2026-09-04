import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookModel } from '../models/book'
import { Book } from './Book'

const baseBook: BookModel = {
  id: 1,
  title: 'Pride and Prejudice',
  coverImage: '/covers/pride-and-prejudice.jpg',
  mark: 'PP',
}

const fallbackBooks: BookModel[] = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  title: `Book without a cover ${index + 1}`,
  mark: `${index + 1}`,
}))

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
  title: 'Library/Book',
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

export const WithoutCover: Story = {
  args: {
    book: {
      id: 2,
      title: 'A Book Waiting for Its Cover',
      mark: 'BW',
    },
  },
}

export const BrokenCoverImage: Story = {
  args: {
    book: {
      id: 3,
      title: 'A Cover That Could Not Be Loaded',
      coverImage: '/covers/this-cover-does-not-exist.jpg',
      mark: 'BC',
    },
  },
}

export const OverflowingTitle: Story = {
  args: {
    book: {
      id: 4,
      title:
        'The Astonishingly Comprehensive Chronicle of Pneumonoultramicroscopicsilicovolcanoconiosis and Other Unnecessarily Long Words',
      mark: 'LONG',
    },
  },
}

export const EmptyInitials: Story = {
  args: {
    book: {
      id: 5,
      title: 'A Book with No Initials',
      mark: '',
    },
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
