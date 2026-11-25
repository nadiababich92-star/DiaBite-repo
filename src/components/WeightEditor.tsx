import { useEffect, useRef, useState } from 'react'
import type { Receipt, ReceiptLine } from '../lib/agent'
import { WEIGHTS_WHY } from '../lib/answer'
import { foodHead, gramsShown, measureLabel, ouncesText, typedNumber, unitLabel, weightUnits } from '../lib/measure'

/**
 * The portion editor and the weight field (docs/specs/recorrect-screen.md): each food's weight as a button that opens a number field and a unit,
 * and the card's line "Weights I used". Presentational: AskPage keeps the state and asks the engine; nothing here converts a unit or computes a number.
 */

/** What the person typed for one line: the count and the unit, exactly as typed. The browser converts nothing; the engine turns it into grams. */
export interface TypedQuantity { count: number; unit: string }

/** What the portion editor needs to let a weight be typed: the state AskPage keeps (docs/specs/recorrect-screen.md). */
export interface WeightEdit {
  typed: Record<number, TypedQuantity>
  mine: number[]
  fieldFor: number | null
  setFieldFor: (i: number | null) => void
  /** The engine's lines for the recalculated card, put against the editor's lines (a line taken out has none). */
  aligned: (ReceiptLine | undefined)[]
  commit: (i: number, q: TypedQuantity) => void
  cancel: () => void
  /** The engine could not weigh what was typed for this line: what was typed and what to say under the field. */
  refusal: { index: number; count: string; unit: string; message: string } | null
}

interface WeightFieldProps { line: ReceiptLine; units?: 'imperial' | 'metric'; assumed: boolean; error?: string; initial?: { count: string; unit: string }; onCommit: (q: TypedQuantity) => void; onCancel: () => void }

/** The number field and the unit select that replace a weight while it is being typed. Enter or Done commits, Esc or Cancel leaves; the engine checks the bounds. */
export function WeightField({ line, units, assumed, error, initial, onCommit, onCancel }: WeightFieldProps) {
  const imperial = units === 'imperial'
  const base = weightUnits({ imperial, assumed, lineUnits: line.units, current: line.quantity && line.quantity.unit !== 'default' ? line.quantity : undefined })
  const options = base.options
  const [unit, setUnit] = useState(initial && options.includes(initial.unit) ? initial.unit : base.start)
  const [text, setText] = useState(initial ? initial.count : (unit === base.start ? base.count : ''))
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { field.current?.focus(); field.current?.select() }, [])
  const n = typedNumber(text)
  return (
    <form
      className="weight-edit"
      onSubmit={(e) => { e.preventDefault(); if (n !== null) onCommit({ count: n, unit }) }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }}
    >
      <label className="field weight-field">
        <span>Weight of {line.name}</span>
        <input ref={field} type="text" inputMode="decimal" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{unitLabel(o)}</option>)}
      </select>
      <button type="submit" className="primary" disabled={n === null}>Done</button>
      <button type="button" className="link" onClick={onCancel}>Cancel</button>
      {error && <p className="muted weight-error" role="alert">{error}</p>}
    </form>
  )
}

/** The card's line "Weights I used", built from the engine's `basis` per line (never the agent's sentence): what is still assumed, each weight a button, and one sentence saying why it matters (tracker #75). */
export function WeightsUsed({ lines, onEdit }: { lines: { line: ReceiptLine; index: number }[]; onEdit: (i: number) => void }) {
  const assumed = lines.filter(({ line }) => line.basis && line.basis !== 'stated' && line.said)
  if (assumed.length === 0) return null
  return (
    <div className="weights-used-block" data-tour="weights">
      <p className="a-why weights-used">
        <span>Weights I used:</span>
        {/* The comma sits inside the button, after the underlined words, so a long name that wraps never leaves it alone on a line (25 November 2026). */}
        {assumed.map(({ line, index }, k) => (
          <button key={`${line.foodId}-${index}`} type="button" className="weight-btn weight-btn-inline" aria-label={`Change the weight of ${line.name}, now ${line.said}`} onClick={() => onEdit(index)}><span className="weight-btn-text">{foodHead(line.name)} {line.said}</span>{k < assumed.length - 1 ? ',' : '.'}</button>
        ))}
      </p>
      <p className="muted weights-why">{WEIGHTS_WHY}</p>
    </div>
  )
}

/**
 * Each food's weight, with a step down and a step up. The engine does the sums when the weight settles.
 * For a dish counted from an assumed recipe it is the composition card: an ingredient can also be taken
 * out and put back, and the whole thing reset to what the agent suggested.
 */
