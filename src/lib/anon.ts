/**
 * The words of the first answers, signed out (docs/specs/anon-screen.md, sections 4 and 5). Plain functions and constants, so the
 * exact copy can be checked without a browser. Nothing here holds a nutrition number: the count of free answers is the engine's setting.
 */

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/** "three" for 3; the digits above ten. */
export const countWord = (n: number): string => WORDS[n] ?? String(n)

/** The line under the landing key while free answers are on. */
export const landingFreeLine = (n: number): string => n === 1 ? 'Free to try. No sign-up for your first answer.' : `Free to try. No sign-up for your first ${countWord(n)} answers.`

/** The title of the limit card: "That was your third free answer for today". Past ten it says "last". */
export const limitTitle = (n: number): string => `That was your ${ORDINALS[n] || 'last'} free answer for today`

export const LIMIT_BODY = 'Sign in with your email to keep going, keep a diary and make the numbers yours.'

/**
 * When another free answer comes, from the engine's retryAfterSec: whole hours (rounded up) from an hour on, whole minutes below an hour,
 * "1 hour" singular. No countdown. Nothing for a wait that is not known.
 */
export function retryLine(retryAfterSec: number | undefined): string | null {
  if (!(typeof retryAfterSec === 'number' && retryAfterSec > 0)) return null
  const minutes = Math.ceil(retryAfterSec / 60)
  if (retryAfterSec < 3600) return `Another free answer in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
  const hours = Math.ceil(retryAfterSec / 3600)
  return `Another free answer in about ${hours} ${hours === 1 ? 'hour' : 'hours'}.`
}

/** The banner under the budget bar. The second sentence is a key (**Make it yours**). */
export const BANNER_TEXT = 'Counting for a typical adult.'
export const BANNER_KEY = 'Make it yours'

/** The cards the locked tabs show, word for word. */
export const SIGN_IN_CARDS = {
  diary: { title: 'Sign in to keep a diary', body: 'The Diary saves what you eat and counts it against your own day. Sign in with your email; there is no password.' },
  menu: { title: 'Sign in to plan your week', body: 'The weekly menu is counted against your own targets. Sign in with your email; there is no password.' },
  profile: { title: 'Sign in to make the numbers yours', body: 'Your targets come from your age, height, weight and how you eat. Sign in with your email, answer a few questions, and the day\'s budget becomes yours.' },
} as const
