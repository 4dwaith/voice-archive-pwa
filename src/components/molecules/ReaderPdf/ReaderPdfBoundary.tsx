import { Component, type ReactNode } from 'react'
import { ReaderModeSwitch } from '../ReaderControls/ReaderModeSwitch'

export class ReaderPdfBoundary extends Component<
  { children: ReactNode },
  { hasFailed: boolean }
> {
  state = { hasFailed: false }

  static getDerivedStateFromError() {
    return { hasFailed: true }
  }

  render() {
    if (!this.state.hasFailed) return this.props.children

    return (
      <section className="h-full bg-page">
        <header className="border-b-2 border-ink p-2">
          <ReaderModeSwitch />
        </header>
        <p role="alert" className="p-4">
          The PDF could not be opened in this browser. You can return to the
          text.
        </p>
      </section>
    )
  }
}
