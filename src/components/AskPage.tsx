import { useMemo, useRef, useState } from 'react'
import { askAgent, budgetOf, engineId, receiptFrom, type AgentResponse, type Receipt, type TraceStep } from '../lib/agent'
import { viewEntry } from '../lib/diary'
import { todayISO } from '../lib/storage'
import { downloadResponses, saveResponse, savedCount } from '../lib/responses'
import type { DiaryEntry, MealType, Targets } from '../types'

interface Props {
  targets: Targets
  diary: DiaryEntry[]
  onLog: (entries: DiaryEntry[]) => void
}

const SAMPLES = [
  'Burrito bowl with white rice, black beans, chicken and guacamole',
  'How many units of insulin should I take before pasta?',
  "A slice of grandma's kugel",
]

function sessionId(): string {
  try {
    const k = 'diabite.session'
    let v = localStorage.getItem(k)
    if (!v) { v = Math.random().toString(36).slice(2, 10); localStorage.setItem(k, v) }
    return v
  } catch { return 'anon' }
}

/** Lab 3.2: with fresh context every question gets its own session and an empty diary, so saved responses don't depend on each other. */
const FRESH_KEY = 'diabite.freshContext'
function readFresh(): boolean {
  try { return localStorage.getItem(FRESH_KEY) === '1' } catch { return false }
}

function mealForNow(): MealType {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner'
}

/** The agent answers in light markdown: **bold** and line breaks. Nothing else is rendered. */
function Answer({ text }: { text: string }) {
  const lines = text.split(/\n+/).filter((l) => l.trim())
  return (
    <div className="answer-text">
      {lines.map((line, i) => (
        <p key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith('**') ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>,
          )}
        </p>
      ))}
    </div>
  )
}

function verdictTone(answer: string): 'good' | 'change' | 'bad' | 'ask' {
  const first = answer.split('\n')[0].toLowerCase()
  if (first.includes('does not fit') || first.includes("doesn't fit") || first.includes('not today')) return 'bad'
  if (first.includes('with a change') || first.includes('with one change') || first.includes('swap')) return 'change'
  if (first.includes('fits') || first.startsWith('**yes') || first.startsWith('yes')) return 'good'
  return 'ask'
}

function ReceiptView({ r }: { r: Receipt }) {
  return (
    <div className="receipt">
      <div className="receipt-head"><span>food · portion</span><span>avail carbs · GI · GL</span></div>
      {r.lines.map((l) => (
        <div className="receipt-line" key={l.foodId + l.portion}>
          <span>{l.name} <em>{l.portion}</em></span>
          <span>{l.availableCarbs.toFixed(1)} · {l.gi ?? '—'} · <b>{l.gl.toFixed(1)}</b></span>
        </div>
      ))}
      <div className="receipt-total"><span>Meal glycemic load</span><span>{r.total.toFixed(1)}</span></div>
      {r.leftBefore !== null && (
        <>
          <div className="receipt-line muted"><span>Left before this meal</span><span>{r.leftBefore.toFixed(1)}</span></div>
          <div className={`receipt-line ${(r.leftAfter ?? 0) < 0 ? 'over' : 'ok'}`}><span>Left after</span><span>{r.leftAfter?.toFixed(1)}</span></div>
        </>
      )}
      <div className="receipt-foot">GL = GI × available carbs ÷ 100. Available carbs = total − fibre. GI from International Tables (2021).</div>
    </div>
  )
}

function summarize(step: TraceStep): string {
  const res = Array.isArray(step.result) && step.result.length === 1 ? step.result[0] : step.result
  const r = res as Record<string, unknown> | null
  switch (step.tool) {
    case 'resolve_foods': {
      const results = (r?.results as { confidence: string; unknown: boolean }[]) ?? []
      const n = results.length, unk = results.filter((x) => x.unknown).length, ask = results.filter((x) => x.confidence === 'medium').length
      return `${n} phrase${n === 1 ? '' : 's'} looked up${unk ? ` · ${unk} not in the database` : ''}${ask ? ` · ${ask} needed a question` : ''}`
    }
    case 'compute_meal': {
      const t = r?.totals as { gl: number } | undefined
      return t ? `meal GL ${t.gl}` : 'computed'
    }
    case 'get_day_state': {
      const rem = r?.remaining as { gl: number } | undefined
      return rem ? `${rem.gl} GL left before this meal` : 'day state'
    }
    case 'find_alternatives': {
      const alts = (r?.alternatives as { name: string; gl: number }[]) ?? []
      return alts.length ? alts.slice(0, 3).map((a) => `${a.name} ${a.gl}`).join(' · ') : 'no alternatives fit'
    }
    default: return ''
  }
}

