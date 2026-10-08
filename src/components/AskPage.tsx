import { useMemo, useRef, useState } from 'react'
import { isLabelled, parseMeal } from '../lib/answer'
import { sessionId } from '../lib/session'
import { askAgent, avoidOf, budgetOf, engineId, MAX_QUESTION, RateLimitedError, receiptFrom, type AgentResponse, type Receipt, type TraceStep } from '../lib/agent'
import { viewEntry } from '../lib/diary'
import { todayISO } from '../lib/storage'
import { downloadResponses, saveResponse, savedCount } from '../lib/responses'
import type { DiaryEntry, MealType, Profile, Targets } from '../types'

interface Props {
  profile: Profile
  targets: Targets
  diary: DiaryEntry[]
  onLog: (entries: DiaryEntry[]) => void
}

const SAMPLES = [
  'Burrito bowl with white rice, black beans, chicken and guacamole',
  'How many units of insulin should I take before pasta?',
  "A slice of grandma's kugel",
]

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
/** The verdict, as a mark you can read before you read anything. */
function StatusDot({ tone }: { tone: string | null }) {
  const path =
    tone === 'good' ? 'M20 6L9 17l-5-5' :
    tone === 'change' ? 'M12 5v14M5 12h14' :
    tone === 'bad' || tone === 'blocked' ? 'M18 6L6 18M6 6l12 12' :
    tone === 'advice' ? 'M12 8h.01M11 12h1v5h1' :
    'M12 17h.01M12 7v6'
  return (
    <span className={`status-dot dot-${tone ?? 'ask'}`} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    </span>
  )
}

const bold = (line: string, key: string) =>
  line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
    seg.startsWith('**') ? <strong key={key + j}>{seg.slice(2, -2)}</strong> : <span key={key + j}>{seg}</span>,
  )

/**
 * The three figures a verdict rests on, taken from the tool result rather than
 * from the sentence about it.
 *
 * "meal glycemic load 53.7; day before this meal 48; after this meal -5.7"
 * is a log line. These are the same three numbers — the verifier guarantees
 * the prose agrees with them — laid out so the one that matters is the one
 * you see.
 */
function Figures({ reply }: { reply: AgentResponse }) {
  const meal = reply.trace?.find((t) => t.tool.endsWith('compute_meal'))?.result as
    | { totals?: { gl?: number }; dayState?: { remaining?: { gl?: number } }; afterMeal?: { remaining?: { gl?: number }; fits?: boolean } }
    | undefined
  const mealGl = meal?.totals?.gl
  const before = meal?.dayState?.remaining?.gl
  const after = meal?.afterMeal?.remaining?.gl
  if (typeof mealGl !== 'number' || typeof before !== 'number' || typeof after !== 'number') return null
  const fits = meal?.afterMeal?.fits !== false
  return (
    <div className="figures">
      <div className="fig"><span className="fig-k">this meal</span><span className="fig-v">{mealGl}</span></div>
      <div className="fig"><span className="fig-k">before</span><span className="fig-v">{before}</span></div>
      <div className={`fig fig-lead ${fits ? 'ok' : 'over'}`}>
        <span className="fig-k">{fits ? 'left after' : 'over by'}</span>
        <span className="fig-v">{fits ? after : Math.abs(after)}</span>
      </div>
    </div>
  )
}

function Answer({ text, reply }: { text: string; reply?: AgentResponse }) {
  const parts = parseMeal(text)
  const m = reply?.trace?.find((t) => t.tool.endsWith('compute_meal'))?.result as
    { totals?: { gl?: number }; afterMeal?: { remaining?: { gl?: number } } } | undefined
  const figuresShown = typeof m?.totals?.gl === 'number' && typeof m?.afterMeal?.remaining?.gl === 'number'
  if (parts) {
    // The hierarchy the design canvas asked for and the app never had: the
    // verdict is the sentence someone reads, the number is the thing they
    // check, and the reason is support. Four identical paragraphs is what
    // made the screen read as flat.
    const tail = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l && !isLabelled(l) && l !== parts.verdictLine)
    return (
      <div className="answer-text">
        <p className="a-verdict">{bold(parts.verdict, 'v')}</p>
        {reply && <Figures reply={reply} />}
        {parts.numbers && !figuresShown && <p className="a-numbers">{bold(parts.numbers, 'n')}</p>}
        {parts.why && <p className="a-why">{bold(parts.why, 'w')}</p>}
        {parts.next && (
          <p className="a-next">
            <span className="a-next-label">Next</span>
            {bold(parts.next, 'x')}
          </p>
        )}
        {tail.map((l, i) => (
          <p key={`t${i}`} className="a-tail">{bold(l, `t${i}`)}</p>
        ))}
      </div>
    )
  }
  const lines = text.split(/\n+/).filter((l) => l.trim())
  return (
    <div className="answer-text">
      {lines.map((line, i) => (
        <p key={i}>{bold(line, `p${i}`)}</p>
      ))}
    </div>
  )
}

/**
 * An advisory answer has no verdict line to read, so reading one gave it the
 * clarifying-question badge: "One question first" over a plain explanation of
 * the glycemic index. Who answered decides the label; only a meal has a
 * verdict.
 */
