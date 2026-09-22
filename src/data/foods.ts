import type { Food } from '../types'

/**
 * Seed food database.
 *
 * GI values are averages from the International Tables of Glycemic Index
 * (Foster-Powell, Holt, Brand-Miller). The GI of a given food varies widely
 * with variety, ripeness and cooking method, and sources disagree by as much
 * as +/-15 points - treat these as a reference point, not a constant.
 *
 * Nutrients are per 100 g edible portion, cooked where the name says so.
 *
 * THIS IS SEED DATA. Before any public launch it must be reconciled with the
 * chosen source (see README, "Data source").
 */
export const FOODS: Food[] = [
  // ── Grains, bread, pasta ────────────────────────────────────────────────
  { id: 'oats', name: 'Oatmeal (rolled oats), cooked',  category: 'grains', gi: 55, per100: { kcal: 71,  carbs: 12,   fiber: 1.7, protein: 2.5, fat: 1.5 }, portion: { label: 'serving', grams: 200 } },
  { id: 'oats-instant', name: 'Instant oatmeal',category:'grains', gi: 79, per100: { kcal: 68,  carbs: 12,   fiber: 1.1, protein: 2.4, fat: 1.4 }, portion: { label: 'packet', grams: 180 } },
  { id: 'buckwheat', name: 'Buckwheat, cooked',               category: 'grains', gi: 54, per100: { kcal: 110, carbs: 20,   fiber: 2.7, protein: 3.8, fat: 1.1 }, portion: { label: 'serving', grams: 180 } },
  { id: 'pearl-barley', name: 'Pearl barley, cooked',             category: 'grains', gi: 28, per100: { kcal: 123, carbs: 25,   fiber: 3.8, protein: 2.3, fat: 0.4 }, portion: { label: 'serving', grams: 180 } },
  { id: 'quinoa', name: 'Quinoa, cooked',                category: 'grains', gi: 53, per100: { kcal: 120, carbs: 21,   fiber: 2.8, protein: 4.4, fat: 1.9 }, portion: { label: 'serving', grams: 180 } },
  { id: 'bulgur', name: 'Bulgur, cooked',               category: 'grains', gi: 48, per100: { kcal: 83,  carbs: 19,   fiber: 4.5, protein: 3.1, fat: 0.2 }, portion: { label: 'serving', grams: 180 } },
  { id: 'rice-white', name: 'White rice, cooked',            category: 'grains', gi: 73, per100: { kcal: 130, carbs: 28,   fiber: 0.4, protein: 2.7, fat: 0.3 }, portion: { label: 'serving', grams: 180 } },
  { id: 'rice-basmati', name: 'Basmati rice, cooked',          category: 'grains', gi: 50, per100: { kcal: 121, carbs: 25,   fiber: 0.7, protein: 3.0, fat: 0.4 }, portion: { label: 'serving', grams: 180 } },
  { id: 'rice-brown', name: 'Brown rice, cooked',            category: 'grains', gi: 68, per100: { kcal: 123, carbs: 26,   fiber: 1.6, protein: 2.7, fat: 1.0 }, portion: { label: 'serving', grams: 180 } },
  { id: 'pasta-durum', name: 'Durum wheat pasta, al dente', category: 'grains', gi: 48, per100: { kcal: 158, carbs: 31, fiber: 1.8, protein: 5.8, fat: 0.9 }, portion: { label: 'serving', grams: 180 } },
  { id: 'pasta-whole', name: 'Whole wheat pasta',      category: 'grains', gi: 42, per100: { kcal: 149, carbs: 30,   fiber: 4.5, protein: 6.0, fat: 1.1 }, portion: { label: 'serving', grams: 180 } },
  { id: 'bread-white', name: 'White bread',                   category: 'grains', gi: 75, per100: { kcal: 265, carbs: 49,   fiber: 2.7, protein: 9.0, fat: 3.2 }, portion: { label: 'slice', grams: 30 } },
  { id: 'bread-rye', name: 'Whole grain rye bread',   category: 'grains', gi: 56, per100: { kcal: 250, carbs: 45,   fiber: 6.5, protein: 8.5, fat: 3.3 }, portion: { label: 'slice', grams: 35 } },
  { id: 'bread-sprout', name: 'Sprouted grain bread',   category: 'grains', gi: 55, per100: { kcal: 230, carbs: 40,   fiber: 7.0, protein: 11,  fat: 3.5 }, portion: { label: 'slice', grams: 35 } },
  { id: 'couscous', name: 'Couscous, cooked',               category: 'grains', gi: 65, per100: { kcal: 112, carbs: 23,   fiber: 1.4, protein: 3.8, fat: 0.2 }, portion: { label: 'serving', grams: 180 } },

  // ── Vegetables ────────────────────────────────────────────────────────────────
  { id: 'broccoli', name: 'Broccoli',            category: 'vegetables', gi: 15, per100: { kcal: 34, carbs: 7,   fiber: 2.6, protein: 2.8, fat: 0.4 }, portion: { label: 'serving', grams: 150 } },
  { id: 'cauliflower', name: 'Cauliflower',     category: 'vegetables', gi: 15, per100: { kcal: 25, carbs: 5,   fiber: 2.0, protein: 1.9, fat: 0.3 }, portion: { label: 'serving', grams: 150 } },
  { id: 'cabbage', name: 'Green cabbage',category: 'vegetables', gi: 15, per100: { kcal: 25, carbs: 6,   fiber: 2.5, protein: 1.3, fat: 0.1 }, portion: { label: 'serving', grams: 150 } },
  { id: 'spinach', name: 'Spinach',              category: 'vegetables', gi: 15, per100: { kcal: 23, carbs: 3.6, fiber: 2.2, protein: 2.9, fat: 0.4 }, portion: { label: 'handful', grams: 60 } },
  { id: 'lettuce', name: 'Leaf lettuce',      category: 'vegetables', gi: 15, per100: { kcal: 15, carbs: 2.9, fiber: 1.3, protein: 1.4, fat: 0.2 }, portion: { label: 'handful', grams: 60 } },
  { id: 'cucumber', name: 'Cucumber',              category: 'vegetables', gi: 15, per100: { kcal: 15, carbs: 3.6, fiber: 0.5, protein: 0.7, fat: 0.1 }, portion: { label: 'each', grams: 120 } },
  { id: 'tomato', name: 'Tomato',             category: 'vegetables', gi: 15, per100: { kcal: 18, carbs: 3.9, fiber: 1.2, protein: 0.9, fat: 0.2 }, portion: { label: 'each', grams: 120 } },
  { id: 'bellpepper', name: 'Bell pepper',    category: 'vegetables', gi: 15, per100: { kcal: 31, carbs: 6,   fiber: 2.1, protein: 1.0, fat: 0.3 }, portion: { label: 'each', grams: 120 } },
  { id: 'zucchini', name: 'Zucchini',             category: 'vegetables', gi: 15, per100: { kcal: 17, carbs: 3.1, fiber: 1.0, protein: 1.2, fat: 0.3 }, portion: { label: 'serving', grams: 150 } },
  { id: 'eggplant', name: 'Eggplant',            category: 'vegetables', gi: 15, per100: { kcal: 25, carbs: 6,   fiber: 3.0, protein: 1.0, fat: 0.2 }, portion: { label: 'serving', grams: 150 } },
  { id: 'greenbeans', name: 'Green beans',   category: 'vegetables', gi: 15, per100: { kcal: 31, carbs: 7,   fiber: 3.4, protein: 1.8, fat: 0.1 }, portion: { label: 'serving', grams: 150 } },
  { id: 'onion', name: 'Onion',        category: 'vegetables', gi: 15, per100: { kcal: 40, carbs: 9,   fiber: 1.7, protein: 1.1, fat: 0.1 }, portion: { label: 'each', grams: 80 } },
  { id: 'mushrooms', name: 'White mushrooms',          category: 'vegetables', gi: 15, per100: { kcal: 22, carbs: 3.3, fiber: 1.0, protein: 3.1, fat: 0.3 }, portion: { label: 'serving', grams: 150 } },
  { id: 'avocado', name: 'Avocado',             category: 'vegetables', gi: 15, per100: { kcal: 160, carbs: 9,  fiber: 6.7, protein: 2.0, fat: 15  }, portion: { label: 'half', grams: 70 } },
  { id: 'carrot-raw', name: 'Carrot, raw',       category: 'vegetables', gi: 35, per100: { kcal: 41, carbs: 10,  fiber: 2.8, protein: 0.9, fat: 0.2 }, portion: { label: 'each', grams: 80 } },
  { id: 'carrot-boil', name: 'Carrot, boiled',     category: 'vegetables', gi: 39, per100: { kcal: 35, carbs: 8,   fiber: 3.0, protein: 0.8, fat: 0.2 }, portion: { label: 'serving', grams: 120 } },
  { id: 'pumpkin', name: 'Pumpkin, roasted',    category: 'vegetables', gi: 75, per100: { kcal: 26, carbs: 6,   fiber: 0.5, protein: 1.0, fat: 0.1 }, portion: { label: 'serving', grams: 150 } },
  { id: 'corn', name: 'Sweet corn, boiled',    category: 'vegetables', gi: 52, per100: { kcal: 96, carbs: 21,  fiber: 2.4, protein: 3.4, fat: 1.5 }, portion: { label: 'ear', grams: 100 } },
  { id: 'potato-boil', name: 'Potato, boiled',   category: 'vegetables', gi: 78, per100: { kcal: 87, carbs: 20,  fiber: 1.8, protein: 1.9, fat: 0.1 }, portion: { label: 'serving', grams: 150 } },
  { id: 'potato-mash', name: 'Mashed potato',   category: 'vegetables', gi: 87, per100: { kcal: 88, carbs: 15,  fiber: 1.2, protein: 2.0, fat: 2.5 }, portion: { label: 'serving', grams: 180 } },
  { id: 'sweetpotato', name: 'Sweet potato, baked',    category: 'vegetables', gi: 63, per100: { kcal: 90, carbs: 21,  fiber: 3.3, protein: 2.0, fat: 0.2 }, portion: { label: 'serving', grams: 150 } },

  // ── Fruit and berries ───────────────────────────────────────────────────────
  { id: 'apple', name: 'Apple',      category: 'fruits', gi: 36, per100: { kcal: 52, carbs: 14,  fiber: 2.4, protein: 0.3, fat: 0.2 }, portion: { label: 'each', grams: 180 } },
  { id: 'pear', name: 'Pear',       category: 'fruits', gi: 38, per100: { kcal: 57, carbs: 15,  fiber: 3.1, protein: 0.4, fat: 0.1 }, portion: { label: 'each', grams: 180 } },
  { id: 'orange', name: 'Orange',    category: 'fruits', gi: 43, per100: { kcal: 47, carbs: 12,  fiber: 2.4, protein: 0.9, fat: 0.1 }, portion: { label: 'each', grams: 160 } },
  { id: 'banana', name: 'Banana',       category: 'fruits', gi: 51, per100: { kcal: 89, carbs: 23,  fiber: 2.6, protein: 1.1, fat: 0.3 }, portion: { label: 'each', grams: 120 } },
  { id: 'grapes', name: 'Grapes',    category: 'fruits', gi: 59, per100: { kcal: 69, carbs: 18,  fiber: 0.9, protein: 0.7, fat: 0.2 }, portion: { label: 'handful', grams: 100 } },
  { id: 'watermelon', name: 'Watermelon',       category: 'fruits', gi: 76, per100: { kcal: 30, carbs: 8,   fiber: 0.4, protein: 0.6, fat: 0.2 }, portion: { label: 'wedge', grams: 200 } },
  { id: 'strawberry', name: 'Strawberries',    category: 'fruits', gi: 41, per100: { kcal: 32, carbs: 8,   fiber: 2.0, protein: 0.7, fat: 0.3 }, portion: { label: 'serving', grams: 150 } },
  { id: 'blueberry', name: 'Blueberries',     category: 'fruits', gi: 53, per100: { kcal: 57, carbs: 14,  fiber: 2.4, protein: 0.7, fat: 0.3 }, portion: { label: 'serving', grams: 100 } },
  { id: 'raspberry', name: 'Raspberries',      category: 'fruits', gi: 32, per100: { kcal: 52, carbs: 12,  fiber: 6.5, protein: 1.2, fat: 0.7 }, portion: { label: 'serving', grams: 100 } },
  { id: 'kiwi', name: 'Kiwi',        category: 'fruits', gi: 50, per100: { kcal: 61, carbs: 15,  fiber: 3.0, protein: 1.1, fat: 0.5 }, portion: { label: 'each', grams: 80 } },
  { id: 'peach', name: 'Peach',      category: 'fruits', gi: 42, per100: { kcal: 39, carbs: 10,  fiber: 1.5, protein: 0.9, fat: 0.3 }, portion: { label: 'each', grams: 150 } },
  { id: 'plum', name: 'Plum',       category: 'fruits', gi: 39, per100: { kcal: 46, carbs: 11,  fiber: 1.4, protein: 0.7, fat: 0.3 }, portion: { label: 'each', grams: 60 } },
  { id: 'mango', name: 'Mango',       category: 'fruits', gi: 51, per100: { kcal: 60, carbs: 15,  fiber: 1.6, protein: 0.8, fat: 0.4 }, portion: { label: 'serving', grams: 150 } },
  { id: 'dates', name: 'Dates',      category: 'fruits', gi: 62, per100: { kcal: 282, carbs: 75, fiber: 8.0, protein: 2.5, fat: 0.4 }, portion: { label: 'each', grams: 8  } },
  { id: 'raisins', name: 'Raisins',        category: 'fruits', gi: 64, per100: { kcal: 299, carbs: 79, fiber: 3.7, protein: 3.1, fat: 0.5 }, portion: { label: 'handful', grams: 30 } },

  // ── Legumes ──────────────────────────────────────────────────────────────
  { id: 'lentils', name: 'Lentils, cooked',      category: 'legumes', gi: 32, per100: { kcal: 116, carbs: 20, fiber: 7.9, protein: 9.0, fat: 0.4 }, portion: { label: 'serving', grams: 180 } },
  { id: 'chickpeas', name: 'Chickpeas, cooked',           category: 'legumes', gi: 28, per100: { kcal: 164, carbs: 27, fiber: 7.6, protein: 8.9, fat: 2.6 }, portion: { label: 'serving', grams: 150 } },
  { id: 'kidneybean', name: 'Kidney beans, cooked',category: 'legumes', gi: 24, per100: { kcal: 127, carbs: 23, fiber: 6.4, protein: 8.7, fat: 0.5 }, portion: { label: 'serving', grams: 150 } },
  { id: 'blackbean', name: 'Black beans, cooked', category: 'legumes', gi: 30, per100: { kcal: 132, carbs: 24, fiber: 8.7, protein: 8.9, fat: 0.5 }, portion: { label: 'serving', grams: 150 } },
  { id: 'greenpeas', name: 'Green peas',       category: 'legumes', gi: 51, per100: { kcal: 81,  carbs: 14, fiber: 5.1, protein: 5.4, fat: 0.4 }, portion: { label: 'serving', grams: 120 } },

  // ── Protein ────────────────────────────────────────────────────────────────
  { id: 'chicken', name: 'Chicken breast',   category: 'protein', gi: null, per100: { kcal: 165, carbs: 0,   fiber: 0, protein: 31,  fat: 3.6 }, portion: { label: 'serving', grams: 150 } },
  { id: 'turkey', name: 'Turkey breast',    category: 'protein', gi: null, per100: { kcal: 135, carbs: 0,   fiber: 0, protein: 29,  fat: 1.7 }, portion: { label: 'serving', grams: 150 } },
  { id: 'beef', name: 'Lean beef', category: 'protein', gi: null, per100: { kcal: 187, carbs: 0,   fiber: 0, protein: 26,  fat: 9.0 }, portion: { label: 'serving', grams: 150 } },
  { id: 'salmon', name: 'Salmon',           category: 'protein', gi: null, per100: { kcal: 208, carbs: 0,   fiber: 0, protein: 20,  fat: 13  }, portion: { label: 'serving', grams: 150 } },
  { id: 'cod', name: 'Cod',           category: 'protein', gi: null, per100: { kcal: 82,  carbs: 0,   fiber: 0, protein: 18,  fat: 0.7 }, portion: { label: 'serving', grams: 150 } },
  { id: 'mackerel', name: 'Mackerel',         category: 'protein', gi: null, per100: { kcal: 205, carbs: 0,   fiber: 0, protein: 19,  fat: 14  }, portion: { label: 'serving', grams: 120 } },
  { id: 'shrimp', name: 'Shrimp',         category: 'protein', gi: null, per100: { kcal: 99,  carbs: 0.2, fiber: 0, protein: 24,  fat: 0.3 }, portion: { label: 'serving', grams: 150 } },
  { id: 'egg', name: 'Egg',     category: 'protein', gi: null, per100: { kcal: 143, carbs: 0.7, fiber: 0, protein: 13,  fat: 9.5 }, portion: { label: 'each', grams: 55 } },
  { id: 'tofu', name: 'Tofu',             category: 'protein', gi: 15,   per100: { kcal: 76,  carbs: 1.9, fiber: 0.3, protein: 8.1, fat: 4.8 }, portion: { label: 'serving', grams: 150 } },

  // ── Dairy ─────────────────────────────────────────────────────────────
  { id: 'milk', name: 'Milk, 2%',            category: 'dairy', gi: 39,   per100: { kcal: 52,  carbs: 4.7, fiber: 0, protein: 2.9, fat: 2.5 }, portion: { label: 'cup', grams: 200 } },
  { id: 'yogurt', name: 'Plain yogurt',     category: 'dairy', gi: 41,   per100: { kcal: 61,  carbs: 4.7, fiber: 0, protein: 3.5, fat: 3.3 }, portion: { label: 'cup', grams: 150 } },
  { id: 'greekyogurt', name: 'Greek yogurt, 2%',    category: 'dairy', gi: 11,   per100: { kcal: 73,  carbs: 3.9, fiber: 0, protein: 10,  fat: 2.0 }, portion: { label: 'cup', grams: 150 } },
  { id: 'cottage', name: 'Cottage cheese, 5%',              category: 'dairy', gi: 30,   per100: { kcal: 121, carbs: 3.0, fiber: 0, protein: 17,  fat: 5.0 }, portion: { label: 'serving', grams: 150 } },
  { id: 'kefir', name: 'Kefir, 1%',               category: 'dairy', gi: 25,   per100: { kcal: 40,  carbs: 4.0, fiber: 0, protein: 3.0, fat: 1.0 }, portion: { label: 'cup', grams: 200 } },
  { id: 'cheese', name: 'Hard cheese',            category: 'dairy', gi: null, per100: { kcal: 364, carbs: 1.3, fiber: 0, protein: 25,  fat: 29  }, portion: { label: 'slice', grams: 30 } },
  { id: 'feta', name: 'Feta',                   category: 'dairy', gi: 27, per100: { kcal: 264, carbs: 4.1, fiber: 0, protein: 14,  fat: 21  }, portion: { label: 'serving', grams: 40 } },

  // ── Nuts and seeds ───────────────────────────────────────────────────────
  { id: 'almonds', name: 'Almonds',      category: 'nuts', gi: 15, per100: { kcal: 579, carbs: 22, fiber: 12.5, protein: 21, fat: 50 }, portion: { label: 'handful', grams: 25 } },
  { id: 'walnuts', name: 'Walnuts', category: 'nuts', gi: 15, per100: { kcal: 654, carbs: 14, fiber: 6.7,  protein: 15, fat: 65 }, portion: { label: 'handful', grams: 25 } },
  { id: 'cashews', name: 'Cashews',        category: 'nuts', gi: 25, per100: { kcal: 553, carbs: 30, fiber: 3.3,  protein: 18, fat: 44 }, portion: { label: 'handful', grams: 25 } },
  { id: 'peanuts', name: 'Peanuts',       category: 'nuts', gi: 14, per100: { kcal: 567, carbs: 16, fiber: 8.5,  protein: 26, fat: 49 }, portion: { label: 'handful', grams: 25 } },
  { id: 'chia', name: 'Chia seeds',   category: 'nuts', gi: 1,  per100: { kcal: 486, carbs: 42, fiber: 34,   protein: 17, fat: 31 }, portion: { label: 'tbsp', grams: 15 } },
  { id: 'flax', name: 'Flaxseed',  category: 'nuts', gi: 1,  per100: { kcal: 534, carbs: 29, fiber: 27,   protein: 18, fat: 42 }, portion: { label: 'tbsp', grams: 12 } },

  // ── Fats ─────────────────────────────────────────────────────────────────
  { id: 'oliveoil', name: 'Olive oil', category: 'fats', gi: null, per100: { kcal: 884, carbs: 0, fiber: 0, protein: 0,   fat: 100 }, portion: { label: 'tbsp', grams: 12 } },
  { id: 'butter', name: 'Butter', category: 'fats', gi: null, per100: { kcal: 717, carbs: 0.1, fiber: 0, protein: 0.9, fat: 81 }, portion: { label: 'tbsp', grams: 10 } },

  // ── Sweets and drinks ────────────────────────────────────────────────────
  { id: 'darkchoc', name: 'Dark chocolate, 70%', category: 'sweets', gi: 25, per100: { kcal: 598, carbs: 46, fiber: 11, protein: 7.8, fat: 43 }, portion: { label: 'square', grams: 10 } },
  { id: 'milkchoc', name: 'Milk chocolate',   category: 'sweets', gi: 45, per100: { kcal: 535, carbs: 59, fiber: 3.4, protein: 7.6, fat: 30 }, portion: { label: 'square', grams: 10 } },
  { id: 'honey', name: 'Honey',                category: 'sweets', gi: 61, per100: { kcal: 304, carbs: 82, fiber: 0.2, protein: 0.3, fat: 0  }, portion: { label: 'tbsp', grams: 12 } },
  { id: 'sugar', name: 'Sugar',              category: 'sweets', gi: 65, per100: { kcal: 387, carbs: 100, fiber: 0, protein: 0,   fat: 0  }, portion: { label: 'tbsp', grams: 8  } },
  { id: 'orangejuice', name: 'Orange juice',   category: 'drinks', gi: 50, per100: { kcal: 45, carbs: 10, fiber: 0.2, protein: 0.7, fat: 0.2 }, portion: { label: 'cup', grams: 200 } },
  { id: 'cola', name: 'Cola',               category: 'drinks', gi: 63, per100: { kcal: 42, carbs: 11, fiber: 0,   protein: 0,   fat: 0  }, portion: { label: 'cup', grams: 250 } },
]

export const FOOD_BY_ID: ReadonlyMap<string, Food> = new Map(FOODS.map((f) => [f.id, f]))

export function getFood(id: string): Food {
  const food = FOOD_BY_ID.get(id)
  if (!food) throw new Error(`Unknown food: ${id}`)
  return food
}

export const CATEGORY_LABELS: Record<Food['category'], string> = {
  grains: 'Grains & bread',
  vegetables: 'Vegetables',
  fruits: 'Fruit & berries',
  legumes: 'Legumes',
  protein: 'Meat, fish, eggs',
  dairy: 'Dairy',
  nuts: 'Nuts & seeds',
  fats: 'Fats',
  sweets: 'Sweets',
  drinks: 'Drinks',
}
