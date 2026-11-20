"""
Turn the owner-approved USDA survey dishes (drafts/usda-dishes-approved-list.json) into menu recipe drafts, with USDA's own ingredients and weights.

    FDC_DIR=<unpacked USDA zips, as for data/foods-usda/fix_bread_gi.py> python3 data/recipes-db/usda_dish_recipes.py

Each ingredient of a USDA dish is resolved, in this order, to (1) the ingredient of our table that data/recipes-db/usda-links.csv links to its USDA
record; (2) a table ingredient with the same name and nutrients (name overlap >= 60%, kcal within 25%, carbohydrate within 30%); (3) for a generic
survey ingredient that has no nutrient record anywhere ("Cheese as ingredient in sandwiches", "Vegetable oil, NFS"), the substitute in GENERIC below,
allowed by the owner on 20 November 2026 only where the carbohydrate it adds to the dish is at most 2 g, and labelled in the recipe; (4) a NEW
ingredient built from the USDA record itself (to be added to ingredients.py after the owner has seen it). A dish with an ingredient it cannot
resolve is left out: no data, so skipped. Ingredients under 3 g and tap water are not listed.

Writes drafts/usda-dishes-recipes.json (the recipes) and drafts/usda-new-ingredients.json (what would be added). Nothing reaches the menu.
"""
import collections, csv, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'foods-usda'))
from ingredients import ING
import fix_bread_gi as fb

MAX_SUB_CARBS_G = 2.0
GENERIC = {  # survey code -> (our ingredient, what the label says)
    '99991400': 'cheddar', '99991410': 'cheddar', '14410110': 'cheddar', '14010000': 'cheddar',
    '99992100': 'ground_beef', '21500100': 'ground_beef', '21101000': 'beef_sirloin',
    '99992405': 'chicken_breast', '24100000': 'chicken_breast', '24102070': 'rotisserie_chicken', '24122171': 'rotisserie_chicken',
    '89902070': 'tomato', '89902020': 'iceberg', '89902040': 'onion', '89902010': 'cucumber', '89902050': 'bell_pepper',
    '31105005': 'egg', '11100000': 'milk', '82101000': 'olive_oil', '82104000': 'olive_oil', '81100000': 'butter', '81102010': 'butter',
    '75510000': 'olives', '75511100': 'dill_pickle', '75115000': 'mushrooms', '22400100': 'pork_shoulder', '22101010': 'pork_chop',
    '42200500': 'almond_butter',
}
# A USDA record whose name is not ours but which is the same food with the same nutrients (checked by hand 20 November 2026: kcal within 25 and
# carbohydrate within a few grams of our record), so it is not a new ingredient.
SAME = {
 'usda_salad_dressing_mayonnaise': 'mayo', 'usda_egg_whole': 'egg', 'usda_carrots_cooked': 'carrot', 'usda_refried_beans_canned': 'refried_beans',
 'usda_soy_sauce_made_from_soy_and_wheat_shoyu': 'soy_sauce', 'usda_salt_table': 'salt', 'usda_tomatoes_red': 'tomato', 'usda_peppers_sweet': 'bell_pepper',
 'usda_mushrooms_canned': 'mushrooms', 'usda_potatoes_baked': 'potato_baked', 'usda_crustaceans_shrimp': 'shrimp', 'usda_crustaceans_crab': 'crab',
 'usda_fish_anchovy': 'anchovies', 'usda_fish_cod': 'cod', 'usda_soup_chicken_broth': 'chicken_broth', 'usda_soup_beef_broth_or_bouillon_canned': 'beef_broth',
 'usda_sugars_powdered': 'sugar_white', 'usda_cabbage_chinese_pak_choi': 'bok_choy', 'usda_waterchestnuts_chinese': 'water_chestnuts',
}
NID = {'1008': 'kcal', '1003': 'protein', '1004': 'fat', '1005': 'carbs', '1079': 'fiber'}
STOP = {'raw','cooked','with','and','without','added','salt','the','or','of','nfs','ns','as','to','type','includes','foods','for','usda','s','food','distribution','program','boiled','drained','enriched','regular','prepackaged','sliced','canned','whole','fresh','year','round','average','ingredient','ingredients','recipes','use','sandwich','sandwiches','on','in','a'}
words = lambda s: set(re.findall(r'[a-z]+', s.lower())) - STOP

