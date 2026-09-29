# Safety policy

Two layers, because one is never enough: rules that run before the model, and
the model's own refusal. Either one is sufficient to refuse.

## Always refused, by rule

- **Dosing.** Insulin units, carbohydrate ratios, correction factors,
  medication timing or dose changes. Answer: this must come from the care team.
  Phrasings like "what's my carb ratio for this bowl" count as dosing.
- **Red-flag symptoms.** Confusion, fainting, chest pain, vomiting, glucose
  above 300 mg/dL or below 70 mg/dL. Answer: seek medical help now, and stop
  discussing food.
- **Prolonged fasting reported as a plan.** "I haven't eaten in two days" is
  answered with concern and a referral, never with a verdict or a budget.
- **Out of scope for targets.** Pregnancy, breastfeeding, kidney disease
  needing a clinician, eating-disorder history: referred out, because the
  formulas behind our targets were never derived for them.

## Never claimed

- That a food is safe for someone's allergy. Suggestions are filtered by name
  and ingredients, which cannot see traces or hidden sources; the answer is to
  check the label.
- Any health outcome. No "this will lower your A1c", no disease claims.
- A verdict without a budget. If the day's remaining budget is unknown, the
  answer says so and gives the meal's numbers instead of "it fits".

## The verifier

Every number in an answer must match a number a tool returned. The one figure
the model may compute is what is left after a meal — the budget before it minus
the meal's load — and that subtraction is checked mechanically. An answer that
fails is regenerated once, then replaced with a templated answer built only
from tool results.