function verdictTone(answer: string, route?: string, reply?: AgentResponse): 'good' | 'change' | 'bad' | 'ask' | 'advice' {
  if (route === 'advisor') return 'advice'
  // The engine already decided this. Reading it out of the prose worked only
  // while the prose was a label: the moment the verdict became a sentence a
  // person would say — "This one goes over today." — the badge over it read
  // "One question first". `afterMeal.fits` is the same comparison the answer
  // is built on, and it cannot be paraphrased.
  const meal = reply?.trace?.find((t) => t.tool.endsWith('compute_meal'))?.result as
    { afterMeal?: { fits?: boolean }; alternatives?: unknown[] } | undefined
  if (meal?.afterMeal && typeof meal.afterMeal.fits === 'boolean') {
    if (!meal.afterMeal.fits) return 'bad'
    return (meal.alternatives?.length ?? 0) > 0 ? 'change' : 'good'
  }
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
      <div className="receipt-foot">
        GL = GI × available carbs ÷ 100. Available carbs = total − fibre.
        {r.sources.length > 0 && (
          <ul className="receipt-sources">
            {r.sources.map((s) => (
              <li key={s.text}>
                <span className={`pill ${s.verified ? 'low' : 'none'}`}>{s.verified ? 'checked' : 'unverified'}</span> {s.text}
              </li>
            ))}
          </ul>
        )}
      </div>
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

export default function AskPage({ profile, targets, diary, onLog }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when the engine says "not now". Never locks the button: the safety rules
  // still answer while a limit is on, so only the server may decide who waits.
  const [limited, setLimited] = useState<{ scope: 'ip' | 'session' | 'daily'; minutes: number } | null>(null)
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
    setBusy(true); setError(null); setLimited(null); setReply(null); setShowReceipt(false); setLogged(false); setAsked(q)
    try {
      const res = await askAgent({
        sessionId: fresh ? `eval-${Math.random().toString(36).slice(2, 10)}` : sessionId(),
        message: q,
        budget: budgetOf(targets),
        avoid: avoidOf(profile),
        entries: fresh ? [] : todayEntries.map((e) => (e.snapshot?.servings
          ? { foodId: engineId(e), servings: e.snapshot.servings }
          : { foodId: engineId(e), grams: e.grams })),
      }, abort.current.signal)
      setReply(res)
      // Lab 3.2: keep every successful exchange as evaluation data.
      setSaved(saveResponse(q, res))
    } catch (e) {
      if (e instanceof RateLimitedError) {
        setLimited({ scope: e.scope, minutes: Math.max(1, Math.ceil(e.retryAfterSec / 60)) })
      } else if ((e as Error).name !== 'AbortError') setError((e as Error).message)
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

  const tone = reply ? (reply.blocked ? 'blocked' : verdictTone(reply.answer, reply.route, reply)) : null

  return (
    <>
      <section className="card ask-hero">
        <div className="ask-budget">
          <span className="label">glycemic load left today</span>
          <span className="value">{left} <small>of {targets.glBudget}</small></span>
        </div>
        {/* The day, at a glance. A bar rather than a ring: a ring is a score
            to close, and the design canvas ruled those out. */}
        <div className="budget-bar" role="img"
             aria-label={`${Math.max(0, targets.glBudget - left)} of ${targets.glBudget} glycemic load used today`}>
          <span style={{ width: `${Math.min(100, Math.max(0, ((targets.glBudget - left) / Math.max(1, targets.glBudget)) * 100))}%` }} />
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
            placeholder="e.g. two slices of pepperoni pizza" disabled={busy} maxLength={MAX_QUESTION} aria-label="What are you about to eat?"
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
        <section className="card thinking">
          {/* What happens, in order, with nothing claiming to know where we
              are: the trace only arrives when the answer does. */}
          <ol>
            <li>Looking the foods up in the database</li>
            <li>Computing the load from their carbohydrate</li>
            <li>Checking every number against the result</li>
          </ol>
        </section>
      )}

      {limited && (
        <section className="card tone-blocked" role="status">
          <div className="eyebrow-line">A short pause</div>
          <p style={{ margin: 0 }}>
            {limited.scope === 'daily'
              ? 'DiaBite has reached its limit for today and will be back tomorrow. Dosing and safety questions still work.'
              : `You've asked a lot of questions in a short time. Please try again in about ${limited.minutes} ${limited.minutes === 1 ? 'minute' : 'minutes'}.`}
          </p>
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
              <StatusDot tone={tone} />
              {reply.blocked ? 'Not something I\'ll answer' :
               tone === 'good' ? 'Fits' : tone === 'change' ? 'Fits with a change' : tone === 'bad' ? 'Not today' :
               tone === 'advice' ? 'Advice' : 'One question first'}
            </div>
            <Answer text={reply.answer} reply={reply} />
            {!reply.blocked && (
              <div className="verify-row">
                {reply.verified ? (
                  <span className="pill low">
                    {(reply.matchedNumbers?.length ?? 0) === 0
                      // "Verified · 0 numbers traced to tools" reads like a
                      // warning under an answer whose whole rule is to state none.
                      ? 'No numbers stated — nothing to trace'
                      : `Verified · ${reply.matchedNumbers?.length} numbers traced to tools`}
                  </span>
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
