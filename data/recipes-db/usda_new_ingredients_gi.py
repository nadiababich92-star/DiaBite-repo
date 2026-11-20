"""
Propose a glycemic index and its provenance for the new ingredients that the USDA dish recipes need (drafts/usda-new-ingredients.json).
Policy of data/gi-evidence/write_provenance.py: no available carbohydrate (<= 0.6 g net) -> 0, definitional; otherwise the 2021 International Tables
(ISO median when n >= 2, else ISO + method-deviation median, else the Sydney database); with no measured value anywhere, the owner's decision of
20 November 2026: the GI of the closest tested food, labelled an estimate, confidence low. Writes drafts/usda-new-ingredients-gi.json. Changes nothing else.
"""
import json, os, re, statistics, sys
HERE = os.path.dirname(os.path.abspath(__file__))
INTL = json.load(open(os.path.join(HERE, '..', 'gi-evidence', 'intl_tables_2021.json')))['rows']
SYD = [r for r in json.load(open(os.path.join(HERE, 'sydney_gi_db.json')))['rows'] if str(r['gi']).strip().isdigit()]
new = json.load(open(os.path.join(HERE, 'drafts', 'usda-new-ingredients.json')))

# key, display name, group, regex over the table's food names (None = no measurement of this food), exclusion, estimate if unmeasured (value, closest tested food)
G = {
 'usda_bologna_meat_and_poultry': ('bologna', 'Bologna', 'protein', None, None, (62, 'frankfurter (a processed sausage)')),
 'usda_refried_beans_canned': ('refried_beans_canned', 'Refried beans, canned', 'legume', r'refried', None, None),
 'usda_cheese_product_pasteurized_process': ('american_cheese_reduced_fat', 'American cheese, processed, reduced fat', 'dairy', r'processed cheese|cheese slice|cheese, processed|american cheese', r'curry|rice', None),
 'usda_frankfurter_beef': ('frankfurter_beef', 'Frankfurter, beef', 'protein', r'frankfurter|wiener|hot dog', r'bun|roll|bread|burger', None),
 'usda_frankfurter_meat_and_poultry': ('frankfurter', 'Frankfurter, beef and pork', 'protein', r'frankfurter|wiener|hot dog', r'bun|roll|bread|burger', None),
 'usda_frankfurter_low_sodium': ('frankfurter_low_sodium', 'Frankfurter, low sodium', 'protein', r'frankfurter|wiener|hot dog', r'bun|roll|bread|burger', None),
 'usda_frankfurter_turkey': ('frankfurter_turkey', 'Frankfurter, turkey', 'protein', r'frankfurter|wiener|hot dog', r'bun|roll|bread|burger', None),
 'usda_frankfurter_meatless': ('frankfurter_meatless', 'Frankfurter, meatless', 'protein', r'frankfurter|wiener|hot dog', r'bun|roll|bread|burger', None),
 'usda_catsup': ('ketchup', 'Ketchup', 'condiment', r'tomato ketchup|ketchup|catsup', None, None),
 'usda_chocolate_flavored_hazelnut_spread': ('hazelnut_spread', 'Chocolate hazelnut spread', 'pantry', r'nutella|hazelnut spread|chocolate hazelnut', None, None),
 'usda_peanut_butter_smooth': ('peanut_butter_reduced_fat', 'Peanut butter, reduced fat', 'nut', r'peanut butter', r'biscuit|cookie|bar|cracker|bake|cereal', None),
 'usda_luncheon_meat_pork_with_ham': ('luncheon_meat', 'Luncheon meat, canned', 'protein', None, None, (62, 'frankfurter (a processed meat)')),
 'usda_pie_crust_standard_type': ('pie_crust', 'Pie crust, ready-to-bake', 'grain', r'pie crust|pastry shell|pie shell|short ?crust', None, None),
 'usda_sauce_pasta': ('pasta_sauce', 'Pasta sauce, marinara', 'condiment', r'pasta sauce|marinara|tomato and vegetable pasta sauce', None, None),
 'usda_salad_dressing_italian_dressing': ('italian_dressing', 'Italian dressing', 'condiment', None, None, (15, 'the conventional placeholder for a dressing: oil and vinegar with a little sugar')),
 'usda_peppers_sweet': ('green_bell_pepper', 'Green bell pepper', 'veg', None, None, (15, 'the conventional placeholder for non-starchy vegetables')),
 'usda_beans_snap': ('green_beans_frozen', 'Green beans, frozen, cooked', 'veg', r'green beans?|snap beans?|french beans?', r'dessert|loubieh|casserole|soup', None),
 'usda_tomatoes_red': ('tomato_raw', 'Tomato, raw', 'veg', r'tomato\b|tomatoes\b', r'juice|soup|sauce|paste|tortilla|watermelon', None),
 'usda_beans_black_turtle': ('black_beans_canned', 'Black beans, canned', 'legume', r'black beans?|turtle beans?', r'soup|instant|burrito|chip', None),
 'usda_pickle_relish_sweet': ('sweet_relish', 'Sweet pickle relish', 'condiment', None, None, (50, 'a sweet pickle in sugar syrup: between sucrose (65) and cucumber pickles (placeholder 15)')),
 'usda_pickles_cucumber': ('sweet_pickles', 'Sweet pickles (bread and butter)', 'condiment', None, None, (50, 'a sweet pickle in sugar syrup: between sucrose (65) and cucumber pickles (placeholder 15)')),
 'usda_potatoes_baked': ('potato_baked_with_skin', 'Potato, baked, with skin', 'veg', r'potato, baked|potatoes, baked|baked potato|potato.{0,20}bake', r'chips|crisps|lays', None),
 'usda_sugars_powdered': ('powdered_sugar', 'Powdered sugar', 'sweetener', r'sucrose|table sugar|white sugar|sugar, white', None, None),
 'usda_candies_marshmallows': ('marshmallows', 'Marshmallows', 'sweet', r'marshmallows?', None, None),
 'usda_maraschino_cherries_canned': ('maraschino_cherries', 'Maraschino cherries', 'fruit', r'cherries|cherry', r'dried|juice|jam|yog|yoghurt|fromage|pie|muffin', None),
 'usda_soy_sauce_made_from_soy_and_wheat_shoyu': ('soy_sauce', 'Soy sauce', 'condiment', r'soy sauce|soya sauce', r'rice|topped|with', None),
 'usda_bread_crumbs': ('bread_crumbs', 'Bread crumbs, dry', 'grain', None, None, (72, 'white bread (International Tables, median 72); dried crumbs are not measured')),
 'usda_soup_cream_of_mushroom': ('cream_of_mushroom_soup', 'Cream of mushroom soup, condensed', 'soup', r'cream of mushroom|mushroom soup', None, None),
 'usda_rice_white': ('white_rice_raw', 'White rice, long-grain, raw', 'grain', r'white rice|rice, white|long grain|jasmine|basmati|doongara|sunrice', r'cooked|boiled|steamed|noodle|flour|milk|cake|pudding|brown', None),
 'usda_milk_dry': ('dry_milk_nonfat', 'Dry milk, nonfat', 'dairy', r'skim milk powder|milk powder|powdered milk|dried milk', r'formula|infant|active life', None),
 'usda_pasta_dry': ('pasta_dry', 'Pasta, dry', 'grain', None, None, (49, 'white pasta cooked al dente (our own ingredient, International Tables); the dry weight is costed the same way')),
 'usda_wheat_flour_white': ('white_flour', 'White flour, all-purpose', 'grain', r'wheat flour|plain flour|white flour|flour, white|flour, wheat', None, None),
 'usda_cabbage_chinese_pak_choi': ('bok_choy', 'Bok choy', 'veg', None, None, (15, 'the conventional placeholder for non-starchy vegetables')),
 'usda_rice_and_vermicelli_mix_rice_pilaf_flav': ('rice_pilaf_mix', 'Rice and vermicelli mix, pilaf', 'grain', r'rice vermicelli|rice pilaf|pilaf', None, None),
 'usda_raisins_dark': ('raisins', 'Raisins', 'fruit', r'raisins?', r'bran|muffin|bread|cereal|bar|cookie|bagel', None),
 'usda_sauce_barbecue': ('bbq_sauce', 'Barbecue sauce', 'condiment', None, None, (55, 'ketchup (the same sugar-and-tomato sauce)')),
 'usda_soup_bouillon_cubes_and_granules': ('bouillon_dry', 'Bouillon, dry', 'soup', None, None, (15, 'the conventional placeholder: used in grams as a seasoning')),
 'usda_bread_stuffing': ('stuffing_mix', 'Bread stuffing, dry mix', 'grain', r'bread stuffing|stuffing', None, None),
 'usda_mushrooms_canned': ('mushrooms_canned', 'Mushrooms, canned', 'veg', None, None, (15, 'the conventional placeholder for non-starchy vegetables')),
 'usda_waterchestnuts_chinese': ('water_chestnuts', 'Water chestnuts, canned', 'veg', None, None, (15, 'the conventional placeholder for non-starchy vegetables')),
 'usda_peppers_jalapeno': ('jalapeno_raw', 'Jalapeno pepper, raw', 'veg', None, None, (15, 'the conventional placeholder for non-starchy vegetables')),
 'usda_beans_baked': ('baked_beans', 'Baked beans, canned, with pork', 'legume', r'baked beans?', None, None),
 'usda_carrots_cooked': ('carrots_cooked', 'Carrots, cooked', 'veg', r'carrots?\b', r'juice|cake|soup|puree|muffin', None),
}
def pool(tier):
    return INTL if tier is None else [r for r in INTL if r['tier'] == tier]
