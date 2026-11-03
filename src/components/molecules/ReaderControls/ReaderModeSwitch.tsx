import { useReaderContext } from '../../../contexts/ReaderContext'

export function ReaderModeSwitch() {
  const { pdf } = useReaderContext().reader
  if (!pdf) return null

  const destination = pdf.viewMode === 'pdf' ? 'text' : 'pdf'
  return (
    <button
      type="button"
      className="min-h-[48px] border-2 border-ink bg-page px-[12px] text-[16px] font-bold focus-visible:outline-4 focus-visible:outline-accent"
      aria-label={`Switch to ${destination === 'pdf' ? 'PDF' : 'Text'}`}
      onClick={() => pdf.setViewMode(destination)}
    >
      {destination === 'pdf' ? 'PDF' : 'Text'}
    </button>
  )
}
