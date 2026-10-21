import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookShelf } from './BookShelf'
import { books, makeBookFixture } from '../../mock-data/books'
import { ScrollingShelf } from '../../../.storybook/helpers/ScrollingShelf'

const meta = {
  title: 'Library/BookShelf',
  component: BookShelf,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    books,
    total: books.length,
    selectedBookId: null,
    onSelect: () => undefined,
    onLoadMore: () => undefined,
    onRetry: () => undefined,
  },
} satisfies Meta<typeof BookShelf>

export default meta

type Story = StoryObj<typeof meta>

export const EndOfLibrary: Story = {}

export const InitialLoading: Story = {
  args: { books: [], total: undefined, isLoading: true },
}

export const EmptyLibrary: Story = { args: { books: [], total: 0 } }

export const UnableToLoadLibrary: Story = {
  args: { books: [], total: undefined, hasError: true },
}

export const LoadingMore: Story = {
  args: { isLoadingMore: true, hasMore: true, total: 30 },
}

export const UnableToLoadMoreBooks: Story = {
  args: { hasError: true, hasMore: true, total: 30 },
}

export const MoreBooksAvailable: Story = { args: { hasMore: true, total: 30 } }

export const MultilingualAndLongTitles: Story = {
  args: {
    books: [
      { id: 1, title: 'ಗೀತಾಭಾವಧಾರೆ' },
      { id: 2, title: 'ರುದ್ರ ಚಮಕ' },
      { id: 3, title: '日本語の本' },
      { id: 4, title: 'كتاب الحكمة' },
      {
        id: 5,
        title:
          'The Astonishingly Comprehensive Chronicle of Pneumonoultramicroscopicsilicovolcanoconiosis and Other Unnecessarily Long Words',
      },
      { id: 6, title: 'A Broken Cover', cover_url: '/covers/missing.jpg' },
    ].map(makeBookFixture),
  },
}

function InteractiveShelf() {
  const [selected, select] = useState<number | null>(null)
  const [count, setCount] = useState(3)

  return (
    <BookShelf
      books={books.slice(0, count)}
      total={books.length}
      selectedBookId={selected}
      onSelect={select}
      hasMore={count < books.length}
      onLoadMore={() => setCount((value) => Math.min(value + 3, books.length))}
      onRetry={() => undefined}
    />
  )
}

export const NarrowShelf: Story = {
  args: MultilingualAndLongTitles.args,
  render: (args) => (
    <div className="w-80 max-w-full">
      <BookShelf {...args} />
    </div>
  ),
}

export const SelectedBook: Story = { args: { selectedBookId: books[0].id } }

export const Interactive: Story = { render: () => <InteractiveShelf /> }

export const InfiniteScroll: Story = {
  render: () => <ScrollingShelf />,
}

export const InfiniteScrollFailure: Story = {
  render: () => <ScrollingShelf failNextLoad />,
}
