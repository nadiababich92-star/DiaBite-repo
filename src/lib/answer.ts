/**
 * Reading a meal answer's four parts out of the agent's text.
 *
 * The prompt asks for "**Verdict** — …", "**Numbers** — …", and so on. The
 * model writes that about half the time and otherwise writes the same four
 * parts as plain sentences — "This fits your day." then "Numbers: …" — and a
 * parser that insisted on the first form dropped the big verdict, the three
 * figures and the styled next step on every one of those, leaving a block of
 * paragraphs. Nothing tested it, so nobody saw it go. Both forms are read here,
 * and `eval/cases.json` holds samples of each.
 *
 * A clarifying question, a refusal and an advisory answer carry none of the
 * labels and come back as null: they are prose on purpose.
 */
export interface MealParts { verdict: string; numbers?: string; why?: string; next?: string }

const LABELS = ['Verdict', 'Numbers', 'Why', 'Next action'] as const
const SEP = '[:—–-]'

/** What follows a label, to the end of its line: "**Why** — x", "Why: x", "Why - x". */
function part(text: string, label: string): string | undefined {
  return text.match(new RegExp(`(?:^|\\n)\\s*\\*{0,2}${label}\\*{0,2}\\s*${SEP}\\s*([^\\n]+)`, 'i'))?.[1]?.trim()
}

/** True for a line that opens with one of the four labels. */
export const isLabelled = (line: string): boolean =>
  new RegExp(`^\\*{0,2}(${LABELS.join('|')})\\*{0,2}\\s*${SEP}`, 'i').test(line.trim())

/**
 * The reason and the next step are the labels the model keeps; the line that
 * carries the numbers is called "Numbers", "Meal", "Meal load" or nothing, and
 * a parser that waited for "Numbers" showed the flagship answer as plain text.
 * So an answer is a meal when it has a reason or a next step, and whatever
 * sits between the first line and the first label is its numbers.
 */
export function parseMeal(text: string, opts: { costed?: boolean } = {}): (MealParts & { used: string[] }) | null {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const why = part(text, 'Why'), next = part(text, 'Next action')
  let numbers = part(text, 'Numbers')
  let verdict = part(text, 'Verdict')
  const used: string[] = []
  if (verdict) {
    const l = lines.find((x) => /^\*{0,2}Verdict\*{0,2}\s*[:—–-]/i.test(x)); if (l) used.push(l)
  } else {
    // No label: a question or a refusal never has a reason or a next step.
    if (!why && !next) {
      // Four plain paragraphs, no labels at all: verdict, numbers, reason, next step.
      // Read by position, and only when the engine really costed a meal (the caller
      // knows from the trace), so a question is never dressed as a verdict.
      if (!opts.costed || lines.length < 3 || /\?$/.test(lines[0])) return null
      const [v, n, w, x] = lines
      return { verdict: v.charAt(0).toUpperCase() + v.slice(1), numbers: n, why: w, next: x, used: lines.slice(0, x ? 4 : 3) }
    }
    const first = lines.findIndex((l) => !isLabelled(l))
    if (first < 0) return null
    verdict = lines[first]; used.push(lines[first])
    if (!numbers) {
      // Everything between the verdict and the first labelled line, whatever it is called.
      const stop = lines.findIndex((l, i) => i > first && isLabelled(l))
      const between = lines.slice(first + 1, stop < 0 ? undefined : stop)
      if (between.length) { numbers = between.join(' '); used.push(...between) }
    }
    if (!numbers && !(why && next)) return null
  }
  // Printed large and alone, a lowercase first letter looks like a mistake.
  verdict = verdict.charAt(0).toUpperCase() + verdict.slice(1)
  return { verdict, numbers, why, next, used }
}
