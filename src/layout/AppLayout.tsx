import { Outlet, useMatch } from 'react-router'
import { Header } from './Header'
import { useAppSelector } from '../store/hooks'
import { getReaderScope } from '../store/readerSlice'
import { LiveButton } from '../components/atoms/LiveButton/LiveButton'

export function AppLayout() {
  const isBookPage = useMatch('/books/:bookId') !== null

  const hasReader = useAppSelector(getReaderScope) !== null

  return (
    <div className="relative min-h-dvh bg-page text-ink">
      <div className="fixed left-2 top-2 z-30">
        <LiveButton />
      </div>
      {(!isBookPage || !hasReader) && (
        <div
          className={isBookPage ? 'absolute inset-x-0 top-0 z-20' : undefined}
          data-reader-overlay={isBookPage || undefined}
        >
          <Header />
        </div>
      )}
      <main className={isBookPage ? 'h-dvh overflow-hidden' : undefined}>
        <Outlet />
      </main>
    </div>
  )
}
