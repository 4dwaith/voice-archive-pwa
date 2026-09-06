import { Outlet } from 'react-router'
import { Footer } from './Footer'
import { Header } from './Header'

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <Header />
      <main className="pb-52 sm:pb-44">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
