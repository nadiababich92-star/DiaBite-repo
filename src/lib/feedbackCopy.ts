/** Feedback wording with no dependencies, so the engine suite can read it without a browser or Supabase. */

export const RATING_LABELS: Record<number, string> = {
  1: 'Not useful',
  2: 'Barely useful',
  3: 'Somewhat useful',
  4: 'Useful',
  5: 'Very useful',
}
/** What is sent when someone gives a rating and no words: the column cannot be empty. */
export const RATING_ONLY = '(rating only)'
