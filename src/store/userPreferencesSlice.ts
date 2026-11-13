import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export const preferredLanguages = ['english', 'kannada'] as const
export type PreferredLanguage = (typeof preferredLanguages)[number]

const userPreferencesSlice = createSlice({
  name: 'userPreferences',
  initialState: { preferredLanguage: 'english' as PreferredLanguage },
  reducers: {
    setPreferredLanguage(state, action: PayloadAction<PreferredLanguage>) {
      state.preferredLanguage = action.payload
    },
  },
  selectors: {
    getPreferredLanguage: (state) => state.preferredLanguage,
  },
})

export const { setPreferredLanguage } = userPreferencesSlice.actions
export const { getPreferredLanguage } = userPreferencesSlice.selectors
export default userPreferencesSlice.reducer
