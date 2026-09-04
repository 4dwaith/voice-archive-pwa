import { useEffect, useState } from 'react'
import { Book } from './components/Book'
import { Header } from './layout/Header'
import { books } from './mock-data/books'
import { useAppSelector } from './store/hooks'
import { selectTextSizePercent } from './store/textSizeSlice'

function App() {
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null)
  const textSizePercent = useAppSelector(selectTextSizePercent)

  useEffect(() => {
    document.documentElement.style.fontSize = `${textSizePercent}%`

    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [textSizePercent])

  const selectedBook = books.find((book) => book.id === selectedBookId)

  return (
    <main className="min-h-dvh bg-page text-ink">
      <Header />

      <section
        className="mx-auto px-5 py-8 sm:px-8"
        aria-labelledby="books-heading"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="books-heading" className="text-3xl font-bold tracking-tight">
            Books
          </h2>
          <p className="text-lg font-medium text-muted">{books.length} books</p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-x-6 gap-y-9">
          {books.map((book, index) => (
            <Book
              key={book.id}
              book={book}
              bookIndex={index}
              isSelected={book.id === selectedBookId}
              onSelect={setSelectedBookId}
            />
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          {selectedBook ? `${selectedBook.title} selected` : ''}
        </p>
      </section>
    </main>
  )
}

export default App
