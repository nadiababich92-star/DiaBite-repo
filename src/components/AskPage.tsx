import { useEffect, useMemo, useRef, useState } from 'react'
import { boldSegments, isLabelled, parseMeal } from '../lib/answer'
import { sessionId } from '../lib/session'
import { accessToken } from '../lib/auth'
import Tour from './Tour'
import FeedbackNudge from './FeedbackNudge'
import { nextStep, type TourStep } from '../lib/tour'
import { markAsked, nextNudge, nudgeFacts, sanitizeAsked, type Milestone } from '../lib/nudge'
import { askAgent, avoidOf, budgetOf, engineId, lastMealCall, MAX_QUESTION, RateLimitedError, receiptFrom, recomputeMeal, SignInRequiredError, type AgentResponse, type Receipt, type ReceiptLine, type Recalc, type TraceStep } from '../lib/agent'
import { dayLabel, eaten, mealForNow, viewEntry } from '../lib/diary'
import { swapNamedIn, type SwapOffer } from '../lib/swap'
import { MEAL_LABELS } from '../lib/menu'
import DayPicker from './DayPicker'
import { loadNudge, saveNudge } from '../lib/storage'
import { useToday } from '../lib/useToday'
import { isDemo } from '../lib/demo'
import { downloadResponses, saveResponse, savedCount } from '../lib/responses'
import type { CountBy, DiaryEntry, MealType, Profile, Targets } from '../types'

interface Props {
  profile: Profile
  targets: Targets
  diary: DiaryEntry[]
  onLog: (entries: DiaryEntry[]) => void
  /** Take the person to the Diary, from the note that says where a meal went. */
  onOpenDiary?: () => void
  /** Where the Diary sent the person: the day and meal their next "Log it" goes to, until they clear it or leave Ask. */
  logTarget?: { date: string; meal: MealType } | null
  onClearTarget?: () => void
  /** The engine said the sign-in is no longer good (it expired, or sign-in became required). */
  onSessionEnded?: () => void
  /** First-run tips: which were shown, how to record one, and whether another dialog is open. */
  tourSeen: readonly TourStep[]
  onTourSeen: (seen: TourStep[]) => void
  tourSuspended: boolean
}

const SAMPLES = [
  'Burrito bowl with white rice, black beans, chicken and guacamole',
  'How many units of insulin should I take before pasta?',
  "A slice of grandma's cholent",
]

/** The feedback card shown since the page loaded, if it is still on screen: one card per visit, kept across tab switches. */
let visitCard: Milestone | null = null
let visitCardShown = false

/** Lab 3.2: with fresh context every question gets its own session and an empty diary, so saved responses don't depend on each other. */
const FRESH_KEY = 'diabite.freshContext'
function readFresh(): boolean {
  // In a demo the toggle is hidden, so a value left in this browser must not act unseen.
  if (isDemo) return false
  try { return localStorage.getItem(FRESH_KEY) === '1' } catch { return false }
}


/** The agent answers in light markdown: **bold** and line breaks. Nothing else is rendered. */
/** The verdict, as a mark you can read before you read anything. */
export function StatusDot({ tone }: { tone: string | null }) {
  const path =
    tone === 'good' ? 'M20 6L9 17l-5-5' :
    tone === 'change' ? 'M12 5v14M5 12h14' :
    tone === 'bad' || tone === 'blocked' ? 'M18 6L6 18M6 6l12 12' :
    tone === 'advice' || tone === 'carbs' || tone === 'estimate' ? 'M12 8h.01M11 12h1v5h1' :
    'M12 17h.01M12 7v6'
  return (
    <span className={`status-dot dot-${tone ?? 'ask'}`} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    </span>
  )
}

const bold = (line: string, key: string) =>
  boldSegments(line).map((seg, j) => (seg.strong ? <strong key={key + j}>{seg.text}</strong> : <span key={key + j}>{seg.text}</span>))

/**
 * The three figures a verdict rests on, taken from the tool result rather than
 * from the sentence about it.
 *
 * "meal glycemic load 53.7; day before this meal 48; after this meal -5.7"
 * is a log line. These are the same three numbers — the verifier guarantees
 * the prose agrees with them — laid out so the one that matters is the one
 * you see.
 */
function Figures({ reply, countBy }: { reply: AgentResponse; countBy: CountBy }) {
  const meal = lastMealCall(reply.trace)?.result as
    | { totals?: { gl?: number; carbs?: number; availableCarbs?: number }; dayState?: { remaining?: { gl?: number } }; afterMeal?: { remaining?: { gl?: number }; fits?: boolean | null }; assumed?: boolean }
    | undefined
  const mealGl = meal?.totals?.gl
  // A meal of branded products only: the three tiles are what the label gives —
  // carbohydrate, fibre, calories — and none of them is a load or a verdict.
  const items = (meal as { items?: { loadAvailable?: boolean }[] } | undefined)?.items ?? []
  if (items.length > 0 && items.every((it) => it.loadAvailable === false)) {
    const t = (meal as { totals?: { carbs?: number; fiber?: number; kcal?: number } }).totals
    if (typeof t?.carbs !== 'number') return null
    return (
      <div className="figures">
        <div className="fig"><span className="fig-k">carbohydrate</span><span className="fig-v">{t.carbs} g</span></div>
        <div className="fig"><span className="fig-k">fibre</span><span className="fig-v">{t.fiber ?? 0} g</span></div>
        <div className="fig"><span className="fig-k">calories</span><span className="fig-v">{t.kcal} kcal</span></div>
      </div>
    )
  }
  const before = meal?.dayState?.remaining?.gl
  const after = meal?.afterMeal?.remaining?.gl
  if (typeof mealGl !== 'number' || typeof before !== 'number' || typeof after !== 'number') return null
  // `null` is a partial meal: what was costed still leaves room, but a food is
  // missing from the sum, so the figure is shown as "so far", not as a verdict.
  const partial = meal?.afterMeal?.fits === null
  const fits = meal?.afterMeal?.fits !== false
  return (
    <>
      <FigurePair countBy={countBy} gl={{ mealGl, before, after, fits, partial, assumed: meal?.assumed }} carbs={meal?.totals as CarbFigures | undefined} />
    </>
  )
}

