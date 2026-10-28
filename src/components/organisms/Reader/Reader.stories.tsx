import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'
import { Reader } from './Reader'
import { createAppStore } from '../../../store/store'
import {
  decreaseTextSize,
  increaseTextSize,
  selectTextSizeStep,
} from '../../../store/textSizeSlice'
import { seedReaderBook } from '../../../../.storybook/helpers/seedReaderBook'

type ReaderStoryArgs = {
  bookId: number
  hasChapter: boolean
  width: number
  height: number
  textSizeStep: number
  fontFamily: string
}

function ShowReader({
  bookId,
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

  return (
    <Provider store={store}>
      <div
        style={{
          width,
          height,
          fontFamily,
          boxShadow: '0 0 10px rgba(0,0,0,0.2)',
        }}
      >
        <Reader bookId={bookId} contentVersion="reader-story-1" />
      </div>
    </Provider>
  )
}

const meta = {
  title: 'Organisms/Reader',
  args: {
    bookId: 91001,
    hasChapter: false,
    width: 360,
    height: 252,
    textSizeStep: 0,
    fontFamily: 'monospace',
  },
  argTypes: {
    bookId: { control: false },
    hasChapter: { control: false },
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
      await seedReaderBook(args.bookId, args.hasChapter)
      return {}
    },
  ],
  render: (args) => <ShowReader key={args.bookId} {...args} />,
} satisfies Meta<ReaderStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const Before: Story = {}

export const Chapter: Story = { args: { bookId: 91002, hasChapter: true } }
