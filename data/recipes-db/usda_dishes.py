"""
Candidate menu items from USDA's own survey dishes (FNDDS, public domain): a dish USDA publishes with its ingredient breakdown, whose glycemic index is
already computed from that breakdown with every part resolved (levels 1 to 3, none estimated), a real portion, and carbohydrate. Nothing is invented: the
ingredients and weights are USDA's, the glycemic load is ours.

    python3 data/recipes-db/usda_dishes.py [--write]      # prints the counts and a preview; --write saves drafts/usda-dishes-candidates.json

This only chooses and names candidates. It writes nothing to the menu: a list is shown to the owner first (the batch rule of 11 October), then a batch is built.
"""
import json, re, collections, sys, os, glob
HERE = os.path.dirname(os.path.abspath(__file__))
foods = json.load(open(os.path.join(HERE, '..', 'foods-usda', 'foods_usda.json')))['foods']

MEAL = re.compile(r'sandwich|burger|wrap|\bsub\b|soup|stew|chili|casserole|pasta|spaghetti|macaroni|lasagna|noodle|\brice\b|salad|omelet|scrambled|pancake|waffle|french toast|burrito|taco|enchilada|quesadilla|fajita|curry|stir|chow mein|pizza|hash|meatloaf|meatball|pot pie|stuffed|bowl|oatmeal|egg|chicken|turkey|shrimp|fish|salmon|tuna|beef|pork', re.I)
NOT = re.compile(r'ice cream|frozen yogurt|sundae|milkshake|shake\b|cone|cookie|cake|brownie|pudding|candy|pie, (?!pot)|pastry|donut|doughnut|dip\b|topping|dressing|sauce|gravy|salsa|baby|infant|formula|beverage|drink|smoothie|juice|jelly|frosting|syrup|gelatin|snack bar|granola bar|cereal bar|pretzel|chips|popcorn|crackers', re.I)
CUT = re.compile(r'^(beef|pork|lamb|veal|chicken|turkey|fish|ham|goat|game),\s*(?!.*(sandwich|stew|salad|soup|casserole|stir|curry|with|stuffed|pot pie|fajita|teriyaki|sweet and sour|barbecue|bbq))', re.I)

def cat(n):
    n = n.lower()
    if re.search(r'sandwich|burger|wrap|\bsub\b|burrito|taco|quesadilla|fajita|pizza', n): return 'Sandwiches & Wraps'
    if re.search(r'soup|stew|chili', n): return 'Soup & Stew'
    if 'salad' in n: return 'Salad'
    if re.search(r'omelet|scrambled|pancake|waffle|french toast|oatmeal|\begg\b|eggs', n): return 'Breakfast'
    if re.search(r'shrimp|fish|salmon|tuna|crab|seafood|cod\b', n): return 'Seafood'
    if re.search(r'chicken|turkey', n): return 'Poultry'
    if re.search(r'beef|pork|lamb|ham\b|sausage|meatloaf|meatball|steak', n): return 'Beef, Pork & Lamb'
    return 'Vegetarian & Vegan'

def family(n):
    # one family per dish: the name without the variants that only change the label (NFS, reduced fat, which bread)
    n = re.sub(r',\s*(nfs|ns as to [^,]+)', '', n.lower())
    n = re.sub(r'\b(reduced fat|low fat|fat free|light|lite|diet|with cheese|on white|on wheat|on whole wheat|on rye|on roll|on bun|on bagel|from fast food|from restaurant|restaurant|fast food|school lunch|from school lunch|from frozen|from fresh|home recipe|homemade|canned|frozen)\b', '', n)
    return re.sub(r'[^a-z]+', ' ', n).strip()

cand = []
for f in foods:
    if f['dataset'] != 'survey_fndds' or 'ingredient breakdown' not in (f.get('gi_basis') or ''): continue
    if 'estimated at level 4' in f['gi_basis']: continue                    # every part resolved, none estimated
    n = f['name']
    if not MEAL.search(n) or NOT.search(n) or CUT.search(n): continue
    p = f['per100']
    if p.get('carbs', 0) < 3: continue
    cand.append({'fdc_id': f['fdc_id'], 'name': n, 'cat': cat(n), 'gi': f['gi'], 'family': family(n)})

# up to two per family (the label-only variants are one dish to a person planning a week)
seen = collections.Counter(); kept = []
for c in sorted(cand, key=lambda c: (c['family'], len(c['name']))):
    if seen[c['family']] < 2: kept.append(c)
    seen[c['family']] += 1
mine = set()
for fn in glob.glob(os.path.join(HERE, 'recipes_*.jsonl')):
    for l in open(fn):
        l = l.strip()
        if l: mine.add(re.sub(r'[^a-z]+', ' ', json.loads(l)['name'].lower()).strip())
kept = [c for c in kept if re.sub(r'[^a-z]+', ' ', c['name'].lower()).strip() not in mine]
print(f'candidates after the meal filter: {len(cand)}; after two per family and not already a recipe: {len(kept)}')
print(dict(collections.Counter(c['cat'] for c in kept)))
import random; random.seed(1)
for c in random.sample(kept, min(40, len(kept))): print(f"  {c['cat'][:18]:18} GI {str(c['gi']):>3}  {c['name'][:70]}")
if '--write' in sys.argv:
    os.makedirs(os.path.join(HERE, 'drafts'), exist_ok=True)
    json.dump(kept, open(os.path.join(HERE, 'drafts', 'usda-dishes-candidates.json'), 'w'), indent=1)
    print('wrote drafts/usda-dishes-candidates.json')
