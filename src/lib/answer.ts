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

export function parseMeal(text: string): (MealParts & { verdictLine?: string }) | null {
  const numbers = part(text, 'Numbers'), why = part(text, 'Why'), next = part(text, 'Next action')
  let verdict = part(text, 'Verdict')
  let verdictLine: string | undefined
  if (!verdict) {
    // No label: the first line is the verdict, but only when the rest of the
    // answer is the labelled body of a meal, so a question is never mistaken for one.
    if (!numbers || !(why || next)) return null
    verdictLine = text.split(/\n+/).map((l) => l.trim()).find((l) => l && !isLabelled(l))
    if (!verdictLine) return null
    verdict = verdictLine
  }
  // Printed large and alone, a lowercase first letter looks like a mistake.
  verdict = verdict.charAt(0).toUpperCase() + verdict.slice(1)
  return { verdict, numbers, why, next, verdictLine }
}
