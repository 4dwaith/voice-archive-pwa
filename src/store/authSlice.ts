import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { UserResponseOutput } from '../api-client/generated/schemas'

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null as UserResponseOutput | null },
  reducers: {
    setCurrentUser(state, action: PayloadAction<UserResponseOutput | null>) {
      state.user = action.payload
    },
  },
  selectors: { getCurrentUser: (state) => state.user },
})

export const { setCurrentUser } = authSlice.actions
export const { getCurrentUser } = authSlice.selectors
export default authSlice.reducer
