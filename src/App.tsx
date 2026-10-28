import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './layout/AppLayout'
import { LibraryPage } from './pages/LibraryPage'
import { BookPage } from './pages/BookPage'
import { useAppSelector } from './store/hooks'
import { selectTextSizePercent } from './store/textSizeSlice'

function App() {
  const textSizePercent = useAppSelector(selectTextSizePercent)

  useEffect(() => {
    document.documentElement.style.fontSize = `${textSizePercent}%`

    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [textSizePercent])

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LibraryPage />} />
        <Route path="books/:bookId" element={<BookPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
