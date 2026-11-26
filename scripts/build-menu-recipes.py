#!/usr/bin/env python3
"""
The recipes the weekly menu may choose from, as a small file the browser can load.

Reads data/recipes-db/recipes_db.json (1,000 recipes, nutrition per serving, computed from the
ingredient table by data/recipes-db/build.py) and writes src/data/menu-recipes.json. No number is
worked out here: nutrition, glycemic index and glycemic load are copied as the build computed them.
What this script does is choose and reshape:

  * which categories can be a meal on their own (not desserts, drinks or side dishes);
  * the grams of each ingredient per serving (the table holds the whole recipe, so grams / servings);
  * a category for each ingredient (for the shopping list), from the same map the engine uses.

Run:  python3 scripts/build-menu-recipes.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'recipes-db'

# Which meals a recipe category can be. Dessert, Drinks & Smoothies and Side Dish are left out on purpose:
# a week built from them would be sweets and sides, and a side dish is not a meal by itself.
MEALS = {
    'Breakfast': ['breakfast'],
    'Snack & Appetizer': ['snack'],
    'Salad': ['lunch', 'dinner'],
    'Soup & Stew': ['lunch', 'dinner'],
    'Sandwiches & Wraps': ['lunch'],
    'Poultry': ['lunch', 'dinner'],
    'Seafood': ['lunch', 'dinner'],
    'Beef, Pork & Lamb': ['lunch', 'dinner'],
    'Vegetarian & Vegan': ['lunch', 'dinner'],
}
GROUP_TO_CATEGORY = {
    'grain': 'grains', 'veg': 'vegetables', 'fruit': 'fruits', 'legume': 'legumes', 'protein': 'protein',
    'seafood': 'protein', 'egg': 'protein', 'dairy': 'dairy', 'plant_milk': 'dairy', 'nut': 'nuts', 'seed': 'nuts',
    'fat': 'fats', 'drink': 'drinks', 'condiment': 'sweets', 'spice': 'vegetables', 'herb': 'vegetables',
    'pantry': 'grains', 'supplement': 'nuts',
}

ingredients = {i['id']: i for i in json.loads((DATA / 'ingredients.json').read_text())}
# #99: the engine's rule (server/foods.ts, giEstimated): a recipe with at least 10 g of available carbohydrate a serving, half or more of it
# from ingredients whose GI is an estimate (gi_estimates.json, from gi_sources.py), says "GI estimated".
ESTIMATED = set(json.loads((DATA / 'gi_estimates.json').read_text())['ids'])
def gi_estimated(r, servings):
    total = est = 0.0
    for i in r['ingredients']:
        x = ingredients.get(i['ingredient_id'])
        if not x: continue
        a = max(0.0, x['per100']['carbs'] - x['per100']['fiber']) * float(i['grams']) / servings / 100
        total += a
        if i['ingredient_id'] in ESTIMATED: est += a
    return total >= 10 and est >= 0.5 * total
raw = json.loads((DATA / 'recipes_db.json').read_text())
rows = raw if isinstance(raw, list) else raw['recipes']

out, skipped = [], {}
for r in rows:
    meals = MEALS.get(r['category'])
    if not meals:
        skipped[r['category']] = skipped.get(r['category'], 0) + 1
        continue
    servings = max(1, int(r['servings']))
    ing = []
    for i in r['ingredients']:
        group = ingredients.get(i['ingredient_id'], {}).get('group', 'veg')
        grams = float(i['grams']) / servings
        # Pinches of spice are not shopping: below 2 g a serving they stay in the recipe and out of the list.
        ing.append([i['name'], round(grams, 1), GROUP_TO_CATEGORY.get(group, 'vegetables')])
    steps = r.get('steps') or []
    out.append({
        'id': r['id'], 'name': r['name'], 'cat': r['category'], 'cuisine': r['cuisine'], 'meals': meals,
        'kcal': r['kcal'], 'protein': r['protein_g'], 'fat': r['fat_g'], 'carbs': r['carbs_g'], 'fiber': r['fiber_g'],
        'gl': r['glycemic_load'], 'gi': r['glycemic_index'] if (r['carbs_g'] - r['fiber_g']) >= 0.5 else None,
        'min': r['total_min'], 'ing': ing, 'steps': steps if isinstance(steps, list) else [str(steps)],
        'tags': [t.strip() for t in (r.get('diet_tags') or '').split(',') if t.strip()],
        **({'giEst': True} if gi_estimated(r, servings) else {}),
    })

(ROOT / 'src' / 'data' / 'menu-recipes.json').write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False))
print(f'{len(out)} recipes written ({(ROOT / "src/data/menu-recipes.json").stat().st_size // 1024} KB); left out: {skipped}')
