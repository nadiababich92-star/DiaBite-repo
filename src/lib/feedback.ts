/**
 * Feedback submissions.
 *
 * Rows go to the `feedback` table in Supabase with the publishable key. Row-level
 * security allows exactly one thing from the browser — inserting a feedback row —
 * so nobody can read back or change what others submitted (see the
 * create_feedback_table migration).
 *
 * A copy is kept in localStorage as well, so a submission is still visible for
 * testing and the flow can be exercised with Supabase unconfigured.
 */
import { supabase, supabaseConfigured } from './supabase'

const KEY = 'diabite.feedback.v1'
/** Typing this as the comment forces the error state, for testing the flow. */
const FAIL_PHRASE = 'trigger error'

export interface Feedback {
  rating: number
  comment: string
  name?: string
  email?: string
}

export interface SavedFeedback extends Feedback {
  id: string
  sentAt: string
}

export function savedFeedback(): SavedFeedback[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedFeedback[]) : []
  } catch {
    return []
  }
}

function remember(entry: SavedFeedback) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...savedFeedback(), entry]))
  } catch {
    /* private mode: the submission still counts as sent */
  }
}

export async function submitFeedback(input: Feedback): Promise<SavedFeedback> {
  if (input.comment.trim().toLowerCase() === FAIL_PHRASE) {
    // Test hook for the error state; harmless in production, and it never
    // reaches the database.
    await new Promise((r) => setTimeout(r, 500))
    throw new Error("We couldn't send your feedback. Please try again.")
  }

  if (!supabaseConfigured || !supabase) {
    // No project configured (e.g. a fresh checkout without .env.local): keep the
    // flow working locally rather than failing in the user's face.
    await new Promise((r) => setTimeout(r, 500))
    const local: SavedFeedback = {
      ...input,
      id: Math.random().toString(36).slice(2, 10),
      sentAt: new Date().toISOString(),
    }
    remember(local)
    return local
  }

  // No `.select()` after the insert on purpose: the public role may write to
  // this table and nothing more, so asking for the row back would be refused.
  const { error } = await supabase.from('feedback').insert({
    rating: input.rating,
    feedback: input.comment,
    name: input.name ?? null,
    email: input.email ?? null,
  })

  if (error) {
    // Postgres check constraints come back as 23514; anything else is a network
    // or configuration problem. Either way the person sees one plain sentence.
    const message =
      error.code === '23514'
        ? 'Some of that did not pass our checks. Please review the form and try again.'
        : "We couldn't send your feedback. Please check your connection and try again."
    throw new Error(message)
  }

  const entry: SavedFeedback = {
    ...input,
    id: Math.random().toString(36).slice(2, 10),
    sentAt: new Date().toISOString(),
  }
  remember(entry)
  return entry
}

// ── validation ────────────────────────────────────────────────────────────
export type FeedbackErrors = Partial<Record<'rating' | 'comment' | 'email', string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const COMMENT_MAX = 1000

export function validate(draft: { rating: number | null; comment: string; email: string }): FeedbackErrors {
  const errors: FeedbackErrors = {}
  if (!draft.rating) errors.rating = 'Please pick a rating from 1 to 5.'
  if (!draft.comment.trim()) errors.comment = 'Please tell us what worked or what did not.'
  else if (draft.comment.trim().length > COMMENT_MAX) errors.comment = `Please keep it under ${COMMENT_MAX} characters.`
  if (draft.email.trim() && !EMAIL.test(draft.email.trim())) errors.email = 'This email address looks incomplete.'
  return errors
}
