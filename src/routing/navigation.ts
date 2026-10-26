import {
  useLocation,
  useNavigate,
  type Location,
  type NavigateOptions,
  type To,
} from 'react-router'
import type { BookResponseOutput } from '../api-client/generated/schemas'

// BrowserRouter does not type history state by route. Keep the shared application
// contract here so navigation writers and readers agree without assertions.
export type AppLocationState = {
  book?: Pick<BookResponseOutput, 'id' | 'cover_url' | 'title'>
}

type AppNavigateOptions = Omit<NavigateOptions, 'state'> & {
  state?: AppLocationState | null
}

type AppNavigateFunction = {
  (to: To, options?: AppNavigateOptions): void | Promise<void>
  (delta: number): void | Promise<void>
}

export function useAppLocation(): Location<AppLocationState | null> {
  return useLocation()
}

export function useAppNavigate(): AppNavigateFunction {
  return useNavigate()
}
