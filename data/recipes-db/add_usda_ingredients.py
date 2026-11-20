"""
Add the ingredients that the USDA dish recipes need to ingredients.py, with the GI and provenance chosen in usda_new_ingredients_gi.py.

    python3 data/recipes-db/usda_new_ingredients_gi.py     # writes drafts/usda-new-ingredients-gi.json
    python3 data/recipes-db/add_usda_ingredients.py        # edits ingredients.py, writes data/gi-evidence/new_ingredient_provenance.json
    python3 data/gi-evidence/write_provenance.py && python3 data/recipes-db/export_ingredients.py

Safe to run twice: a key already in ingredients.py is left alone. Also puts each new wheat, nut and dairy ingredient in the dietary sets the recipe
tags and the avoid-lists read.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ingredients import ING
GROUP_OVER = {'usda_frankfurter_meatless': 'pantry', 'usda_tofu_soft': 'legume', 'usda_animal_fat_bacon_grease': 'protein', 'usda_fat_chicken': 'protein',
              'usda_shortening_vegetable': 'fat', 'usda_vinegar_distilled': 'condiment'}
GMAP = {'soup': 'pantry', 'sweet': 'pantry', 'sweetener': 'pantry'}
GLUTEN_ADD = ['white_flour', 'bread_crumbs', 'stuffing_mix', 'pie_crust', 'pasta_dry', 'rice_pilaf_mix', 'cream_of_mushroom_soup', 'frankfurter_meatless']
NUTS_ADD = ['hazelnut_spread', 'peanut_butter_reduced_fat']
DAIRY_ADD = ['cream_of_mushroom_soup']

o = {k: v for k, v in json.load(open(os.path.join(HERE, 'drafts', 'usda-new-ingredients-gi.json'))).items() if v['dishes'] > 0}
path = os.path.join(HERE, 'ingredients.py')
s = open(path).read()
lines, prov = [], {}
for slug, v in o.items():
    prov[v['key']] = {'gi': v['gi'], 'confidence': v['confidence'], 'basis': v['basis'], 'usda_fdc_id': v['fdc_id'], 'usda_name': v['name'], 'checked': '2026-11-20'}
    if v['key'] in ING: continue
    grp = GROUP_OVER.get(slug, GMAP.get(v['group'], v['group'])); pr = v['per100']
    lines.append(f'"{v["key"]}":("{v["display"]}",{pr["kcal"]:g},{pr["protein"]:g},{pr["fat"]:g},{pr["carbs"]:g},{pr["fiber"]:g},{v["gi"]},"{grp}"),')
if lines:
    head = ['# ── Added 20 November 2026 for the USDA dish recipes (data/recipes-db/usda_dish_recipes.py): nutrients from USDA FoodData Central (SR Legacy),',
            '#    GI and its provenance in data/gi-evidence/new_ingredient_provenance.json; a GI marked "estimate" there is the closest tested food, low confidence. ──']
    i = s.index('\n}\n\n# Dietary classification')
    s = s[:i + 1] + '\n'.join(head + lines) + '\n' + s[i + 1:]
    s = s.replace('"steel_cut_oats","oat_flour","oat_bran","miso","gochujang"}', '"steel_cut_oats","oat_flour","oat_bran","miso","gochujang",\n          ' + ','.join(f'"{k}"' for k in GLUTEN_ADD) + '}', 1)
    s = s.replace('"almond_flour","almond_milk","peanuts","peanut_butter","pesto"}', '"almond_flour","almond_milk","peanuts","peanut_butter","pesto",' + ','.join(f'"{k}"' for k in NUTS_ADD) + '}', 1)
    s = s.replace('| {"whey_protein"}', '| {"whey_protein",' + ','.join(f'"{k}"' for k in DAIRY_ADD) + '}', 1)
    open(path, 'w').write(s)
json.dump(prov, open(os.path.join(HERE, '..', 'gi-evidence', 'new_ingredient_provenance.json'), 'w'), indent=1, ensure_ascii=False)
print(len(lines), 'ingredients added;', len(prov), 'with provenance')
