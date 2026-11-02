import { ALLERGEN_LABELS, COMORBIDITY_LABELS, INSULIN_LABELS, KIDNEY_LABELS, MED_LABELS } from './profile'
import { AVOIDED_LABELS, PATTERN_LABELS } from './dietary'
import type { Profile } from '../types'

/** The part of a label before its examples: "Metformin (Glucophage)" is "Metformin" in a one-line summary. */
const short = (label: string) => label.split(' (')[0]

export interface AnswerRow {
  id: 'medicines' | 'conditions' | 'eating' | 'allergies'
  title: string
  /** What the person said, in a line. */
  text: string
  /** The onboarding step that holds the answer: 2 is Medicines, 3 is Conditions. */
  step: 2 | 3
}

/** The onboarding answers that have no field of their own on the profile, as one line each. */
export function answerRows(p: Profile): AnswerRow[] {
  const meds = p.meds.map((m) => short(MED_LABELS[m]))
  const insulin = p.insulin === 'none' ? [] : [short(INSULIN_LABELS[p.insulin])]
  const taking = [...meds, ...insulin]
  const medicines = taking.length === 0 ? 'Nothing for glucose' : `${taking.join(', ')}${p.insulin === 'none' ? ', no insulin' : ''}`

  const kidneys = short(KIDNEY_LABELS[p.kidney])
  const others = p.comorbidities.length === 0 ? 'no other conditions' : p.comorbidities.map((c) => short(COMORBIDITY_LABELS[c])).join(', ')

  const eating = [
    ...(p.pattern === 'none' ? [] : [short(PATTERN_LABELS[p.pattern])]),
    ...p.avoided.map((a) => `no ${AVOIDED_LABELS[a].split(' (')[0].toLowerCase()}`),
  ]

  return [
    { id: 'medicines', title: 'Medicines', text: medicines, step: 2 },
    { id: 'conditions', title: 'Kidneys and other conditions', text: `${kidneys}; ${others}`, step: 3 },
    { id: 'eating', title: 'How you eat', text: eating.length === 0 ? 'No preference' : eating.join(', '), step: 3 },
    { id: 'allergies', title: 'Allergies', text: p.allergens.length === 0 ? 'None' : p.allergens.map((a) => ALLERGEN_LABELS[a]).join(', '), step: 3 },
  ]
}
