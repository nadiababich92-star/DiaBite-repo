"""
Correct the glycemic index of the bread family in foods_usda.json, and recompute the dishes made with it.

Why (19 November 2026): a reader found whole wheat toast at GI 96 and "Turkey sandwich on white" at GI 36. Both were mistakes of the
GI matcher in build_foods.py, which matches a USDA food to a table entry by its words:

  - "Bread, white" (SR 174924, survey 2707598) took a bread-volume study (38) and a gluten-free white bread (40);
    the table's own "White bread" has 30 measurements with a median of 72. Every "on white" sandwich is computed from that bread,
    so 54 of 84 of them sat under 50.
  - 17 whole wheat breads took the single non-ISO "Whole wheat bread" entry (96, Canada 2007); DiaBite's whole wheat bread is 71.
  - "Bread, wheat" and "Bread, whole wheat" (47) took a mean over fruit breads.

The catalogue file was built by an earlier version of build_foods.py and a rebuild now differs in 1,135 records that are not these, so this
script does not rebuild: it changes exactly the foods above, and recomputes only the dishes whose own recipe contains one of them, with the
same carbohydrate-weighted mean build_foods.py uses (it reproduces all 1,969 current computed values exactly before any change is made;
the script refuses to go on if it stops doing so).

Needs the three USDA zips unpacked (the SR NDB codes and the survey `input_food.csv`):

    FDC_DIR=<dir with FoodData_Central_survey_food_csv_2024-10-31/<same>/ and FoodData_Central_sr_legacy_food_csv_2018-04/<same>/> \
        python3 data/foods-usda/fix_bread_gi.py [--check]

--check changes nothing and exits 1 if the file still has a value this script would change. Run it again after a change: it finds nothing to do.
"""
import csv, collections, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, 'foods_usda.json')
FDC = os.environ.get('FDC_DIR')
WHITE, WHEAT = 72, 71
DATE = '19 November 2026'

WHITE_BASIS = ('measured value for "White bread" (match 100%, 30 value(s), ISO median); corrected ' + DATE +
               ': the earlier match was to a different bread (a bread-volume study or a gluten-free white bread)')
WHEAT_BASIS = ('equivalent food: DiaBite ingredient "Whole wheat bread" (International Tables of Glycemic Index 2021, GI 71); corrected ' + DATE +
               ': the earlier match was to a single non-ISO measurement (96) or to fruit breads (47)')
RECOMPUTE_NOTE = '; recomputed ' + DATE + ' after a bread in its recipe was corrected'


def load():
    raw = open(PATH, encoding='utf-8').read()
    data = json.loads(raw)
    assert json.dumps(data, ensure_ascii=False) == raw.rstrip('\n'), 'foods_usda.json no longer round-trips; the diff would be noise'
    return data


def components():
    if not FDC:
        sys.exit('set FDC_DIR to the folder holding the unpacked USDA datasets (see the top of this file)')
    survey = f'{FDC}/FoodData_Central_survey_food_csv_2024-10-31/FoodData_Central_survey_food_csv_2024-10-31'
    sr = f'{FDC}/FoodData_Central_sr_legacy_food_csv_2018-04/FoodData_Central_sr_legacy_food_csv_2018-04'
    ndb = {r['NDB_number'].lstrip('0'): r['fdc_id'] for r in csv.DictReader(open(sr + '/sr_legacy_food.csv'))}
    comp = collections.defaultdict(list)
    for r in csv.DictReader(open(survey + '/input_food.csv')):
        if r['gram_weight']:
            comp[r['fdc_id']].append((r['sr_code'].lstrip('0'), float(r['gram_weight'])))
    return ndb, comp


def direct_corrections(foods):
    """fdc_id -> (new GI, new basis). Only the foods named in the header."""
    out = {}
    for f in foods:
        k, b = str(f['fdc_id']), f.get('gi_basis') or ''
        if k in ('174924', '2707598'):
            out[k] = (WHITE, WHITE_BASIS)
        elif f['gi'] == 96 and '"Whole wheat bread" (match 100%' in b:
            out[k] = (WHEAT, WHEAT_BASIS)
        elif k in ('172686', '2707709'):
            out[k] = (WHEAT, WHEAT_BASIS)
    return out


def computed(dish, gi_of, levels, byf, ndb, comp):
    num = den = unres = 0.0
    for code, grams in comp.get(dish, []):
        src = byf.get(ndb.get(code, ''))
        if not src:
            continue
        carb = src['net_carbs'] * grams / 100.0
        if carb <= 0:
            continue
        gi = gi_of(src)
        if gi is not None and src.get('gi_level') in levels:
            num += gi * carb
            den += carb
        else:
            unres += carb
    tot = den + unres
    return round(num / den) if den > 0 and tot > 0 and den / tot >= 0.6 else None


def main():
    check = '--check' in sys.argv
    data = load()
    foods = data['foods']
    byf = {str(f['fdc_id']): f for f in foods}
    ndb, comp = components()
    dishes = [f for f in foods if f['dataset'] == 'survey_fndds' and 'ingredient breakdown' in (f.get('gi_basis') or '')]
    levels = lambda f: (1, 2, 3, 4) if 'estimated at level 4' in f['gi_basis'] else (1, 2, 3)

    # The method must reproduce today's computed values before it is allowed to change any.
    off = [f for f in dishes if computed(str(f['fdc_id']), lambda s: s['gi'], levels(f), byf, ndb, comp) != f['gi']]
    # (after a first run the dishes are consistent with the corrected breads, so the same test holds)
    if off:
        sys.exit(f'the recompute no longer reproduces {len(off)} of {len(dishes)} computed dishes (first: {off[0]["name"]}); not changing anything')

    direct = {k: v for k, v in direct_corrections(foods).items() if (byf[k]['gi'], byf[k]['gi_basis']) != v}
    corrected_gi = lambda s: direct[str(s['fdc_id'])][0] if str(s['fdc_id']) in direct else s['gi']
    changed = {}
    for f in dishes:
        g = computed(str(f['fdc_id']), corrected_gi, levels(f), byf, ndb, comp)
        if g is not None and g != f['gi']:
            changed[str(f['fdc_id'])] = g
    print(f'{len(dishes)} computed dishes reproduced exactly; {len(direct)} foods to correct, {len(changed)} dishes to recompute')
    if check:
        sys.exit(1 if direct or changed else 0)
    for k, (gi, basis) in direct.items():
        byf[k]['gi'], byf[k]['gi_basis'] = gi, basis
    for k, gi in changed.items():
        byf[k]['gi'] = gi
        if RECOMPUTE_NOTE not in byf[k]['gi_basis']:
            byf[k]['gi_basis'] = byf[k]['gi_basis'] + RECOMPUTE_NOTE
    open(PATH, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False))
    print('wrote', PATH)


if __name__ == '__main__':
    main()
