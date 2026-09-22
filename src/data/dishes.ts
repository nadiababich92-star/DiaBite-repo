import type { Dish } from '../types'

/**
 * Seed dish set for the menu generator.
 * Ingredient weights are per serving; the generator scales them to each
 * user's energy target.
 */
export const DISHES: Dish[] = [
  // ── Breakfasts ─────────────────────────────────────────────────────────────
  {
    id: 'b-oat-raspberry',
    name: 'Oatmeal with raspberries and almonds',
    meals: ['breakfast'],
    items: [{ foodId: 'oats', grams: 200 }, { foodId: 'raspberry', grams: 60 }, { foodId: 'almonds', grams: 15 }],
    recipe:
      'Cook the oats in water, then stir in the raspberries and chopped almonds. Skip the milk and sugar - both push the load up noticeably.',
  },
  {
    id: 'b-omelet-broccoli',
    name: 'Broccoli and feta omelette',
    meals: ['breakfast'],
    items: [{ foodId: 'egg', grams: 110 }, { foodId: 'broccoli', grams: 100 }, { foodId: 'feta', grams: 30 }, { foodId: 'oliveoil', grams: 8 }],
    recipe:
      'Blanch the broccoli for 3-4 minutes, pour over the beaten eggs and cook covered. Crumble the feta on top a minute before it is done.',
  },
  {
    id: 'b-cottage-blueberry',
    name: 'Cottage cheese with blueberries and flax',
    meals: ['breakfast', 'snack'],
    items: [{ foodId: 'cottage', grams: 150 }, { foodId: 'blueberry', grams: 60 }, { foodId: 'flax', grams: 12 }],
    recipe:
      'Grind the flaxseed just before serving - whole seeds pass straight through. Stir into the cottage cheese with the berries.',
  },
  {
    id: 'b-greek-nuts',
    name: 'Greek yogurt with walnuts and chia',
    meals: ['breakfast', 'snack'],
    items: [{ foodId: 'greekyogurt', grams: 150 }, { foodId: 'walnuts', grams: 20 }, { foodId: 'chia', grams: 12 }],
    recipe:
      'Soak the chia in the yogurt for 15 minutes, or overnight, until it thickens. Top with chopped walnuts.',
  },
  {
    id: 'b-egg-avocado-toast',
    name: 'Egg and avocado on rye toast',
    meals: ['breakfast'],
    items: [{ foodId: 'egg', grams: 110 }, { foodId: 'avocado', grams: 70 }, { foodId: 'bread-rye', grams: 35 }],
    recipe:
      'Toast the bread, mash the avocado onto it, top with a poached or soft-boiled egg. The fat in the avocado slows absorption of the carbs in the bread.',
  },
  {
    id: 'b-buckwheat-egg',
    name: 'Buckwheat with egg and tomato',
    meals: ['breakfast'],
    items: [{ foodId: 'buckwheat', grams: 150 }, { foodId: 'egg', grams: 55 }, { foodId: 'tomato', grams: 100 }, { foodId: 'oliveoil', grams: 8 }],
    recipe:
      'Steep the buckwheat in boiling water overnight instead of boiling it - it holds a lower GI that way. Serve with the egg and tomato.',
  },
  {
    id: 'b-scramble-mushroom',
    name: 'Scrambled eggs with mushrooms and spinach',
    meals: ['breakfast'],
    items: [{ foodId: 'egg', grams: 110 }, { foodId: 'mushrooms', grams: 100 }, { foodId: 'spinach', grams: 50 }, { foodId: 'butter', grams: 8 }],
    recipe:
      'Fry the mushrooms until the water has cooked off, add the spinach, then the eggs. Stir over low heat until creamy.',
  },
  {
    id: 'b-sprout-toast',
    name: 'Sprouted grain toast with cottage cheese',
    meals: ['breakfast', 'snack'],
    items: [{ foodId: 'bread-sprout', grams: 35 }, { foodId: 'cottage', grams: 100 }, { foodId: 'cucumber', grams: 80 }],
    recipe:
      'Season the cottage cheese, spread it on the toasted bread, top with thin slices of cucumber.',
  },

  // ── Lunches ────────────────────────────────────────────────────────────────
  {
    id: 'l-chicken-quinoa',
    name: 'Chicken with quinoa and salad',
    meals: ['lunch'],
    items: [{ foodId: 'chicken', grams: 150 }, { foodId: 'quinoa', grams: 150 }, { foodId: 'lettuce', grams: 60 }, { foodId: 'cucumber', grams: 80 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Roast or dry-sear the chicken breast. Dress the salad with oil and lemon juice - the acid lowers the glycemic response further.',
  },
  {
    id: 'l-lentil-soup',
    name: 'Lentil and vegetable soup',
    meals: ['lunch'],
    items: [{ foodId: 'lentils', grams: 180 }, { foodId: 'carrot-boil', grams: 60 }, { foodId: 'onion', grams: 40 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Simmer the lentils for 20 minutes with sauteed onion and carrot. Do not cook them down to a puree - whole lentils digest more slowly.',
  },
  {
    id: 'l-cod-bulgur',
    name: 'Cod with bulgur and broccoli',
    meals: ['lunch'],
    items: [{ foodId: 'cod', grams: 150 }, { foodId: 'bulgur', grams: 150 }, { foodId: 'broccoli', grams: 120 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Bake the cod for 15 minutes at 375F. Steep the bulgur and blanch the broccoli for 3 minutes - keep it al dente.',
  },
  {
    id: 'l-turkey-barley',
    name: 'Turkey with pearl barley and green beans',
    meals: ['lunch'],
    items: [{ foodId: 'turkey', grams: 150 }, { foodId: 'pearl-barley', grams: 150 }, { foodId: 'greenbeans', grams: 120 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Pearl barley has one of the lowest GIs of any grain at 28. Soak overnight, simmer 40 minutes. Saute the beans with garlic.',
  },
  {
    id: 'l-chickpea-salad',
    name: 'Chickpea, feta and vegetable salad',
    meals: ['lunch', 'dinner'],
    items: [{ foodId: 'chickpeas', grams: 150 }, { foodId: 'feta', grams: 40 }, { foodId: 'tomato', grams: 100 }, { foodId: 'cucumber', grams: 80 }, { foodId: 'oliveoil', grams: 12 }],
    recipe:
      'Cook the chickpeas, or use canned with no added sugar. Toss with the vegetables and feta, dress with oil and lemon.',
  },
  {
    id: 'l-beef-buckwheat',
    name: 'Beef with buckwheat and cabbage slaw',
    meals: ['lunch'],
    items: [{ foodId: 'beef', grams: 130 }, { foodId: 'buckwheat', grams: 150 }, { foodId: 'cabbage', grams: 100 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Braise the beef until tender. Shred the cabbage, work it with salt, dress with oil.',
  },
  {
    id: 'l-pasta-shrimp',
    name: 'Whole wheat pasta with shrimp',
    meals: ['lunch'],
    items: [{ foodId: 'pasta-whole', grams: 150 }, { foodId: 'shrimp', grams: 150 }, { foodId: 'tomato', grams: 100 }, { foodId: 'oliveoil', grams: 12 }],
    recipe:
      'Cook the pasta strictly al dente - overcooked pasta raises the GI by roughly a third. Sear the shrimp with garlic and tomato for 3 minutes.',
  },
  {
    id: 'l-tofu-rice',
    name: 'Tofu with brown rice and vegetables',
    meals: ['lunch', 'dinner'],
    items: [{ foodId: 'tofu', grams: 150 }, { foodId: 'rice-brown', grams: 130 }, { foodId: 'bellpepper', grams: 100 }, { foodId: 'broccoli', grams: 100 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Pat the tofu dry and sear until crisp. Stir-fry the vegetables over high heat, then fold through the rice.',
  },

  // ── Dinners ────────────────────────────────────────────────────────────────
  {
    id: 'd-salmon-broccoli',
    name: 'Salmon with broccoli',
    meals: ['dinner'],
    items: [{ foodId: 'salmon', grams: 150 }, { foodId: 'broccoli', grams: 150 }, { foodId: 'oliveoil', grams: 8 }],
    recipe:
      'Bake the salmon for 12-15 minutes at 350F. Steam the broccoli for 5 minutes and finish with oil.',
  },
  {
    id: 'd-mackerel-salad',
    name: 'Mackerel with garden salad',
    meals: ['dinner'],
    items: [{ foodId: 'mackerel', grams: 120 }, { foodId: 'lettuce', grams: 60 }, { foodId: 'tomato', grams: 100 }, { foodId: 'cucumber', grams: 80 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Bake the mackerel in foil with lemon. Serve with a salad of raw vegetables.',
  },
  {
    id: 'd-chicken-veg',
    name: 'Chicken with roasted vegetables',
    meals: ['dinner'],
    items: [{ foodId: 'chicken', grams: 150 }, { foodId: 'zucchini', grams: 120 }, { foodId: 'bellpepper', grams: 100 }, { foodId: 'eggplant', grams: 100 }, { foodId: 'oliveoil', grams: 12 }],
    recipe:
      'Cut the chicken and vegetables large, toss with oil, roast 25 minutes at 400F on one sheet pan.',
  },
  {
    id: 'd-cod-cauliflower',
    name: 'Cod with cauliflower mash',
    meals: ['dinner'],
    items: [{ foodId: 'cod', grams: 160 }, { foodId: 'cauliflower', grams: 180 }, { foodId: 'butter', grams: 10 }],
    recipe:
      'Boil the cauliflower and mash it with butter - it stands in for mashed potato at a quarter of the load.',
  },
  {
    id: 'd-turkey-avocado',
    name: 'Turkey with cabbage and avocado salad',
    meals: ['dinner'],
    items: [{ foodId: 'turkey', grams: 150 }, { foodId: 'cabbage', grams: 120 }, { foodId: 'avocado', grams: 70 }, { foodId: 'oliveoil', grams: 8 }],
    recipe:
      'Grill the turkey breast. Shred the cabbage and toss with diced avocado and oil.',
  },
  {
    id: 'd-omelet-veg',
    name: 'Zucchini and tomato omelette',
    meals: ['dinner', 'breakfast'],
    items: [{ foodId: 'egg', grams: 165 }, { foodId: 'zucchini', grams: 100 }, { foodId: 'tomato', grams: 100 }, { foodId: 'oliveoil', grams: 8 }],
    recipe:
      'Fry the zucchini until soft, add the tomato, pour over the eggs and finish covered.',
  },
  {
    id: 'd-shrimp-spinach',
    name: 'Shrimp with spinach and feta',
    meals: ['dinner'],
    items: [{ foodId: 'shrimp', grams: 150 }, { foodId: 'spinach', grams: 100 }, { foodId: 'feta', grams: 30 }, { foodId: 'oliveoil', grams: 10 }],
    recipe:
      'Sear the shrimp for 2-3 minutes, add the spinach until it wilts, take off the heat and scatter with feta.',
  },
  {
    id: 'd-beans-stew',
    name: 'Braised beans with vegetables',
    meals: ['dinner', 'lunch'],
    items: [{ foodId: 'kidneybean', grams: 150 }, { foodId: 'tomato', grams: 100 }, { foodId: 'onion', grams: 50 }, { foodId: 'oliveoil', grams: 12 }],
    recipe:
      'Sweat the onion, add the tomatoes and the cooked beans, simmer 15 minutes with paprika and garlic.',
  },

  // ── Snacks ─────────────────────────────────────────────────────────────
  {
    id: 's-apple-almond',
    name: 'Apple with almonds',
    meals: ['snack'],
    items: [{ foodId: 'apple', grams: 150 }, { foodId: 'almonds', grams: 20 }],
    recipe:
      'Nuts alongside fruit flatten the glucose rise noticeably compared with the fruit on its own.',
  },
  {
    id: 's-greek-raspberry',
    name: 'Greek yogurt with raspberries',
    meals: ['snack'],
    items: [{ foodId: 'greekyogurt', grams: 150 }, { foodId: 'raspberry', grams: 70 }],
    recipe:
      'Raspberries carry more fibre than any other common berry: 6.5 g per 100 g.',
  },
  {
    id: 's-pear-walnut',
    name: 'Pear with walnuts',
    meals: ['snack'],
    items: [{ foodId: 'pear', grams: 150 }, { foodId: 'walnuts', grams: 20 }],
    recipe:
      'Eat the pear with the skin on - that is where most of the fibre sits.',
  },
  {
    id: 's-kefir-chia',
    name: 'Kefir with chia seeds',
    meals: ['snack'],
    items: [{ foodId: 'kefir', grams: 200 }, { foodId: 'chia', grams: 12 }],
    recipe:
      'Stir and leave for 10 minutes. A good option for a late snack.',
  },
  {
    id: 's-cottage-cucumber',
    name: 'Cottage cheese with cucumber and herbs',
    meals: ['snack'],
    items: [{ foodId: 'cottage', grams: 120 }, { foodId: 'cucumber', grams: 100 }],
    recipe:
      'Close to zero glycemic load with 20 g of protein.',
  },
  {
    id: 's-choc-peanut',
    name: 'Dark chocolate with peanuts',
    meals: ['snack'],
    items: [{ foodId: 'darkchoc', grams: 20 }, { foodId: 'peanuts', grams: 20 }],
    recipe:
      'Chocolate at 70% cocoa or above: GI 25 against 45 for milk chocolate.',
  },
]
