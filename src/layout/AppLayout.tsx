import { Outlet } from 'react-router'
import { Header } from './Header'

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
