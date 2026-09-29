/** Domain types. */

export type FoodCategory =
  | 'grains'      // grains, bread, pasta
  | 'vegetables'  // vegetables
  | 'fruits'      // fruit and berries
  | 'legumes'     // legumes
  | 'protein'     // meat, fish, eggs
  | 'dairy'       // dairy
  | 'nuts'        // nuts and seeds
  | 'fats'        // oils and fats
  | 'sweets'      // sweets
  | 'drinks'      // drinks

export interface Nutrients {
  /** kcal per 100 g */
  kcal: number
  /** total carbohydrate, g per 100 g */
  carbs: number
  /** fibre, g per 100 g (included in carbs) */
  fiber: number
  protein: number
  fat: number
}

export interface Food {
  id: string
  name: string
  category: FoodCategory
  /**
   * Glycemic index (glucose = 100).
   * null means the food carries almost no carbohydrate, so GI is undefined.
   */
  gi: number | null
  per100: Nutrients
  /** Typical household portion, for quick entry. */
  portion: { label: string; grams: number }
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** A dish ingredient: a food reference plus a weight in grams. */
export interface DishItem {
  foodId: string
  grams: number
}

export interface Dish {
  id: string
  name: string
  /** Which meals this dish suits. */
  meals: MealType[]
  items: DishItem[]
  /** Short method. */
  recipe: string
  /** Dietary restrictions the dish does NOT meet; derived automatically. */
  tags?: string[]
}

/** A single diary entry. */
export interface DiaryEntry {
  id: string
  /** ISO date, YYYY-MM-DD */
  date: string
  meal: MealType
  /** Local seed id for hand-logged foods; the engine's own id (`ing:`/`rec:`/`seed:`) for agent-logged ones. */
  foodId: string
  grams: number
  /**
   * Present when the entry was logged from an agent answer: the engine's
   * numbers, stored as computed. The diary shows these instead of recomputing,
   * because the local food table does not hold every engine record.
   */
  snapshot?: {
    name: string
    kcal: number
    carbs: number
    fiber: number
    protein: number
    fat: number
    availableCarbs: number
    gi: number | null
    gl: number
    servings?: number
  }
}

export type Sex = 'female' | 'male' | 'unspecified'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high'
export type Condition = 't1' | 't2' | 'prediabetes' | 'ir' | 'gestational' | 'unsure'

/** Insulin therapy, the field that decides whether this product is for you at all. */
export type Insulin = 'none' | 'basal' | 'mealtime_or_pump'
/** Drug classes, not drugs: the engine only ever needs the class. */
export type Med = 'metformin' | 'sulfonylurea' | 'sglt2' | 'glp1' | 'other'
export type Kidney = 'none' | 'mentioned' | 'ckd' | 'dialysis'
export type Comorbidity =
  | 'htn' | 'ascvd' | 'masld' | 'gout' | 'gastroparesis' | 'celiac' | 'pcos' | 'eatingDisorder'
export type Allergen =
  | 'milk' | 'egg' | 'fish' | 'shellfish' | 'treenuts' | 'peanuts' | 'wheat' | 'soy' | 'sesame' | 'gluten' | 'lactose'

/** Why a target is not the formula's raw output. Shown to the user, never hidden. */
export interface Constraint {
  /** Stable rule id, for tests and logs. */
  id: string
  /** Which target it changed, or 'none' when it only changes advice. */
  field: 'kcal' | 'carbsG' | 'proteinG' | 'fiberG' | 'glBudget' | 'none'
  /** One sentence, in the second person, saying what changed and why. */
  reason: string
}
export type Goal = 'lose' | 'maintain' | 'gain'
/** How hard we restrict carbohydrate. */
export type CarbApproach = 'moderate' | 'low' | 'verylow'

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: Activity
  condition: Condition
  goal: Goal
  carbApproach: CarbApproach
  /** Food ids the user excludes: allergy, intolerance, or simply dislike. */
  excludedFoodIds: string[]

  // ── Onboarding: everything below maps to a rule in `calculateTargets`.
  insulin: Insulin
  meds: Med[]
  pregnantOrBreastfeeding: boolean
  kidney: Kidney
  comorbidities: Comorbidity[]
  allergens: Allergen[]
  /** Inches and pounds on screen; the stored values stay metric. */
  units: 'imperial' | 'metric'
  /** The disclaimer was acknowledged and onboarding finished (PRD A4). */
  onboarded: boolean
}

/** Computed daily targets. */
export interface Targets {
  kcal: number
  carbsG: number
  proteinG: number
  fatG: number
  fiberG: number
  /** Daily glycemic-load ceiling. */
  glBudget: number
  /** Rules that changed a number, each with the reason to show the user. */
  constraints: Constraint[]
}
