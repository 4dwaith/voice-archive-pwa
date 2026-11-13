import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

export function SettingsDialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-16px)] w-[calc(100vw-16px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto border-2 border-ink bg-white p-4 text-ink">
          <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
          <Dialog.Close className="min-h-12 rounded-xl border-2 border-ink px-4 font-bold focus-visible:outline-4 focus-visible:outline-accent">
            Close {title.toLowerCase()}
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