def main():
    FD = os.environ['FDC_DIR']
    sv = f'{FD}/FoodData_Central_survey_food_csv_2024-10-31/FoodData_Central_survey_food_csv_2024-10-31'
    sr = f'{FD}/FoodData_Central_sr_legacy_food_csv_2018-04/FoodData_Central_sr_legacy_food_csv_2018-04'
    ndb, comp = fb.components()
    srdesc = {r['fdc_id']: r['description'] for r in csv.DictReader(open(sr + '/food.csv'))}
    srnut = collections.defaultdict(dict)
    for r in csv.DictReader(open(sr + '/food_nutrient.csv')):
        if r['nutrient_id'] in NID: srnut[r['fdc_id']][NID[r['nutrient_id']]] = float(r['amount'])
    link = {}
    for r in csv.DictReader(open(os.path.join(HERE, 'usda-links.csv'), encoding='utf-8-sig')):
        if r['status'] == 'applied' and r['key'].startswith('ing:') and r['key'][4:] in ING: link[r['use_fdc_id'] or r['fdc_id']] = r['key'][4:]
    rows = collections.defaultdict(list)
    for r in csv.DictReader(open(sv + '/input_food.csv')): rows[r['fdc_id']].append(r)
    dishes = json.load(open(os.path.join(HERE, 'drafts', 'usda-dishes-approved-list.json')))
    new, recipes, left = {}, [], []
    for d in dishes:
        ing = collections.OrderedDict(); notes = []; why = None; subs = 0.0
        for row in rows[d['fdc_id']]:
            g = float(row['gram_weight'] or 0); code = row['sr_code'].lstrip('0'); fid = ndb.get(code, '')
            if g < 3 or code == '14411' or fid == '174' or code == '14429': continue
            key = None
            if fid in link: key = link[fid]
            elif fid and srnut.get(fid, {}).get('kcal') is not None:
                p = srnut[fid]; a = words(srdesc[fid])
                best = None
                for k, (nm, kc, pr, fa, cb, fi, gi, gr) in ING.items():
                    b = words(nm)
                    if not a or not b: continue
                    c = len(a & b) / min(len(a), len(b))
                    if c >= 0.6 and abs(kc - p['kcal']) <= max(30, .25 * p['kcal']) and abs(cb - p.get('carbs', 0)) <= max(3, .3 * max(p.get('carbs', 0), cb)) and (best is None or c > best[0]): best = (c, k)
                if best: key = best[1]
                else:
                    key = 'usda_' + re.sub(r'[^a-z0-9]+', '_', srdesc[fid].lower().split(',')[0] + '_' + (srdesc[fid].lower().split(',')[1] if ',' in srdesc[fid] else ''))[:40].strip('_')
                    new.setdefault(key, {'fdc_id': fid, 'name': srdesc[fid], **{k: round(v, 1) for k, v in srnut[fid].items()}, 'dishes': 0})
            elif code in GENERIC:
                key = GENERIC[code]; c = ING[key][4] * g / 100; subs += c
                notes.append(f'{row["sr_description"]} counted as {ING[key][0].lower()}')
            else:
                why = f'no nutrient data for "{row["sr_description"]}"'; break
            key = SAME.get(key, key)
            ing[key] = ing.get(key, 0) + g
        if why is None and subs > MAX_SUB_CARBS_G: why = f'the substituted ingredients would add {subs:.1f} g carbohydrate'
        if why: left.append((d['name'], why)); continue
        for k in ing:
            if k in new: new[k]['dishes'] += 1
        recipes.append({'fdc_id': d['fdc_id'], 'name': d['name'], 'cat': d['cat'], 'ing': [[k, round(v)] for k, v in ing.items()], 'notes': sorted(set(notes)), 'usda_gi': d['gi']})
    json.dump(recipes, open(os.path.join(HERE, 'drafts', 'usda-dishes-recipes.json'), 'w'), indent=1)
    json.dump(new, open(os.path.join(HERE, 'drafts', 'usda-new-ingredients.json'), 'w'), indent=1)
    print(f'{len(recipes)} dishes buildable, {len(left)} left out, {len(new)} new ingredients')
    print(collections.Counter(w.split(' for ')[0][:40] for _, w in left).most_common(8))
    return recipes, new, left

if __name__ == '__main__':
    main()
