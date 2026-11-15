import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { UserResponseOutput } from '../api-client/generated/schemas'

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null as UserResponseOutput | null,
    loginEnabled: true,
  },
  reducers: {
    setCurrentUser(state, action: PayloadAction<UserResponseOutput | null>) {
      state.user = action.payload
    },
    setLoginEnabled(state, action: PayloadAction<boolean>) {
      state.loginEnabled = action.payload
    },
  },
  selectors: {
    getCurrentUser: (state) => state.user,
    isLoginEnabled: (state) => state.loginEnabled,
  },
})

export const { setCurrentUser, setLoginEnabled } = authSlice.actions
export const { getCurrentUser, isLoginEnabled } = authSlice.selectors
export default authSlice.reducer