def hits(rx, ex, rows):
    r = re.compile('^(?:' + rx + ')', re.I); e = re.compile(ex, re.I) if ex else None
    return [x for x in rows if r.search(x['food']) and not (e and e.search(x['food'])) and x.get('gi') is not None]
# names for the ingredients that need no GI search (meats, fats, a vinegar): a key and the name the menu prints
NAMES = {
 'usda_ham_sliced': ('ham_deli_lean', 'Ham, deli sliced, 96% fat free'), 'usda_beef_cured': ('corned_beef', 'Corned beef, cooked'),
 'usda_pork_fresh': ('pork_fat_cooked', 'Pork fat, cooked'), 'usda_pork_sausage_link_patty': ('pork_sausage', 'Pork sausage, cooked'),
 'usda_salami_dry_or_hard': ('salami', 'Salami'), 'usda_pepperoni_beef_and_pork': ('pepperoni', 'Pepperoni'),
 'usda_roast_beef_deli_style': ('roast_beef_deli', 'Roast beef, deli sliced'), 'usda_vinegar_distilled': ('distilled_vinegar', 'Distilled vinegar'),
 'usda_animal_fat_bacon_grease': ('bacon_grease', 'Bacon grease'), 'usda_chicken_broiler': ('chicken_thigh_bbq_rotisserie', 'Chicken thigh, BBQ rotisserie, meat only'),
 'usda_chicken_broilers_or_fryers': ('chicken_giblets', 'Chicken giblets, simmered'), 'usda_tofu_soft': ('tofu_soft', 'Tofu, soft'),
 'usda_shortening_vegetable': ('vegetable_shortening', 'Vegetable shortening'), 'usda_rice_and_vermicelli_mix_rice_pilaf_flavo': ('rice_pilaf_mix', 'Rice and vermicelli mix, pilaf'),
 'usda_fat_chicken': ('chicken_fat', 'Chicken fat'), 'usda_turkey_whole': ('turkey_roasted', 'Turkey, roasted, meat only'),
 'usda_beef_round': ('beef_round_roast', 'Beef round, cooked, with fat'), 'usda_beef_ground': ('ground_beef_80', 'Ground beef 80% lean, cooked'),
}
out = {}
for slug, v in new.items():
    if v['dishes'] <= 0: continue
    net = max(0.0, v.get('carbs', 0) - v.get('fiber', 0))
    base = {'name': v['name'], 'fdc_id': v['fdc_id'], 'per100': {k: v.get(k, 0) for k in ('kcal', 'protein', 'fat', 'carbs', 'fiber')}, 'dishes': v['dishes']}
    if slug in G:
        key, disp, group, rx, ex, est = G[slug]
        base.update(key=key, display=disp, group=group)
        iso = hits(rx, ex, [r for r in INTL if r['tier'] == 'ISO']) if rx else []
        dev = hits(rx, ex, [r for r in INTL if r['tier'] == 'deviation']) if rx else []
        syd = [r for r in SYD if rx and re.match('^(?:' + rx + ')', r['food'], re.I) and not (ex and re.search(ex, r['food'], re.I))]
        med = lambda xs: round(statistics.median(xs))
        if len(iso) >= 2:
            g = [x['gi'] for x in iso]; base.update(gi=med(g), confidence='high', basis=f'median of {len(g)} ISO-compliant tests, range {min(g):g}-{max(g):g}', sample=[x['food'][:60] for x in iso[:2]])
        elif iso or dev:
            g = [x['gi'] for x in iso + dev]; base.update(gi=med(g), confidence='medium', basis=f'median of {len(g)} tests (ISO and method deviations), range {min(g):g}-{max(g):g}', sample=[x['food'][:60] for x in (iso + dev)[:2]])
        elif syd:
            g = [float(x['gi']) for x in syd]; base.update(gi=med(g), confidence='medium', basis=f'median of {len(g)} entries of the Sydney database, range {min(g):g}-{max(g):g}', sample=[x['food'][:60] for x in syd[:2]])
        elif est:
            base.update(gi=est[0], confidence='low', basis=f'ESTIMATE, no measurement: {est[1]}', sample=[])
        else:
            base.update(gi=None, confidence='none', basis='no measurement and no estimate chosen', sample=[])
    else:
        key2, disp2 = NAMES.get(slug, (slug.replace('usda_', ''), v['name'].split(',')[0]))
        base.update(key=key2, display=disp2, group='protein', gi=0, confidence='definitional' if net <= 0.6 else 'CHECK', basis='no available carbohydrate: GI 0 by definition' if net <= 0.6 else 'unclassified', sample=[])
    out[slug] = base
