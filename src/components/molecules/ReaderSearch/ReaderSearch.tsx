import { useRef, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useReaderContext } from '../../../contexts/ReaderContext'

const buttonClass =
  'min-h-12 rounded-lg border-2 border-ink px-3 font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40'

export function ReaderSearch() {
  const search = useReaderContext().reader.search
  const [query, setQuery] = useState('')
  const [isInvalid, setInvalid] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const reopen = useRef<HTMLButtonElement>(null)
  if (!search) return null

  function submitQuery(event: FormEvent) {
    event.preventDefault()
    setInvalid(!query.trim())
    if (query.trim()) search?.submitQuery(query)
  }

  return (
    <Dialog.Root open={search.isOpen} onOpenChange={search.setOpen}>
      <form
        aria-label="Book search"
        onSubmit={submitQuery}
        className="flex items-center gap-2"
      >
        <Dialog.Trigger asChild>
          <button
            ref={reopen}
            type="button"
            className={buttonClass}
            disabled={search.status === 'idle'}
            aria-label="Reopen search results"
          >
            Results
          </button>
        </Dialog.Trigger>
        <input
          ref={input}
          type="search"
          aria-label="Search book text"
          aria-invalid={isInvalid}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-12 min-w-0 flex-1 rounded-lg border-2 border-ink px-2 focus-visible:outline-4 focus-visible:outline-accent"
        />
        <button type="submit" className={buttonClass}>
          Search
        </button>
        {isInvalid && <span role="alert">Enter a search phrase.</span>}
      </form>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            // Clear disables the trigger; return to the editable search field instead.
            if (reopen.current?.disabled) {
              event.preventDefault()
              input.current?.focus({ preventScroll: true })
            }
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            title.current?.focus()
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 border-2 border-ink bg-white p-4"
        >
          <Dialog.Title ref={title} tabIndex={-1} className="text-xl font-bold">
            Search results
          </Dialog.Title>
          <Dialog.Description>
            Choose an occurrence to open its text.
          </Dialog.Description>
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setQuery('')
                setInvalid(false)
                search.clear()
              }}
            >
              Clear search
            </button>
            <Dialog.Close className={buttonClass}>Close search</Dialog.Close>
          </div>
          {search.status === 'loading' && <p role="status">Searching…</p>}
          {search.error && <p role="alert">{search.error}</p>}
          {search.resultsQuery && <p>Results for “{search.resultsQuery}”</p>}
          {search.status === 'succeeded' && search.results.length === 0 && (
            <p role="status">No matches.</p>
          )}
          <ol
            className="min-h-0 overflow-y-auto"
            aria-label="Matching occurrences"
          >
            {search.results.map((result) => (
              <li
                key={`${result.segmentId}:${result.offset}`}
                className="border-t-2 border-ink py-2"
              >
                <button
                  type="button"
                  onClick={() => search.openResult(result)}
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
