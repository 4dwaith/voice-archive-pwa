import { lazy, Suspense } from 'react'
import { ReaderProvider } from '../../../contexts/ReaderProvider'
import { ReaderControls } from '../../molecules/ReaderControls/ReaderControls'
import { ReaderModeSwitch } from '../../molecules/ReaderControls/ReaderModeSwitch'
import { ReaderPdfBoundary } from '../../molecules/ReaderPdf/ReaderPdfBoundary'
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
              <ReaderPdfBoundary>
                <Suspense
                  fallback={
                    <div className="h-full bg-page">
                      <header className="border-b-2 border-ink p-2 pl-30">
                        <ReaderModeSwitch />
                      </header>
                      <p role="status" className="p-4">
                        Loading PDF…
                      </p>
                    </div>
                  }
                >
                  <ReaderPdf />
                </Suspense>
              </ReaderPdfBoundary>
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