interface CarbFigures { carbs?: number; availableCarbs?: number; fiber?: number }

/**
 * Both ways of counting, always shown, side by side, each in its own colour: the load in the lime marker, the
 * carbohydrate in blue. The one the person said they use is on the left. The verdict is still the engine's `fits`,
 * which is worked out from the glycemic load, and a line says so when the carbohydrate comes first.
 */
function FigurePair({ countBy, gl, carbs }: {
  countBy: CountBy
  gl: { mealGl: number; before: number; after: number; fits: boolean; partial: boolean; assumed?: boolean }
  carbs?: CarbFigures
}) {
  const glBlock = (
    <div key="gl" className="fig-card gl">
      <p className="fig-title">Glycemic load (GL)</p>
      <p className={`fig-big gl ${gl.partial || gl.assumed ? '' : gl.fits ? 'ok' : 'over'}`}><span className="num">{gl.fits ? gl.after : Math.abs(gl.after)}</span></p>
      <p className="fig-cap">{gl.partial ? 'left so far' : gl.fits ? 'left after' : 'over by'}</p>
      <div className="fig-row"><span className="fig-k">this meal</span><span className="fig-v">{gl.mealGl}</span></div>
      <div className="fig-row"><span className="fig-k">before</span><span className="fig-v">{gl.before}</span></div>
    </div>
  )
  const carbBlock = typeof carbs?.carbs === 'number' ? (
    <div key="carbs" className="fig-card carb">
      <p className="fig-title">Carbohydrate</p>
      <p className="fig-big carb"><span className="num">{carbs.carbs} g</span></p>
      <p className="fig-cap">{gl.partial ? 'so far' : gl.assumed ? 'about, in this meal' : 'in this meal'}</p>
      {typeof carbs.fiber === 'number' && <div className="fig-row"><span className="fig-k">fibre</span><span className="fig-v">{carbs.fiber} g</span></div>}
      {typeof carbs.availableCarbs === 'number' && <div className="fig-row"><span className="fig-k">without fibre</span><span className="fig-v">{carbs.availableCarbs} g</span></div>}
    </div>
  ) : null
  return (
    <>
      <div className="fig-pair">{countBy === 'carbs' ? [carbBlock, glBlock] : [glBlock, carbBlock]}</div>
      {countBy === 'carbs' && carbBlock && <p className="muted fig-basis">You count by carbohydrate, so it comes first. The verdict above is worked out from the glycemic load.</p>}
    </>
  )
}

/**
 * The same meal at the weights the person chose, costed by the engine. The verdict
 * word is the engine's `fits` and nothing else: true, false, or null for a meal with
 * a food missing. No number here is worked out in the browser.
 */
/** Shows its children, or folds them under a title: the original answer, once a recalculation has replaced it at the top. */
function Fold({ when, title, children }: { when: boolean; title: string; children: React.ReactNode }) {
  return when ? <details className="was-original"><summary>{title}</summary>{children}</details> : <>{children}</>
}

