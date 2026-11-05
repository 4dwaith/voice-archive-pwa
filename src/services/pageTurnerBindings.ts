export const livePageTurnerBinding = {
  key: 'MediaPlay',
  gesture: 'Right hold',
  action: 'Start/continue or stop Live',
  scope: 'app',
} as const

export const readerPageTurnerBindings = [
  {
    key: 'MediaTrackPrevious',
    gesture: 'Left double tap',
    action: 'Play/pause narration',
    scope: 'ready Text reader',
  },
  {
    key: 'MediaTrackNext',
    gesture: 'Right double tap',
    action: 'Switch Text/PDF',
    scope: 'reader',
  },
] as const
