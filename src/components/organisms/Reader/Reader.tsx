import { lazy, Suspense } from 'react'
import { ReaderProvider } from '../../../contexts/ReaderProvider'
import { ReaderControls } from '../../molecules/ReaderControls/ReaderControls'
import { ReaderText, ReaderTextControls } from './ReaderText'
import { useAppSelector } from '../../../store/hooks'
import { getReaderViewMode } from '../../../store/readerSlice'

const ReaderPdf = lazy(() => import('../../molecules/ReaderPdf/ReaderPdf'))

export function Reader({
  bookId,
  contentVersion,
  restorePosition = true,
}: {
  bookId: number
  contentVersion: string
  restorePosition?: boolean
}) {
  const mode = useAppSelector(getReaderViewMode)

  return (
    <ReaderProvider
      bookId={bookId}
      contentVersion={contentVersion}
      restorePosition={restorePosition}
    >
      {(navigation) => (
        <div className="relative h-full w-full" data-reader>
          <ReaderControls
            controls={
              mode === 'text' ? (
                <ReaderTextControls sections={navigation.tocSections} />
              ) : undefined
            }
          >
            {mode === 'pdf' ? (
              <Suspense fallback={<p role="status">Loading PDF…</p>}>
                <ReaderPdf />
              </Suspense>
            ) : (
              <ReaderText
                bookId={bookId}
                contentVersion={contentVersion}
                navigation={navigation}
              />
            )}
          </ReaderControls>
        </div>
      )}
    </ReaderProvider>
  )
}
