// @vitest-environment jsdom
import { configureStore } from '@reduxjs/toolkit'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { archiveApi } from '../../src/api-client/archiveApi'
import textSize from '../../src/store/textSizeSlice'
import { book } from '../api-client/fixtures/book'

const store = configureStore({
  reducer: { textSize, [archiveApi.reducerPath]: archiveApi.reducer },
  middleware: (defaults) => defaults().concat(archiveApi.middleware),
})

afterEach(() => {
  cleanup()
  store.dispatch(archiveApi.util.resetApiState())
})

it('preserves the app text-size setting when library data arrives asynchronously', async () => {
  let finish!: (response: Response) => void

  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    ),
  )

  render(
    <Provider store={store}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </Provider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Make text larger' }))

  expect(document.documentElement.style.fontSize).toBe('112.5%')

  await waitFor(() => expect(finish).toBeDefined())
  await act(async () =>
    finish(Response.json({ items: [book], offset: 0, limit: 24, total: 1 })),
  )
  await screen.findByRole('button', { name: `Select ${book.title}` })

  expect(document.documentElement.style.fontSize).toBe('112.5%')
})
