import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { useAppLocation, useAppNavigate } from '../routing/navigation'
import {
  requestBookLoad,
  requestBookClose,
  requestBookRetry,
  selectBookDownloadState,
} from '../store/bookDownloadsSlice'
import { useParams } from 'react-router'

export function BookPage() {
  const { bookId: rawId } = useParams()
  const bookId = Number(rawId)
  const location = useAppLocation()
  const navigate = useAppNavigate()
  const book = location.state?.book
  const dispatch = useAppDispatch()
  const downloadState = useAppSelector((state) =>
    selectBookDownloadState(state, bookId),
  )
  const [coverFailed, setCoverFailed] = useState(false)

  useEffect(() => {
    if (!Number.isSafeInteger(bookId) || bookId <= 0) {
      void navigate('/', { replace: true })
      return
    }
    dispatch(requestBookLoad(bookId))
    return () => {
      dispatch(requestBookClose(bookId))
    }
  }, [bookId, dispatch, navigate])

  const loading =
    !downloadState ||
    downloadState.status === 'idle' ||
    downloadState.status === 'loading'

  return (
    <section
      aria-label="Book"
      className="mx-auto flex max-w-xl flex-col items-center gap-6 p-8"
    >
      {loading && book?.cover_url && !coverFailed && (
        <img
          src={book.cover_url}
          alt={`Cover of ${book.title}`}
          className="max-h-80 rounded object-contain"
          onError={() => setCoverFailed(true)}
        />
      )}
      {downloadState?.status === 'error' ? (
        <div role="alert">
          <p>{downloadState.error}</p>
          <button
            type="button"
            onClick={() => dispatch(requestBookRetry(bookId))}
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <p role="status">Loading…</p>
      ) : downloadState?.status === 'empty' ? (
        <p role="status">There’s no text data for this book.</p>
      ) : downloadState?.status === 'offline' ? (
        <p role="status">Available offline.</p>
      ) : null}
      {/* The reader consumes complete root sections from Dexie in phase 11. No text renderer here. */}
    </section>
  )
}
