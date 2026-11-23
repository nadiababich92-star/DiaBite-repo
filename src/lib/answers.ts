import { ALLERGEN_LABELS, CARB_APPROACH_LABELS, COMORBIDITY_LABELS, CONDITION_LABELS, COUNT_BY_LABELS, GOAL_LABELS, INSULIN_LABELS, KIDNEY_LABELS, MED_LABELS } from './profile'
import { AVOIDED_LABELS, PATTERN_LABELS } from './dietary'
import type { Profile } from '../types'

/** The part of a label before its examples: "Metformin (Glucophage)" is "Metformin" in a one-line summary. */
const short = (label: string) => label.split(' (')[0]

export interface AnswerRow {
  id: 'diagnosis' | 'medicines' | 'conditions' | 'eating' | 'allergies' | 'day'
  title: string
  /** What the person said, in a line. */
  text: string
  /** The onboarding step that holds the answer: 1 Diagnosis, 2 Medicines, 3 Conditions, 4 Your day. */
  step: 1 | 2 | 3 | 4
}

/** What a row says for a step the short onboarding has not asked yet. */
export const NOT_ASKED = 'Not asked yet'

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

  // A step the short onboarding left for later was not answered: its empty fields are not "none", and the row says so.
  const deferred = p.deferred ?? []
  const asked = (step: 'diagnosis' | 'medicines' | 'conditions' | 'day', text: string) => (deferred.includes(step) ? NOT_ASKED : text)
  const approach = p.carbApproach === 'moderate' ? 'moderate carbs' : short(CARB_APPROACH_LABELS[p.carbApproach]).toLowerCase()
  const day = `${GOAL_LABELS[p.goal]}; ${approach}; counting ${COUNT_BY_LABELS[p.countBy].split(',')[0].toLowerCase()}`
  return [
    { id: 'diagnosis', title: 'Diagnosis', text: asked('diagnosis', short(CONDITION_LABELS[p.condition])), step: 1 },
    { id: 'medicines', title: 'Medicines', text: asked('medicines', medicines), step: 2 },
    { id: 'conditions', title: 'Kidneys and other conditions', text: asked('conditions', `${kidneys}; ${others}`), step: 3 },
    { id: 'eating', title: 'How you eat', text: asked('conditions', eating.length === 0 ? 'No preference' : eating.join(', ')), step: 3 },
    { id: 'allergies', title: 'Allergies', text: asked('conditions', p.allergens.length === 0 ? 'None' : p.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')), step: 3 },
    { id: 'day', title: 'Your day', text: asked('day', day), step: 4 },
  ]
}