# Chosen by hand 20 November 2026 after reading what the pools returned: the first pass matched composites (cola for powdered sugar, carrot cake for flour), so
# an ingredient is taken from a measurement only when the tested food IS that ingredient; a processed meat or cheese with under 11 g carbohydrate takes the
# conventional placeholder; a food eaten cooked or baked takes the GI of what it becomes; the rest is an estimate from the closest tested food, labelled low.
PH = 'the conventional placeholder (15) for a food with too little carbohydrate to test'
OVER = {
 'usda_bologna_meat_and_poultry': (15, 'low', 'ESTIMATE: ' + PH + '; the carbohydrate is filler'),
 'usda_luncheon_meat_pork_with_ham': (15, 'low', 'ESTIMATE: ' + PH),
 'usda_cheese_product_pasteurized_process': (15, 'low', 'ESTIMATE: ' + PH),
 'usda_frankfurter_beef': (15, 'low', 'ESTIMATE: ' + PH), 'usda_frankfurter_meat_and_poultry': (15, 'low', 'ESTIMATE: ' + PH),
 'usda_frankfurter_low_sodium': (15, 'low', 'ESTIMATE: ' + PH), 'usda_frankfurter_turkey': (15, 'low', 'ESTIMATE: ' + PH),
 'usda_frankfurter_meatless': (15, 'low', 'ESTIMATE: ' + PH),
 'usda_catsup': (50, 'low', 'ESTIMATE, no measurement of ketchup in the pooled sources: a sugar-sweetened tomato sauce, between sucrose (62) and tomato (23)'),
 'usda_sauce_barbecue': (50, 'low', 'ESTIMATE: the same as ketchup, a sugar-sweetened tomato sauce'),
 'usda_peanut_butter_smooth': (14, 'medium', 'equivalent food: our peanut butter (International Tables); the reduced-fat kind carries more sugar'),
 'usda_pie_crust_standard_type': (55, 'low', 'ESTIMATE: baked wheat pastry; no measurement of a plain crust in the pooled sources (Danish pastry 59)'),
 'usda_beans_snap': (15, 'low', 'ESTIMATE: ' + PH + ' (non-starchy vegetable)'),
 'usda_soup_cream_of_mushroom': (50, 'low', 'ESTIMATE: a starch-thickened condensed soup; no measurement of this soup alone in the pooled sources'),
 'usda_milk_dry': (27, 'medium', 'equivalent food: our milk (reconstituted milk powder has the same lactose-to-protein balance)'),
 'usda_wheat_flour_white': (72, 'low', 'equivalent food: white bread (International Tables, median 72); the table\'s 20 is for raw flour, and these dishes cook it'),
 'usda_rice_white': (73, 'medium', 'equivalent food: our white rice, cooked (the dry weight carries the same GI once cooked)'),
 'usda_rice_and_vermicelli_mix_rice_pilaf_flavo': (73, 'low', 'ESTIMATE: white rice and wheat vermicelli, cooked'),
 'usda_beans_black_turtle': (30, 'medium', 'equivalent food: our black beans (International Tables)'),
 'usda_bread_stuffing': (75, 'low', 'one measurement (Paxo stuffing, 75); no other in the pooled sources'),
 'usda_salad_dressing_italian_dressing': (15, 'low', 'ESTIMATE: ' + PH),
 'usda_maraschino_cherries_canned': (35, 'medium', 'median of 4 tests of cherries (ISO and method deviations), range 22-63'),
 'usda_sauce_pasta': (23, 'low', 'one measurement (commercial tomato and vegetable pasta sauce, 23)'),
}
for slug, (gi, conf, basis) in OVER.items():
    if slug in out: out[slug].update(gi=gi, confidence=conf, basis=basis, sample=[])
for v in out.values():
    if v['confidence'] == 'CHECK' or v['gi'] is None:
        net = max(0, v['per100']['carbs'] - v['per100']['fiber'])
        v.update(gi=0, confidence='definitional', basis='negligible carbohydrate (%.1f g net per 100 g): GI 0, as for our other meats, fish, eggs and fats' % net) if net <= 1 else v.update(gi=15, confidence='low', basis='ESTIMATE: ' + PH)
json.dump(out, open(os.path.join(HERE, 'drafts', 'usda-new-ingredients-gi.json'), 'w'), indent=1)
import collections
print(len(out), dict(collections.Counter(v['confidence'] for v in out.values())))
for slug, v in out.items():
    if v['confidence'] in ('definitional',): continue
    print(f"{v['display'][:34]:34} C {v['per100']['carbs']:5.1f}  GI {str(v['gi']):>4}  {v['confidence']:8} {v['basis'][:70]} {('| ' + '; '.join(v['sample'])[:70]) if v['sample'] else ''}")
