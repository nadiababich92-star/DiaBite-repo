import { useEffect, useId, useRef, useState } from 'react'
import DayPicker from './DayPicker'
import { dayChipLabel } from '../lib/diary'

interface Props {
  day: string
  today: string
  onChange: (date: string) => void
  /** Increase to open the picker from outside ("Change day" under an answer): it opens and its first button takes the focus. */
  openSignal?: number
}

/**
 * The day a meal is asked about, under the budget on Ask (docs/specs/ask-order-and-day-chip.md, section 3): one chip that
 * reads the day and opens the Day picker under it. Choosing a day, pressing the chip again or Escape closes it. Opening it
 * from the chip leaves the focus on the chip; Escape puts it back there.
 */
export default function DayChip({ day, today, onChange, openSignal = 0 }: Props) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const chip = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const focusFirst = useRef(false)

  // A change of the signal (not its first value) opens the panel and, once it is drawn, focuses its first button.
  const firstSignal = useRef(openSignal)
  useEffect(() => {
    if (openSignal === firstSignal.current) return
    focusFirst.current = true
    setOpen(true)
  }, [openSignal])
  useEffect(() => {
    if (!open || !focusFirst.current) return
    focusFirst.current = false
    panel.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    panel.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [open, openSignal])

  const close = () => { setOpen(false); chip.current?.focus() }

  return (
    <div className="day-chip-row" onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close() } }}>
      <button ref={chip} type="button" className="chip-toggle day-chip" aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}>
        {dayChipLabel(day, today)}<span className="day-chip-caret" aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} ref={panel} className="day-chip-panel">
          <DayPicker value={day} today={today} onChange={(d) => { onChange(d); close() }} />
        </div>
      )}
    </div>
  )
}
