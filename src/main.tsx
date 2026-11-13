import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'
import './index.css'

if (import.meta.env.VITE_E2E_TESTING_HARNESS === 'true') {
  void import('./testing/contentTestHarness').then((module) =>
    module.installContentTestHarness(),
  )
}
import App from './App.tsx'
import { store } from './store/store'
import { AuthGate } from './layout/AuthGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthGate>
          <App />
        </AuthGate>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
