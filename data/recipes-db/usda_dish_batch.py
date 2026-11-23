"""
Build the menu batch (recipes_20.jsonl) from the USDA dish recipes in drafts/usda-dishes-recipes.json, keeping only dishes that are right.

A dish stays only if our ingredients, summed, reproduce USDA's own record for the dish: energy and net carbohydrate per 100 g (within 20%, carbohydrate
within 3 g or 20%), a glycemic index (carbohydrate-weighted, as build.py does it) within 20 points of USDA's own value, and ingredient weights that
make up at least 60% of the dish's default portion (a burrito bowl whose list holds 55 g of a 270 g bowl is not a recipe). USDA's weights are one
portion for some dishes and a batch for others: when they come to 1.5 portions or more, the servings are the rounded ratio, otherwise one.
The per-100 g comparison is made on the listed ingredients, so it does not depend on the default portion being right.
USDA gives ingredients and weights, not method: the steps are ours, written from the ingredients and the kind of dish, with no time or temperature
USDA does not give. Prints what was left out and why.

    FDC_DIR=<...> python3 data/recipes-db/usda_dish_recipes.py && python3 data/recipes-db/usda_dish_batch.py [--write]
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'foods-usda'))
from ingredients import ING
import fix_bread_gi as fb

DP = os.environ.get('PORTIONS_JSON')  # {fdc_id: {grams}} dumped from the engine's default portions (see the header of this file's commit)
foods = {str(f['fdc_id']): f for f in fb.load()['foods']}
recipes = json.load(open(os.path.join(HERE, 'drafts', 'usda-dishes-recipes.json')))
portion = json.load(open(DP))
LOW = lambda k: ING[k][0].split(',')[0].lower()
SKIP = {'salt', 'water', 'vinegar_distilled', 'distilled_vinegar'}
BREADS = {'white_bread', 'hamburger_bun', 'whole_grain_bread', 'rye_bread', 'bagel', 'flour_tortilla', 'whole_wheat_pita', 'whole_wheat_english_muffin'}
SPREAD = {'mayo', 'yellow_mustard', 'ketchup', 'sweet_relish', 'butter', 'italian_dressing', 'olive_oil', 'bbq_sauce'}

def join(xs):
    xs = list(dict.fromkeys(xs))
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]

def steps_for(r, n):
    name = r['name'].lower(); keys = [k for k, _ in r['ing'] if k not in SKIP]
    bread = [LOW(k) for k in keys if k in BREADS]; spreads = [LOW(k) for k in keys if k in SPREAD]
    rest = [LOW(k) for k in keys if k not in BREADS and k not in SPREAD]
    if re.search(r'sandwich|sub\b|hot dog|burger|gyro|hot pocket|turnover|pocket', name):
        base = bread[0] if bread else 'the bread'
        s = [f'Lay out the {base}' + (f' and spread it with {join(spreads)}.' if spreads else '.'), f'Layer {join(rest)} on top.' if rest else 'Add the filling.']
        s.append('Toast it in a dry pan until golden and the cheese melts, then cut in half and serve.' if 'grilled' in name else 'Close it, cut in half and serve.')
        return s
    if 'salad' in name:
        return [f'Cook what needs cooking and let it cool: {join(rest[:4])}.' if any(k in ('pasta_dry', 'white_pasta', 'potato_boiled', 'potato_baked', 'egg') for k, _ in r['ing']) else f'Prepare {join(rest[:4])}.',
                f'Mix everything with {join(spreads)} in a large bowl.' if spreads else 'Mix everything in a large bowl.',
                'Chill before serving' + (f' and divide into {n} portions.' if n > 1 else '.')]
    return [f'Prepare and measure the ingredients: {join(rest[:6])}.', 'Combine them and cook, stirring, until everything is hot and cooked through.',
            'Serve in ' + (f'{n} portions.' if n > 1 else 'one portion.')]

def times(r, n):
    name = r['name'].lower()
    if re.search(r'sandwich|sub\b|hot dog|gyro', name): return (5, 5 if re.search(r'grilled|hot dog', name) else 0)
    if 'salad' in name: return (15, 10 if re.search(r'pasta|macaroni|potato', name) else 0)
    return (10, 25)

keep, left = [], []
for r in recipes:
    f = foods[r['fdc_id']]; p = f['per100']; M = portion[r['fdc_id']]['grams']
    tot = sum(g for _, g in r['ing'])
    # USDA lists some recipes per 100 g of the cooked dish (raw rice, dry pasta and the cooking water add up to 100 g): with the water counted, a list of
    # 95 to 108 g for a portion that weighs more is such a recipe, and the portion is that list times portion / 100. Found 21 November 2026 from the dishes
    # whose weights came to 100 g exactly (barbecue chicken, ramen bowls, soups); a list that weighs far less than a portion without reaching 100 g is not.
    if 95 <= tot <= 108 and M >= tot * 1.25:
        r = {**r, 'ing': [[k, round(g * M / 100)] for k, g in r['ing']]}
        tot = sum(g for _, g in r['ing'])
    k = sum(ING[a][1] * g / 100 for a, g in r['ing']); c = sum((ING[a][4] - ING[a][5]) * g / 100 for a, g in r['ing'])
    dk, dc = k / tot * 100, c / tot * 100                      # per 100 g of what is listed
    uk, uc = p['kcal'], p['carbs'] - p['fiber']                # USDA's own, per 100 g of the dish
    ratio = tot / M
    n = round(ratio) if ratio >= 1.5 else 1
    gnum = gden = 0.0
    for a, g in r['ing']:
        av = max(0.0, ING[a][4] - ING[a][5]) * g / 100
        gnum += ING[a][6] * av; gden += av
    gi = round(gnum / gden) if gden > .5 else 0
    ugi = f['gi'] if f['gi'] is not None else None
    why = None
    if abs(dk - uk) / max(uk, 1) > .20: why = f'energy {dk:.0f} vs USDA {uk:.0f} kcal per 100 g'
    elif abs(dc - uc) > max(3, .2 * uc): why = f'net carbohydrate {dc:.0f} vs USDA {uc:.0f} g per 100 g'
    elif ratio < .6: why = f'the listed ingredients weigh {tot:.0f} g of a {M:.0f} g portion'
    elif ugi is not None and abs(gi - ugi) > 20: why = f'GI {gi} vs USDA {ugi}'
    if why: left.append((r['name'], why)); continue
    tags = ['quick'] if n == 1 and times(r, n)[1] <= 5 and 'salad' not in r['name'].lower() else (['meal-prep'] if n > 1 else [])
    prep, cook = times(r, n)
    keep.append({'name': r['name'], 'cat': r['cat'], 'cuisine': 'American', 'servings': n, 'prep': prep, 'cook': cook,
                 'ing': r['ing'], 'steps': steps_for(r, n), 'tags': tags, 'source': f'USDA FNDDS {r["fdc_id"]}' + ('; ' + '; '.join(r['notes']) if r['notes'] else '')})
print(f'{len(keep)} dishes kept, {len(left)} left out')
import collections
print(collections.Counter(w.split(' ')[0] + ' ' + w.split(' ')[1] for _, w in left))
for n_, w in left[:14]: print('  out:', n_[:46], '|', w)
if '--write' in sys.argv:
    with open(os.path.join(HERE, 'recipes_20.jsonl'), 'w') as fh:
        for r in keep: fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('wrote recipes_20.jsonl')
