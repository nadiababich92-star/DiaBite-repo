"""
Keep a computed dish glycemic index only when it covers the dish, and give sushi its measured value.

Why (20 November 2026): build_foods.py computes a dish's GI as the carbohydrate-weighted mean of its USDA ingredients, and silently skips an
ingredient that has no USDA SR record (1,269 of the 1,969 computed dishes have some). A peanut butter sandwich on wheat bread lost its bread
(survey-only code 99995130) and was GI 14 from the peanut butter alone; 462 dishes see less than 80% of their own carbohydrate and 233 less than 60%.

The owner decided on 20 November: the rule is that **a computed GI stays only if the ingredients with a source hold at least 80% of the
dish's own carbohydrate**. Otherwise the dish has no GI (gi null, level 5, the same wording as every other food with none), which makes it
kind `unrated` in the engine: carbohydrate, fibre and calories are costed, the glycemic load is not, and the meal is never "fits" (CLAUDE.md rule 4).

Coverage = (carbohydrate of the ingredients that have an SR record) / (the dish's own carbohydrate per 100 g x the sum of its ingredient grams).
A dish with 1 g of carbohydrate or less is left as it is: its load is negligible whatever the GI. A dish whose ingredients all have an SR record is
left as it is too: nothing was skipped, and a gap between its ingredients' carbohydrate and its own (cooking, rounding) is not a missing ingredient
(chicken liver, every ingredient sourced, shows 79%).

Sushi: the USDA recipe is built on glutinous rice (GI 94), which is not what sushi rice is. The International Tables measure sushi itself
(salmon sushi 48, ISO, 10 subjects; brown rice sushi 45; sushi rice alone 85), so a sushi dish built on glutinous rice gets 48, approximate.
It is set before the coverage rule and is not subject to it: it is a measurement of the whole food.

    FDC_DIR=<same as for fix_bread_gi.py> python3 data/foods-usda/fix_coverage_gi.py [--check]

The dishes this script un-rates no longer carry "ingredient breakdown" in their basis, so fix_bread_gi.py and fix_staple_gi.py leave them alone.
"""
import json, sys

import fix_bread_gi as fb

DATE = '20 November 2026'
MIN_COVERAGE = 0.8
SUSHI = 48
GLUTINOUS = '169711'  # Rice, white, glutinous, unenriched, cooked (SR 20052)
SUSHI_BASIS = ('equivalent food: measured value for "Sushi, salmon" (International Tables of Glycemic Index 2021, ISO, 10 subjects, GI 48); set ' + DATE +
               ': the earlier computation used glutinous rice (GI 94), which is not sushi rice — approximate')
NO_GI = ("no value could be assigned with confidence — the agent must answer 'unknown' rather than guess (Aston level 5 would assign a nominal 70; we do not); "
         "withdrawn " + DATE + ": the ingredients with a USDA source hold {pct}% of this dish's carbohydrate, below the {min}% needed to compute a value")


def coverage(f, byf, ndb, comp):
    cs = comp.get(str(f['fdc_id']), [])
    total_g = sum(g for _, g in cs)
    dish_carb = f['net_carbs'] * total_g / 100.0
    if dish_carb <= 1:
        return 1.0
    seen, skipped = 0.0, False
    for code, g in cs:
        s = byf.get(ndb.get(code, ''))
        if s:
            seen += max(s['net_carbs'], 0) * g / 100.0
        elif g > 0:
            skipped = True
    return seen / dish_carb if skipped else 1.0


def main():
    check = '--check' in sys.argv
    data = fb.load()
    foods = data['foods']
    byf = {str(f['fdc_id']): f for f in foods}
    ndb, comp = fb.components()
    computed = [f for f in foods if f['dataset'] == 'survey_fndds' and 'ingredient breakdown' in (f.get('gi_basis') or '')]
    sushi = [f for f in foods if f['dataset'] == 'survey_fndds' and f['name'].startswith('Sushi')
             and any(ndb.get(c) == GLUTINOUS for c, _ in comp.get(str(f['fdc_id']), []))
             and (f['gi'] != SUSHI)]
    sushi_ids = {str(f['fdc_id']) for f in sushi}
    withdraw = []
    for f in computed:
        if f['gi'] is None or str(f['fdc_id']) in sushi_ids or f['name'].startswith('Sushi'):
            continue
        c = coverage(f, byf, ndb, comp)
        if c < MIN_COVERAGE:
            withdraw.append((f, c))
    print(f'{len(computed)} computed dishes; {len(sushi)} sushi dishes to set to {SUSHI}; {len(withdraw)} dishes below {int(MIN_COVERAGE * 100)}% coverage to withdraw')
    if check:
        sys.exit(1 if sushi or withdraw else 0)
    for f in sushi:
        print(f'  sushi {f["fdc_id"]:>8} {f["gi"]!s:>4} -> {SUSHI}  {f["name"][:60]}')
        f['gi'], f['gi_basis'], f['gi_level'] = SUSHI, SUSHI_BASIS, 3
    for f, c in withdraw:
        f['gi'], f['gi_level'] = None, 5
        f['gi_basis'] = NO_GI.format(pct=round(c * 100), min=int(MIN_COVERAGE * 100))
    open(fb.PATH, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False))
    print('wrote', fb.PATH)


if __name__ == '__main__':
    main()