export default function AskPage({ targets, diary, onLog }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<AgentResponse | null>(null)
  const [asked, setAsked] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [logged, setLogged] = useState(false)
  const [saved, setSaved] = useState<number>(savedCount)
  const [fresh, setFresh] = useState<boolean>(readFresh)
  const toggleFresh = () => {
    const v = !fresh
    setFresh(v)
    try { localStorage.setItem(FRESH_KEY, v ? '1' : '0') } catch { /* private mode */ }
  }
  const abort = useRef<AbortController | null>(null)

  const today = todayISO()
  const todayEntries = useMemo(() => diary.filter((e) => e.date === today), [diary, today])
  const usedGL = useMemo(() => todayEntries.reduce((s, e) => s + viewEntry(e).gl, 0), [todayEntries])
  const left = Math.max(0, Math.round((targets.glBudget - usedGL) * 10) / 10)

  const receipt = useMemo(() => receiptFrom(reply?.trace), [reply])

  async function ask(message: string) {
    const q = message.trim()
    if (!q || busy) return
    abort.current?.abort()
    abort.current = new AbortController()
    setBusy(true); setError(null); setReply(null); setShowReceipt(false); setLogged(false); setAsked(q)
    try {
      const res = await askAgent({
        sessionId: fresh ? `eval-${Math.random().toString(36).slice(2, 10)}` : sessionId(),
        message: q,
        budget: budgetOf(targets),
        entries: fresh ? [] : todayEntries.map((e) => (e.snapshot?.servings
          ? { foodId: engineId(e), servings: e.snapshot.servings }
          : { foodId: engineId(e), grams: e.grams })),
      }, abort.current.signal)
      setReply(res)
      // Lab 3.2: keep every successful exchange as evaluation data.
      setSaved(saveResponse(q, res))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function logIt() {
    if (!receipt) return
    const meal = mealForNow()
    const stamp = Date.now()
    onLog(receipt.lines.map((l, i) => ({
      id: `${stamp}-${i}`, date: today, meal, foodId: l.foodId, grams: l.grams,
      snapshot: {
        name: l.name, kcal: l.kcal, carbs: l.carbs, fiber: l.fiber, protein: l.protein, fat: l.fat,
        availableCarbs: l.availableCarbs, gi: l.gi, gl: l.gl, servings: l.servings,
      },
    })))
    setLogged(true)
  }

  const tone = reply ? (reply.blocked ? 'blocked' : verdictTone(reply.answer)) : null

  return (
    <>
      <section className="card ask-hero">
        <div className="ask-budget">
          <span className="label">glycemic load left today</span>
          <span className="value">{left} <small>of {targets.glBudget}</small></span>
        </div>
        <h2 className="ask-title">What are you about to eat?</h2>
        <div className="row lab-row">
          {saved > 0 && <button className="ghost" onClick={downloadResponses}>Download Responses</button>}
          {saved > 0 && <span className="muted">{saved} saved</span>}
          <label className="muted lab-toggle">
            <input type="checkbox" checked={fresh} onChange={toggleFresh} />
            Fresh context per question
          </label>
        </div>
        <p className="muted">Say it the way you'd say it to a friend. The agent does the counting — and shows its arithmetic.</p>
        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
          <input
            type="text" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. two slices of pepperoni pizza" disabled={busy} aria-label="What are you about to eat?"
          />
          <button className="primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Thinking…' : 'Ask'}</button>
        </form>
        {!reply && !busy && (
          <div className="chips-col">
            <span className="label">Try one</span>
            {SAMPLES.map((s) => (
              <button key={s} className="chip-btn" onClick={() => { setText(s); ask(s) }}>{s}</button>
            ))}
          </div>
        )}
      </section>

      {busy && (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>Looking up foods, computing the load, checking every number…</p>
        </section>
      )}

      {error && (
        <section className="card tone-blocked">
          <div className="eyebrow-line">Couldn't reach the agent</div>
          <p style={{ margin: 0 }}>{error}</p>
        </section>
      )}

      {reply && (
        <>
          <p className="muted asked">{asked}</p>
          <section className={`card answer tone-${tone}`}>
            <div className="eyebrow-line">
              {reply.blocked ? 'Not something I\'ll answer' :
               tone === 'good' ? 'Fits' : tone === 'change' ? 'Fits with a change' : tone === 'bad' ? 'Not today' : 'One question first'}
            </div>
            <Answer text={reply.answer} />
            {!reply.blocked && (
              <div className="verify-row">
                {reply.verified ? (
                  <span className="pill low">Verified · {reply.matchedNumbers?.length ?? 0} numbers traced to tools</span>
                ) : reply.verifierError ? (
                  <span className="pill medium">Verifier unavailable</span>
                ) : (
                  <span className="pill high">Unverified numbers: {(reply.unmatchedNumbers ?? []).join(', ')}</span>
                )}
              </div>
            )}
          </section>

          {receipt && (
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="primary" onClick={logIt} disabled={logged}>{logged ? 'Logged' : 'Log it'}</button>
              <button className="ghost" onClick={() => setShowReceipt((v) => !v)}>{showReceipt ? 'Hide calculation' : 'Show calculation'}</button>
            </div>
          )}

          {showReceipt && receipt && (
            <section className="card">
              <h2>The receipt</h2>
              <ReceiptView r={receipt} />
            </section>
          )}

          {reply.trace && reply.trace.length > 0 && (
            <section className="card">
              <h2>How this answer was made</h2>
              <ol className="trace">
                {reply.trace.map((t, i) => (
                  <li key={i}>
                    <code>{t.tool}</code>
                    <span>{summarize(t)}</span>
                  </li>
                ))}
                <li className={reply.verified ? 'ok' : 'over'}>
                  <code>verifier</code>
                  <span>{reply.verified ? 'every number in the answer matched a tool result' : `unmatched: ${(reply.unmatchedNumbers ?? []).join(', ') || 'n/a'}`}</span>
                </li>
              </ol>
            </section>
          )}

          <div className="row" style={{ marginBottom: 24 }}>
            <button className="ghost" onClick={() => { setReply(null); setText(''); setError(null) }}>Ask something else</button>
          </div>
        </>
      )}
    </>
  )
}
