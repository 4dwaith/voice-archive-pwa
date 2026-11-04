import { useRef, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useReaderContext } from '../../../contexts/ReaderContext'
import { LiveButton } from '../../atoms/LiveButton/LiveButton'

const buttonClass =
  'min-h-12 rounded-lg border-2 border-ink px-3 font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40'

export function ReaderSearch() {
  const { search, audio } = useReaderContext().reader
  const [query, setQuery] = useState(search?.resultsQuery ?? '')
  const [isInvalid, setInvalid] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  if (!search) return null

  function submitQuery(event: FormEvent) {
    event.preventDefault()
    setInvalid(!query.trim())
    if (query.trim()) search?.submitQuery(query)
  }

  return (
    <Dialog.Root open={search.isOpen} onOpenChange={search.setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={buttonClass} aria-label="Search book">
          Search
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            input.current?.focus()
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-16px)] w-[calc(100vw-16px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto border-2 border-ink bg-white p-4"
        >
          <header className="flex items-center gap-3">
            <LiveButton />
            <Dialog.Title className="shrink-0 text-xl font-bold">
              Book search
            </Dialog.Title>
          </header>
          <Dialog.Description className="shrink-0">
            Choose an occurrence to open its text.
          </Dialog.Description>
          <form
            aria-label="Book search"
            onSubmit={submitQuery}
            className="flex shrink-0 flex-wrap items-center gap-2"
          >
            <input
              ref={input}
              type="search"
              aria-label="Search book text"
              aria-invalid={isInvalid}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-12 w-full min-w-0 rounded-lg border-2 border-ink px-2 focus-visible:outline-4 focus-visible:outline-accent"
            />
            <button type="submit" className={buttonClass}>
              Search
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setQuery('')
                setInvalid(false)
                search.clear()
                input.current?.focus()
              }}
            >
              Clear search
            </button>
            <Dialog.Close type="button" className={buttonClass}>
              Close search
            </Dialog.Close>
            {isInvalid && (
              <p role="alert" className="w-full">
                Enter a search phrase.
              </p>
            )}
          </form>
          {search.status === 'loading' && <p role="status">Searching…</p>}
          {search.error && <p role="alert">{search.error}</p>}
          {search.resultsQuery && <p>Results for “{search.resultsQuery}”</p>}
          {search.status === 'succeeded' && search.results.length === 0 && (
            <p role="status">No matches.</p>
          )}
          <ol className="shrink-0" aria-label="Matching occurrences">
            {search.results.map((result) => (
              <li
                key={`${result.segmentId}:${result.offset}`}
                className="border-t-2 border-ink py-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    audio?.pausePlayback({ restartFromPage: true })
                    search.openResult(result)
                  }}
                  className="min-h-12 w-full p-2 text-left focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-accent"
                >
                  <span className="block font-bold">{result.chapterTitle}</span>{' '}
                  <span>
                    {result.before}
                    <strong>{result.match}</strong>
                    {result.after}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
