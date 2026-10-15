import { useId, useState } from 'react'
import { clampDate, dateRange, pickerState } from '../lib/diary'

interface Props {
  value: string
  today: string
  onChange: (date: string) => void
  label?: string
  /** The earliest day on offer; defaults to the backdating limit. The Menu plans forward only, so it passes today. */
  min?: string
  /** The chips to show: the Menu has no "Yesterday". */
  chips?: ('today' | 'yesterday' | 'tomorrow')[]
}

const CHIP_LABEL = { today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow' } as const
const offset = (chip: 'today' | 'yesterday' | 'tomorrow') => (chip === 'today' ? 0 : chip === 'yesterday' ? -1 : 1)

function shift(today: string, n: number): string {
  const [y, m, d] = today.split('-').map(Number)
  const t = new Date(y, m - 1, d + n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/**
 * The day a meal goes on: three chips and a native date field. A typed date outside the range snaps to the
 * nearest allowed one and says so, in words. It never takes focus: the chips are plain buttons.
 */
export default function DayPicker({ value, today, onChange, label = 'Day', min, chips = ['today', 'yesterday', 'tomorrow'] }: Props) {
  const id = useId()
  const [note, setNote] = useState('')
  const range = dateRange(today)
  const floor = min && min > range.min ? min : range.min
  const state = pickerState(value, today)

  function typed(raw: string) {
    if (!raw) return
    const c = clampDate(raw, today)
    const date = c.date < floor ? floor : c.date
    setNote(c.moved === 'back' || raw < floor ? (floor === today ? 'Pick today or a day ahead.' : 'You can go back 14 days.') : c.moved === 'ahead' ? 'You can plan 14 days ahead.' : '')
    onChange(date)
  }

  return (
    <div className="day-picker" role="group" aria-labelledby={`${id}-l`}>
      <span className="label" id={`${id}-l`}>{label}</span>
      <div className="chips">
        {chips.map((c) => (
          <button key={c} type="button" className={`chip-toggle${state.chip === c ? ' on' : ''}`} aria-pressed={state.chip === c}
            onClick={() => { setNote(''); onChange(shift(today, offset(c))) }}>
            {CHIP_LABEL[c]}
          </button>
        ))}
        <label className={`chip-toggle date-pick${state.chip === 'date' ? ' on' : ''}`}>
          <span className="date-pick-label">Pick a date</span>
          <input type="date" value={value} min={floor} max={range.max} onChange={(e) => typed(e.target.value)} />
        </label>
      </div>
      <p className="field-hint day-note" role="status" aria-live="polite">{note}</p>
    </div>
  )
}