function RecalcCard({ rc, onBack, note, was, countBy }: { rc: Recalc; onBack: () => void; note?: string; was?: { gl: number; after: number | null }; countBy: CountBy }) {
  // A dish counted from an assumed recipe stays an estimate through every recalculation: never a plain "Fits".
  const tone = rc.assumed && rc.fits !== undefined ? 'estimate'
    : rc.fits === true ? 'good' : rc.fits === false ? 'bad' : rc.fits === null ? 'partial' : 'ask'
  const label = tone === 'estimate' ? 'Estimate' : tone === 'good' ? 'Fits' : tone === 'bad' ? 'Over today’s budget' : tone === 'partial' ? 'Part of the meal' : 'One question first'
  const verdict = tone === 'estimate'
    ? (rc.fits === true ? "If it's like this, it fits your day." : rc.fits === false ? "If it's like this, it goes over what is left today." : "I can't judge the day on this.")
    : tone === 'good' ? 'This fits your day.' : tone === 'bad' ? 'This goes over what is left today.'
    : tone === 'partial' ? "I can't judge the day on a partial total." : "I no longer hold today's budget, so ask again for a verdict."
  const lead = rc.after === null ? null : Math.abs(rc.after)
  return (
    <section className={`card answer tone-${tone} recalc`} role="status" aria-live="polite">
      <div className="eyebrow-line"><StatusDot tone={tone} />{label}</div>
      <div className="answer-text">
        <p className="a-verdict">{verdict}</p>
        {rc.before !== null && lead !== null ? (
          <>
            <FigurePair countBy={countBy} gl={{ mealGl: rc.mealGl, before: rc.before, after: rc.after ?? 0, fits: rc.fits !== false, partial: tone === 'partial' || rc.fits === null, assumed: tone === 'estimate' }} carbs={rc.carbs} />
            {was && (
              <p className="muted was-now">
                Before the change: this meal <b className="num">{was.gl}</b>
                {was.after !== null && <>, {was.after >= 0 ? 'left after' : 'over by'} <b className="num">{Math.abs(was.after)}</b></>}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="fig-title">Glycemic load (GL)</p>
            <div className="figures"><div className="fig"><span className="fig-k">this meal</span><span className="fig-v">{rc.mealGl}</span></div></div>
          </>
        )}
        <p className="a-why">{note ?? 'Recalculated with your portions. The original answer is kept below.'}</p>
      </div>
      <div className="verify-row">
        <span className="pill low">Calculated by the engine, nothing generated</span>
        {' '}<button className="link" onClick={onBack}>Back to the original</button>
      </div>
    </section>
  )
}

/**
 * Each food's weight, with a step down and a step up. The engine does the sums when the weight settles.
 * For a dish counted from an assumed recipe it is the composition card: an ingredient can also be taken
 * out and put back, and the whole thing reset to what the agent suggested.
 */
function PortionEditor({ lines, grams, busy, error, onNudge, assumed, removed, onRemove, onReset }: {
  lines: ReceiptLine[]; grams: Record<number, number>; busy: boolean; error: string; onNudge: (i: number, dir: 1 | -1) => void
  assumed?: Receipt['assumed']; removed: number[]; onRemove: (i: number) => void; onReset: () => void
}) {
  const edited = Object.keys(grams).length > 0 || removed.length > 0
  return (
    <section className="card portions">
      <h2>{assumed ? "Not your recipe?" : 'Not what you ate?'}</h2>
      <p className="muted">{assumed ? 'Change a gram or take an ingredient out and the engine counts it again.' : 'Change a portion and the engine counts it again.'}</p>
      <ul className="portion-list">
        {lines.map((l, i) => {
          const value = grams[i] ?? l.servings ?? l.grams
          const unit = l.servings ? (value === 1 ? 'serving' : 'servings') : 'g'
          const gone = removed.includes(i)
          return (
            <li key={`${l.foodId}-${i}`} className={gone ? 'removed' : undefined}>
              <span className="portion-name">
                {l.name}
                {assumed?.assumedFoodIds.includes(l.foodId) && <> <span className="pill none assumed">assumed</span></>}
                {gone && <> <span className="pill none">left out</span></>}
              </span>
              {gone ? (
                <button className="link" aria-label={`Put ${l.name} back`} onClick={() => onRemove(i)}>Put back</button>
              ) : (
                <span className="stepper">
                  <button className="step" aria-label={`Less ${l.name}`} onClick={() => onNudge(i, -1)}>−</button>
                  <span className="step-v" aria-live="polite">{value} {unit}</span>
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

function Answer({ text, reply, onSwap, swapState, countBy }: {
  text: string; reply?: AgentResponse
  /** Which way of counting the person uses: its figures come first. */
  countBy: CountBy
  /** Accept the swap the Next line suggests. Absent where the answer is not the one to act on. */
  onSwap?: (alt: SwapOffer) => void
  swapState?: { accepted: string | null; busy: boolean; failed: boolean }
}) {
  const costed = !!reply?.trace?.some((x) => (x.tool.endsWith('compute_meal') || x.tool.endsWith('cost_dish')) && typeof (x.result as { totals?: unknown } | undefined)?.totals === 'object')
  const parts = parseMeal(text, { costed })
  const m = lastMealCall(reply?.trace)?.result as
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
      .filter((l) => l && !isLabelled(l) && !parts.used.includes(l))
    return (
      <div className="answer-text">
        <p className="a-verdict">{bold(parts.verdict, 'v')}</p>
        {reply && <Figures reply={reply} countBy={countBy} />}
        {parts.numbers && !figuresShown && <p className="a-numbers">{bold(parts.numbers, 'n')}</p>}
        {parts.why && <p className="a-why">{bold(parts.why, 'w')}</p>}
        {parts.next && (
          <p className="a-next">
            <span className="a-next-label">Next</span>
            {bold(parts.next, 'x')}
          </p>
        )}
        {onSwap && (() => {
          const offer = swapNamedIn(parts.next, lastMealCall(reply?.trace)?.result as Parameters<typeof swapNamedIn>[1])
          if (!offer) return null
          const done = swapState?.accepted === offer.id
          return (
            <div className="a-swap">
              <button className="ghost" onClick={() => onSwap(offer)} disabled={(done && !swapState?.failed) || !!swapState?.busy}>
                {swapState?.busy && done ? 'Counting again…' : swapState?.failed && done ? 'Try the swap again' : done ? 'Swap accepted' : 'Accept the swap'}
              </button>
              {done && !swapState?.busy && !swapState?.failed && <span className="muted">The new count is above.</span>}
              {done && swapState?.failed && <span className="muted">Couldn't count that. Your original answer is unchanged.</span>}
            </div>
          )
        })()}
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
function verdictTone(answer: string, route?: string, reply?: AgentResponse): 'good' | 'change' | 'bad' | 'ask' | 'advice' | 'carbs' | 'partial' | 'estimate' {
  if (route === 'advisor') return 'advice'
  // The engine already decided this. Reading it out of the prose worked only
  // while the prose was a label: the moment the verdict became a sentence a
  // person would say — "This one goes over today." — the badge over it read
  // "One question first". `afterMeal.fits` is the same comparison the answer
  // is built on, and it cannot be paraphrased.
  const meal = lastMealCall(reply?.trace)?.result as
    { afterMeal?: { fits?: boolean | null; partial?: { unscored?: string[] } }; items?: { loadAvailable?: boolean }[]; alternatives?: unknown[]; assumed?: boolean } | undefined
  // A dish counted from an assumed recipe is an estimate, whatever the engine's comparison says: the
  // badge never reads "Fits" for a guess. The engine states `assumed`; nothing here reads the sentence.
  if (meal?.assumed === true && (meal.items ?? []).length > 0) return 'estimate'
  // A partial meal has no verdict to badge: a food is missing and the answer is
  // asking what is in it, which is what "One question first" says.
  // Every item branded: carbohydrate and no load. Some branded, some scored: the
  // part of a meal that could be judged. Neither is a verdict, and neither is green.
  if (meal?.afterMeal?.partial?.unscored?.length && (meal.items ?? []).length > 0 && (meal.items ?? []).every((it) => it.loadAvailable === false)) return 'carbs'
  if (meal?.afterMeal?.partial?.unscored?.length && meal.afterMeal.fits !== false) return 'partial'
  if (meal?.afterMeal?.fits === null) return 'ask'
  if (meal?.afterMeal && typeof meal.afterMeal.fits === 'boolean') {
    if (!meal.afterMeal.fits) return 'bad'
    return (meal.alternatives?.length ?? 0) > 0 ? 'change' : 'good'
  }
  const first = answer.split('\n')[0].toLowerCase()
  if (first.includes('does not fit') || first.includes("doesn't fit") || first.includes('not today') || first.includes('goes over')) return 'bad'
  if (first.includes('with a change') || first.includes('with one change') || first.includes('swap')) return 'change'
  if (first.includes('fits') || first.startsWith('**yes') || first.startsWith('yes')) return 'good'
  return 'ask'
}

/**
 * What to show in the answer box under a question: an example taken from the engine's own result, never from the
 * sentence. A food it does not have asks what is in it; an ambiguous one has candidates to pick from.
 */
function answerHint(trace?: TraceStep[]): string {
  const resolved = (trace ?? []).find((t) => t.tool === 'resolve_foods' || t.tool.endsWith('_resolve_foods'))?.result as
    { results?: { unknown?: boolean; clarify?: string; candidates?: { name?: string }[] }[] } | undefined
  const rows = resolved?.results ?? []
  const pick = rows.find((r) => r.clarify && r.candidates?.[0]?.name)?.candidates?.[0]?.name
  if (pick) return `e.g. ${pick}`
  if (rows.some((r) => r.unknown)) return 'e.g. flour, sugar and cream'
  return 'Type your answer here'
}

function ReceiptView({ r }: { r: Receipt }) {
  return (
    <div className="receipt">
      {r.assumed && <p className="receipt-note">Counted as a typical <strong>{r.assumed.dish}</strong>. Change anything that isn't yours.</p>}
      <div className="receipt-head"><span>food · portion</span><span>available carbs (g) · GI · GL</span></div>
      {r.lines.map((l) => (
        <div className="receipt-line" key={l.foodId + l.portion}>
          <span>{l.name} <em>{l.portion}</em>{r.assumed?.assumedFoodIds.includes(l.foodId) && <> <span className="pill none assumed">assumed</span></>}</span>
          <span>{l.availableCarbs.toFixed(1)} · {l.gi ?? '—'} · <b>{l.gl === null ? '—' : l.gl.toFixed(1)}</b></span>
        </div>
      ))}
      <div className="receipt-total"><span>{r.carbsOnly ? 'Glycemic load' : r.partial || r.unscored ? 'Glycemic load so far' : 'Meal glycemic load'}</span><span>{r.carbsOnly ? 'not available' : r.total.toFixed(1)}</span></div>
      {r.unscored && !r.carbsOnly && <div className="receipt-line muted"><span>Not scored: {r.unscored.join(', ')}</span><span>no glycemic index</span></div>}
      {r.partial && <div className="receipt-line muted"><span>Not counted: {r.partial.join(', ')}</span><span>not in the database</span></div>}
      {r.leftBefore !== null && (
        <>
          <div className="receipt-line muted"><span>GL left before this meal</span><span>{r.leftBefore.toFixed(1)}</span></div>
          <div className={`receipt-line ${r.partial || r.unscored ? '' : (r.leftAfter ?? 0) < 0 ? 'over' : 'ok'}`}><span>{r.partial || r.unscored ? 'GL left so far' : 'GL left after'}</span><span>{r.leftAfter?.toFixed(1)}</span></div>
        </>
      )}
      <div className="receipt-foot">
        GL (glycemic load) = GI (glycemic index) × available carbs ÷ 100. Available carbs = total − fibre, in grams. GL has no unit.
        {r.assumed && ' This dish is not in our database, so it is an estimate from typical ingredients, not a record of your meal.'}
        {r.unscored && ' Where our data has no glycemic index for a food, none is estimated: its carbohydrate, fibre and calories are counted and its load is not.'}
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
  // Foundry names a call after the tool and the operation (diabite_engine_compute_meal).
  // Matching the bare name left every line of this panel blank in production.
  const op = ['resolve_foods', 'compute_meal', 'cost_dish', 'get_day_state', 'find_alternatives'].find((o) => step.tool === o || step.tool.endsWith(`_${o}`))
  switch (op) {
    case 'resolve_foods': {
      const results = (r?.results as { confidence: string; unknown: boolean }[]) ?? []
      const n = results.length, unk = results.filter((x) => x.unknown).length, ask = results.filter((x) => x.confidence === 'medium').length
      return `${n} phrase${n === 1 ? '' : 's'} looked up${unk ? ` · ${unk} not in the database` : ''}${ask ? ` · ${ask} needed a question` : ''}`
    }
    case 'compute_meal': {
      const t = r?.totals as { gl: number } | undefined
      return t ? `meal GL ${t.gl}` : 'computed'
    }
    case 'cost_dish': {
      const t = r?.totals as { gl: number } | undefined
      const n = ((r?.ingredients as unknown[]) ?? []).length
      return t ? `${n} ingredients counted · estimate GL ${t.gl}` : 'could not count the dish'
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

export default function AskPage({ profile, targets, diary, onLog, onOpenDiary, logTarget, onClearTarget, onSessionEnded, tourSeen, onTourSeen, tourSuspended }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when the engine says "not now". Never locks the button: the safety rules
  // still answer while a limit is on, so only the server may decide who waits.
  const [limited, setLimited] = useState<{ scope: 'ip' | 'session' | 'daily' | 'user'; minutes: number } | null>(null)
  const [reply, setReply] = useState<AgentResponse | null>(null)
  const [asked, setAsked] = useState('')
  // The answer to a question the agent asked, typed right under it rather than in the box above the screen.
  const [replyText, setReplyText] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [logged, setLogged] = useState(false)
  // Which day "Log it" puts the meal on: today until the person picks another. Reset with each question.
  const [logDay, setLogDay] = useState<string | null>(null)
  const [logNote, setLogNote] = useState('')
  // Changing a portion: which session the answer was made in, what the person changed, and what the engine said back.
  const [turn, setTurn] = useState('')
  const [editing, setEditing] = useState(false)
  const [grams, setGrams] = useState<Record<number, number>>({})
  // Ingredients of an assumed recipe the person took out (by line index).
  const [removed, setRemoved] = useState<number[]>([])
  const [recalc, setRecalc] = useState<Recalc | null>(null)
  // A swap the person accepted from the Next line: which line of the meal it replaces, and by what (the engine's own numbers for it).
  const [swap, setSwap] = useState<{ index: number; id: string; name: string; unit: 'g' | 'serving'; portion: number; replaced: string } | null>(null)
  const [recalcBusy, setRecalcBusy] = useState(false)
  const [recalcError, setRecalcError] = useState('')
  const [saved, setSaved] = useState<number>(savedCount)
  const [fresh, setFresh] = useState<boolean>(readFresh)
  const toggleFresh = () => {
    const v = !fresh
    setFresh(v)
    try { localStorage.setItem(FRESH_KEY, v ? '1' : '0') } catch { /* private mode */ }
  }
  const abort = useRef<AbortController | null>(null)

  const today = useToday()
  // A day sent from the Diary is where each new answer starts; the person can still change it under the answer.
  const targetDay = logTarget && logTarget.date !== today ? logTarget.date : null
  useEffect(() => { setLogDay(targetDay); setLogged(false); setLogNote('') }, [targetDay])
  // Only what was eaten counts: a planned meal is a promise, not a log.
  const counted = useMemo(() => eaten(diary), [diary])
  // The day the person is asking about: today until they pick another. The budget, the verdict and "Log it" are that day's.
  const day = logDay ?? today
  const dayEntries = useMemo(() => counted.filter((e) => e.date === day), [counted, day])
  const usedGL = useMemo(() => dayEntries.reduce((s, e) => s + viewEntry(e).gl, 0), [dayEntries])
  const left = Math.max(0, Math.round((targets.glBudget - usedGL) * 10) / 10)
  const dayWord = day === today ? 'today' : ['tomorrow', 'yesterday'].includes(dayLabel(day, today).toLowerCase()) ? dayLabel(day, today).toLowerCase() : `on ${dayLabel(day, today)}`
  const dayPick = useRef<HTMLDivElement>(null)

  const receipt = useMemo(() => receiptFrom(reply?.trace), [reply])

  // "How is it going?": after the third meal and on a later day, once each, and only when nothing else is going on.
  const [card, setCard] = useState<Milestone | null>(visitCard)
  const facts = useMemo(() => nudgeFacts(diary), [diary])
  const tipShowing = nextStep(tourSeen, { hasReply: !!reply, hasReceipt: !!receipt, assumed: !!receipt?.assumed, busy, suspended: tourSuspended }) !== null
  useEffect(() => {
    if (card) return
    const due = nextNudge({
      ...facts, today, asked: sanitizeAsked(loadNudge()),
      busy: busy || !!recalcBusy, suspended: tourSuspended || tipShowing, shownThisVisit: visitCardShown,
    })
    if (due) { visitCard = due; visitCardShown = true; setCard(due) }
  }, [card, facts, today, busy, recalcBusy, tourSuspended, tipShowing])
  const cardAsked = (m: Milestone) => saveNudge(markAsked(sanitizeAsked(loadNudge()), m))
  const cardClosed = () => { visitCard = null; setCard(null) }
  // What is logged and shown as the calculation: the portions the person chose, once they have chosen.
  const active = recalc?.receipt ?? receipt
  // The meal's lines as the person has them now: the line a swap replaced shows the new food at the weight the engine costed it.
  const baseLines = useMemo(() => {
    if (!receipt) return []
    if (!swap) return receipt.lines
    return receipt.lines.map((l, i) => i !== swap.index ? l : {
      ...l, foodId: swap.id, name: swap.name,
      ...(swap.unit === 'serving' ? { servings: swap.portion, grams: 0 } : { servings: undefined, grams: swap.portion }),
    })
  }, [receipt, swap])

  function acceptSwap(alt: SwapOffer) {
    if (!receipt) return
    const from = (lastMealCall(reply?.trace)?.result as { alternativesFor?: { foodId: string; name: string } } | undefined)?.alternativesFor
    const index = from ? receipt.lines.findIndex((l) => l.foodId === from.foodId) : -1
    if (index < 0 || !from) return
    setGrams({}); setRemoved([])
    setSwap({ index, id: alt.id, name: alt.name, unit: alt.unit, portion: alt.portion, replaced: from.name })
    setLogged(false)
  }

  function nudge(i: number, dir: 1 | -1) {
    if (!receipt) return
    const l = baseLines[i]
    const base = grams[i] ?? l.servings ?? l.grams
    const step = l.servings ? 0.5 : Math.max(5, Math.round((base * 0.1) / 5) * 5)
    const next = l.servings ? Math.min(12, Math.max(0.5, base + dir * step)) : Math.min(1500, Math.max(5, base + dir * step))
    setGrams((g) => ({ ...g, [i]: Math.round(next * 100) / 100 }))
    setLogged(false)
  }

  function toggleRemoved(i: number) {
    setRemoved((r) => (r.includes(i) ? r.filter((x) => x !== i) : [...r, i]))
    setLogged(false)
  }
  function resetRecipe() { setGrams({}); setRemoved([]); setSwap(null); setLogged(false) }

  // Let the weight settle for a moment, then ask the engine to count it again.
  useEffect(() => {
    if (!receipt || !turn) return
    const changed = baseLines.some((l, i) => grams[i] !== undefined && grams[i] !== (l.servings ?? l.grams)) || removed.length > 0 || swap !== null
    if (!changed) { setRecalc(null); setRecalcError(''); return }
    if (removed.length >= baseLines.length) { setRecalc(null); setRecalcError('Keep at least one ingredient.'); return }
    const ctl = new AbortController()
    const timer = setTimeout(async () => {
      setRecalcBusy(true); setRecalcError('')
      try {
        const items = baseLines.flatMap((l, i) => {
          if (removed.includes(i)) return []
          const v = grams[i] ?? l.servings ?? l.grams
          return [l.servings ? { foodId: l.foodId, servings: v } : { foodId: l.foodId, grams: v }]
        })
        setRecalc(await recomputeMeal(turn, items, receipt.sources, await accessToken(), ctl.signal, receipt.assumed))
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        if (e instanceof SignInRequiredError) onSessionEnded?.()
        else if (e instanceof RateLimitedError) setRecalcError('That is a lot of changes at once. Try again in a minute.')
        else setRecalcError("Couldn't count that again. Your original answer is unchanged.")
      } finally { setRecalcBusy(false) }
    }, 400)
    return () => { clearTimeout(timer); ctl.abort() }
  }, [grams, removed, swap, baseLines, receipt, turn, onSessionEnded])

  // Another day is another budget: an answer on screen was counted against the old one, so it is asked again for the new day.
  function pickDay(d: string) {
    const next = d === today ? null : d
    if ((next ?? today) === day) return
    setLogDay(next); setLogged(false); setLogNote('')
    if (reply && asked) void ask(asked, { day: d, force: true })
  }

  async function ask(message: string, opts: { day?: string; force?: boolean } = {}) {
    const q = message.trim()
    if (!q || (busy && !opts.force)) return
    const forDay = opts.day ?? day
    abort.current?.abort()
    abort.current = new AbortController()
    setBusy(true); setError(null); setLimited(null); setReply(null); setShowReceipt(false); setLogged(false); setLogNote(''); setAsked(q); setReplyText('')
    setEditing(false); setGrams({}); setRemoved([]); setSwap(null); setRecalc(null); setRecalcError('')
    const sid = fresh ? `eval-${Math.random().toString(36).slice(2, 10)}` : sessionId()
    setTurn(sid)
    try {
      const res = await askAgent({
        sessionId: sid,
        message: q,
        budget: budgetOf(targets),
        avoid: avoidOf(profile),
        entries: fresh ? [] : counted.filter((e) => e.date === forDay).map((e) => (e.snapshot?.servings
          ? { foodId: engineId(e), servings: e.snapshot.servings }
          : { foodId: engineId(e), grams: e.grams })),
      }, abort.current.signal, await accessToken())
      setReply(res)
      // Lab 3.2: keep every successful exchange as evaluation data.
      if (!isDemo) setSaved(saveResponse(q, res))
    } catch (e) {
      if (e instanceof SignInRequiredError) {
        onSessionEnded?.()
      } else if (e instanceof RateLimitedError) {
        setLimited({ scope: e.scope, minutes: Math.max(1, Math.ceil(e.retryAfterSec / 60)) })
      } else if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function logIt() {
    if (!active) return
    const meal = logTarget?.meal ?? mealForNow()
    const stamp = Date.now()
    const date = logDay ?? today
    const planned = date > today
    onLog(active.lines.map((l, i) => ({
      id: `${stamp}-${i}`, date, meal, foodId: l.foodId,
      // A recipe the engine counted by servings has no weight (grams 0); the diary table refuses a weight of 0 and the whole save with it, so such a line keeps its servings in that place, as the Menu's recipes do.
      grams: l.grams > 0 ? l.grams : (l.servings ?? 1), ...(planned ? { planned: true } : {}),
      snapshot: {
        name: l.name, kcal: l.kcal, carbs: l.carbs, fiber: l.fiber, protein: l.protein, fat: l.fat,
        availableCarbs: l.availableCarbs, gi: l.gi, gl: l.gl ?? 0, loadAvailable: l.gl !== null, servings: l.servings,
        ...(active.assumed ? { assumed: true } : {}),
      },
    })))
    setLogged(true)
    // The meal is named only when the Diary chose it; otherwise it is the time of day and nothing needs saying.
    const where = logTarget ? `${MEAL_LABELS[meal].toLowerCase()}, ${dayLabel(date, today)}` : dayLabel(date, today)
    setLogNote(planned ? `Planned for ${where}. It counts once you mark it eaten.` : logTarget ? `Logged for ${where}.` : date === today ? '' : `Logged for ${where}.`)
  }

  // On a narrow screen the answer opens below the question; bring it into view so nobody has to hunt for it.
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!reply || window.innerWidth >= 980) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    resultRef.current?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
  }, [reply])

  // The actions (Log it, Calculation, Portions) follow the person down the screen, so what they open
  // appears below them: bring it into view, or a tap would seem to do nothing.
  const editorRef = useRef<HTMLDivElement>(null)
  const receiptRef = useRef<HTMLElement>(null)
  const bringIntoView = (el: HTMLElement | null) => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
  }
  useEffect(() => { if (editing) bringIntoView(editorRef.current) }, [editing])
  useEffect(() => { if (showReceipt) bringIntoView(receiptRef.current) }, [showReceipt])

  const tone = reply ? (reply.blocked ? 'blocked' : verdictTone(reply.answer, reply.route, reply)) : null

  // The numbers of the answer as first given, for the line "before the change" on a recalculation. From the engine's
  // result for that answer; nothing is worked out here.
  const firstMeal = lastMealCall(reply?.trace)?.result as { totals?: { gl?: number }; afterMeal?: { remaining?: { gl?: number } } } | undefined
  const wasNow = typeof firstMeal?.totals?.gl === 'number'
    ? { gl: firstMeal.totals.gl, after: typeof firstMeal.afterMeal?.remaining?.gl === 'number' ? firstMeal.afterMeal.remaining.gl : null }
    : undefined

  // Which day the meal goes to, and the button that puts it there. After a swap or a new portion it sits right under the
  // recalculated card, so the person does not scroll past the original answer to reach it.
  const logBlock = receipt ? (
    <>
      <p className="muted log-day">
        Adding to {dayLabel(day, today)}.{' '}
        <button type="button" className="link" onClick={() => { dayPick.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); dayPick.current?.querySelector('button')?.focus({ preventScroll: true }) }}>Change day</button>
      </p>
      <div className="row act-bar">
        <button className="primary" data-tour="log" onClick={logIt} disabled={logged}>{logged ? (logDay && logDay > today ? 'Planned' : 'Logged') : logDay && logDay > today ? 'Plan it' : active?.partial || active?.unscored ? 'Log what was counted' : 'Log it'}</button>
        <button className="ghost" data-tour="calc" onClick={() => setShowReceipt((v) => !v)}>{showReceipt ? 'Hide calculation' : 'Calculation'}</button>
        {!receipt.carbsOnly && <button className="ghost" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : receipt.assumed ? 'Recipe' : 'Portions'}</button>}
      </div>
    </>
  ) : null

  return (
    <div>
      <section className={`card ask-hero${reply || busy ? ' compact' : ''}`}>
        <div className="ask-budget">
          <div className="ask-budget-text">
            <span className="label">glycemic load left {dayWord}</span>
            <span className="ask-budget-note">How much your food can still add to your blood sugar {dayWord}.</span>
          </div>
          <span className="value"><b className="num">{left}</b> <small>of {targets.glBudget}</small></span>
        </div>
        {/* The day, at a glance. A bar rather than a ring: a ring is a score
            to close, and the design canvas ruled those out. */}
        <div className="budget-bar" role="img"
             aria-label={`${Math.round(Math.max(0, targets.glBudget - left) * 10) / 10} of ${targets.glBudget} glycemic load used ${dayWord}`}>
          <span style={{ width: `${Math.min(100, Math.max(0, ((targets.glBudget - left) / Math.max(1, targets.glBudget)) * 100))}%` }} />
        </div>
        <div className="ask-day" ref={dayPick}>
          <DayPicker value={day} today={today} onChange={pickDay} />
          {day !== today && <p className="muted ask-day-note">The verdict is for {dayLabel(day, today)}: it counts what was eaten on that day.</p>}
        </div>
        <h2 className="ask-title">What are you about to eat?</h2>
        {!isDemo && <div className="row lab-row">
          {saved > 0 && <button className="ghost" onClick={downloadResponses}>Download Responses</button>}
          {saved > 0 && <span className="muted">{saved} saved</span>}
          <label className="muted lab-toggle">
            <input type="checkbox" checked={fresh} onChange={toggleFresh} />
            Fresh context per question
          </label>
        </div>}
        <p className="muted">Say it the way you'd say it to a friend. The agent does the counting — and shows its arithmetic.<span className="voice-hint"> On a phone, tap the microphone on your keyboard to say it instead of typing.</span></p>
        {logTarget && (
          <p className="muted ask-target" role="status">
            Adding to {MEAL_LABELS[logTarget.meal].toLowerCase()}, {dayLabel(logTarget.date, today)}.{' '}
            {onClearTarget && <button type="button" className="link" onClick={onClearTarget}>Cancel</button>}
          </p>
        )}
        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
          <input
            data-tour="input"
            type="text" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. two slices of pepperoni pizza" disabled={busy} maxLength={MAX_QUESTION} aria-label="What are you about to eat?"
          />
          <button className="primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Thinking…' : 'Check this meal'}</button>
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

      <div ref={resultRef}>
      {busy && (
        <section className="card thinking" role="status" aria-live="polite">
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
              : limited.scope === 'user'
              ? `You've asked a lot of questions today. Try again in about ${limited.minutes} ${limited.minutes === 1 ? 'minute' : 'minutes'}.`
              : `You've asked a lot of questions in a short time. Please try again in about ${limited.minutes} ${limited.minutes === 1 ? 'minute' : 'minutes'}.`}
          </p>
        </section>
      )}

      {error && (
        <section className="card tone-blocked">
          <div className="eyebrow-line">Couldn't reach the agent</div>
          <p style={{ margin: 0 }}>{error}</p>
          {asked && <div className="row"><button className="ghost" type="button" onClick={() => ask(asked)} disabled={busy}>Try again</button></div>}
        </section>
      )}

      {reply && (
        <>
          <p className="muted asked">{asked}</p>
          {recalc && <RecalcCard rc={recalc} onBack={() => { setGrams({}); setRemoved([]); setSwap(null); setRecalc(null) }} note={swap ? `Recalculated with ${swap.name.toLowerCase()} instead of ${swap.replaced.toLowerCase()}. The original answer is kept below.` : undefined} was={wasNow} countBy={profile.countBy} />}
          {recalc && logBlock}
          <Fold when={!!recalc} title={swap ? 'Original answer, before the swap' : 'Original answer, before you changed a portion'}>
          <section className={`card answer tone-${tone}${recalc ? ' stale' : ''}`} role="status" aria-live="polite">
            <div className="eyebrow-line" data-tour="verdict">
              <StatusDot tone={tone} />
              {reply.blocked ? 'Not something I\'ll answer' :
               tone === 'good' ? 'Fits' : tone === 'change' ? 'Fits with a change' : tone === 'bad' ? 'Over today’s budget' :
               tone === 'advice' ? 'Advice' : tone === 'estimate' ? 'Estimate' : tone === 'carbs' ? 'Carbs only' : tone === 'partial' ? 'Part of the meal' : 'One question first'}
            </div>
            <Answer text={reply.answer} reply={reply} countBy={profile.countBy} onSwap={receipt && !receipt.assumed ? acceptSwap : undefined} swapState={{ accepted: swap?.id ?? null, busy: !!swap && !recalc && !recalcError, failed: !!swap && !recalc && !!recalcError }} />
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
                ) : reply.withheld ? (
                  <span className="pill high">Answer withheld: its numbers did not check</span>
                ) : reply.verifierError ? (
                  <span className="pill medium">Verifier unavailable</span>
                ) : (
                  <span className="pill high">Unverified numbers: {(reply.unmatchedNumbers ?? []).join(', ')}</span>
                )}
              </div>
            )}
          </section>
          </Fold>

          {tone === 'ask' && !reply.blocked && reply.route !== 'advisor' && (
            <form className="reply-box" onSubmit={(e) => { e.preventDefault(); ask(replyText) }}>
              <span className="label">Your answer</span>
              <div className="ask-form">
                <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} autoComplete="off"
                  aria-label="Your answer" placeholder={answerHint(reply.trace)} disabled={busy} maxLength={MAX_QUESTION} />
                <button className="ghost" type="submit" disabled={busy || !replyText.trim()}>{busy ? 'Thinking…' : 'Send answer'}</button>
              </div>
            </form>
          )}

          {!recalc && logBlock}

          {logNote && <p className="muted" role="status" aria-live="polite" style={{ margin: '-4px 0 12px' }}>{logNote}{onOpenDiary && <>{' '}<button type="button" className="link" onClick={onOpenDiary}>Open Diary</button></>}</p>}

          {editing && receipt && !receipt.carbsOnly && (
            <div ref={editorRef}>
              <PortionEditor lines={baseLines} grams={grams} busy={recalcBusy} error={recalcError} onNudge={nudge} assumed={receipt.assumed} removed={removed} onRemove={toggleRemoved} onReset={resetRecipe} />
            </div>
          )}

          {showReceipt && active && (
            <section className="card" ref={receiptRef}>
              <h2>The receipt</h2>
              <ReceiptView r={active} />
            </section>
          )}

          {!isDemo && reply.trace && reply.trace.length > 0 && (
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
      </div>
      {/* After everything else: the question box stays first on the screen, and the card is met on the way down, never in front of an answer. */}
      {card && <FeedbackNudge milestone={card} onAsked={cardAsked} onClose={cardClosed} />}
      <Tour seen={tourSeen} onSeen={onTourSeen} ctx={{ hasReply: !!reply, hasReceipt: !!receipt, assumed: !!receipt?.assumed, busy, suspended: tourSuspended }} />
    </div>
  )
}
