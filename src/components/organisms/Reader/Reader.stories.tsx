import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { setControlsVisible } from '../../../store/readerSlice'
import { Provider } from 'react-redux'
import { Reader } from './Reader'
import { readerStoryContentVersion } from '../../../mock-data/readerBook'
import { createAppStore } from '../../../store/store'
import { useAppSelector } from '../../../store/hooks'
import {
  decreaseTextSize,
  increaseTextSize,
  selectTextSizeStep,
  selectTextSizePercent,
} from '../../../store/textSizeSlice'
import {
  seedReaderBook,
  type ReaderTocScenario,
} from '../../../../.storybook/helpers/seedReaderBook'

type ReaderStoryArgs = {
  bookId: number
  areControlsVisible: boolean
  hasChapter: boolean
  tocScenario: ReaderTocScenario
  width: number
  height: number
  textSizeStep: number
  fontFamily: string
}

function ApplyStoryTextSize() {
  const textSizePercent = useAppSelector(selectTextSizePercent)

  useEffect(() => {
    const root = document.documentElement
    const previousFontSize = root.style.fontSize
    root.style.fontSize = `${textSizePercent}%`

    return () => {
      root.style.fontSize = previousFontSize
    }
  }, [textSizePercent])

  return null
}

function ShowReader({
  bookId,
  areControlsVisible,
  width,
  height,
  textSizeStep,
  fontFamily,
}: ReaderStoryArgs) {
  const [store] = useState(createAppStore)

  useEffect(() => {
    while (selectTextSizeStep(store.getState()) < textSizeStep)
      store.dispatch(increaseTextSize())
    while (selectTextSizeStep(store.getState()) > textSizeStep)
      store.dispatch(decreaseTextSize())
  }, [store, textSizeStep])

  useEffect(() => {
    store.dispatch(setControlsVisible(areControlsVisible))
  }, [store, areControlsVisible])

  return (
    <Provider store={store}>
      <ApplyStoryTextSize />
      <div
        style={{
          width,
          maxWidth: '100%',
          height,
          fontFamily,
          boxShadow: '0 0 10px rgba(0,0,0,0.2)',
        }}
      >
        <MemoryRouter initialEntries={[`/books/${bookId}`]}>
          <Reader bookId={bookId} contentVersion={readerStoryContentVersion} />
        </MemoryRouter>
      </div>
    </Provider>
  )
}

const meta = {
  title: 'Organisms/Reader',
  parameters: { layout: 'fullscreen' },
  args: {
    bookId: 91001,
    hasChapter: false,
    tocScenario: 'standard',
    areControlsVisible: true,
    width: 960,
    height: 720,
    textSizeStep: 0,
    fontFamily: 'monospace',
  },
  argTypes: {
    areControlsVisible: { control: 'boolean' },
    bookId: { control: false },
    hasChapter: { control: false },
    tocScenario: { control: false },
    width: { control: { type: 'number', min: 160 } },
    height: { control: { type: 'number', min: 160 } },
    textSizeStep: { control: 'select', options: [0, 1, 2, 3] },
    fontFamily: {
      control: 'select',
      options: ['monospace', 'sans-serif', 'serif'],
    },
  },
  // Real measurement commits seed exact local-browser records on first use;
  // revisiting a layout reuses them, including across story switches.
  loaders: [
    async ({ args }) => {
      await seedReaderBook(args.bookId, args.hasChapter, args.tocScenario)
      return {}
    },
  ],
  render: (args) => (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <ShowReader key={args.bookId} {...args} />
    </div>
  ),
} satisfies Meta<ReaderStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const Before: Story = {}

export const ControlsShowing: Story = {
  args: { bookId: 91002, hasChapter: true },
}

export const ControlsHidden: Story = {
  args: { bookId: 91003, hasChapter: true, areControlsVisible: false },
}

export const OverflowingToc: Story = {
  args: { bookId: 91004, hasChapter: true, tocScenario: 'overflowing' },
}

export const UnavailableTocTarget: Story = {
  args: { bookId: 91005, hasChapter: true, tocScenario: 'unavailable' },
}