export function PortionEditor({ lines, grams, units, busy, error, onNudge, assumed, removed, onRemove, onReset, weightEdit }: {
  lines: ReceiptLine[]; grams: Record<number, number>; units?: 'imperial' | 'metric'; busy: boolean; error: string; onNudge: (i: number, dir: 1 | -1) => void
  assumed?: Receipt['assumed']; removed: number[]; onRemove: (i: number) => void; onReset: () => void
  /** The state for typing a weight. */
  weightEdit: WeightEdit
}) {
  const edited = Object.keys(grams).length > 0 || removed.length > 0 || Object.keys(weightEdit.typed).length > 0
  // After a field closes, focus returns to the weight it was opened from.
  const buttons = useRef<Record<number, HTMLButtonElement | null>>({})
  const opened = useRef<number | null>(null)
  useEffect(() => {
    if (weightEdit.fieldFor !== null) { opened.current = weightEdit.fieldFor; return }
    if (opened.current !== null) { buttons.current[opened.current]?.focus(); opened.current = null }
  }, [weightEdit.fieldFor])
  return (
    <section className="card portions">
      <h2>{assumed ? "Not your recipe?" : 'Not what you ate?'}</h2>
      <p className="muted">{assumed ? 'Change a gram or take an ingredient out and the engine counts it again.' : 'Change a portion and the engine counts it again.'}</p>
      <ul className="portion-list">
        {lines.map((l, i) => {
          const value = grams[i] ?? l.servings ?? l.grams
          const unit = l.servings ? (value === 1 ? 'serving' : 'servings') : 'g'
          // On US units, a food with a measure in its own table is moved by that measure and shows it beside the grams.
          const said = units === 'imperial' && !l.servings ? measureLabel(value, l.measureUnit) : null
          // No measure for this food: the weight in ounces, beside the grams (US units only; the grams are what is counted).
          const oz = units === 'imperial' && !l.servings && !said ? ouncesText(value) : null
          const gone = removed.includes(i)
          // The same rounding as the receipt ("113 g"): the engine's 113.4 is counted, not shown.
          const shown = l.servings ? value : gramsShown(value)
          // A weight the person changed on this card is theirs, and the engine's words for it are what is shown; one still assumed says so.
          const rl = weightEdit.aligned[i]
          const theirs = weightEdit.mine.includes(i) && rl?.basis === 'stated'
          const typicalSize = !theirs && (rl ?? l).basis === 'typical'
          const open = weightEdit.fieldFor === i && !gone && !l.servings
          const weightText = theirs && rl?.said ? rl.said : said ? `${said} · ${shown} ${unit}` : oz ? `${oz} · ${shown} ${unit}` : `${shown} ${unit}`
          const refusal = weightEdit.refusal?.index === i ? weightEdit.refusal : null
          return (
            <li key={`${l.foodId}-${i}`} className={[gone ? 'removed' : '', open ? 'editing' : ''].filter(Boolean).join(' ') || undefined}>
              <span className="portion-name">
                {l.name}
                {assumed?.assumedFoodIds.includes(l.foodId) && <> <span className="pill none assumed">assumed</span></>}
                {typicalSize && <> <span className="pill none typical">typical size</span></>}
                {theirs && <> <span className="pill none mine">your weight</span></>}
                {gone && <> <span className="pill none">left out</span></>}
              </span>
              {gone ? (
                <button className="link" aria-label={`Put ${l.name} back`} onClick={() => onRemove(i)}>Put back</button>
              ) : open ? (
                <WeightField line={rl ?? l} units={units} assumed={!!assumed} error={refusal?.message}
                  initial={refusal ? { count: refusal.count, unit: refusal.unit } : undefined}
                  onCommit={(q) => weightEdit.commit(i, q)} onCancel={weightEdit.cancel} />
              ) : (
                <span className="stepper">
                  <button className="step" aria-label={`Less ${l.name}`} onClick={() => onNudge(i, -1)}>−</button>
                  {l.servings
                    ? <span className="step-v" aria-live="polite">{weightText}</span>
                    : <button type="button" className="step-v weight-btn" ref={(el) => { buttons.current[i] = el }} aria-live="polite"
                        aria-label={`Change the weight of ${l.name}, now ${weightText.replace(' · ', ', ').replace(/(\d) g\b/, '$1 grams')}`} onClick={() => weightEdit.setFieldFor(i)}>{weightText}</button>}
                  <button className="step" aria-label={`More ${l.name}`} onClick={() => onNudge(i, 1)}>+</button>
                  {assumed && <button className="step remove-step" aria-label={`Remove ${l.name}`} onClick={() => onRemove(i)}>×</button>}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {assumed && edited && <button className="link" onClick={onReset}>Reset to the suggestion</button>}
      <p className="muted portion-state" role="status">{busy ? 'Counting again…' : error}</p>
    </section>
  )
}
