"""
Correct the glycemic index of plain cooked pasta, plain cooked white rice and flour tortilla in foods_usda.json, and recompute the
dishes made with them. The same method as fix_bread_gi.py (read its header), which this script imports.

Why (20 November 2026): auditing the USDA survey dishes proposed for the menu found staples whose GI came from a wrong match of the
matcher in build_foods.py:

  - plain cooked pasta (survey 2708357; SR 168928, 172014) took "Barley pasta, average carbohydrate portion" (71); SR 169737, 169751
    and the dry SR 169736 took a protein-enriched brand (28). DiaBite's own white pasta, cooked al dente, is 49.
  - plain cooked white rice took basmati (50, survey), quick-cooking long grain (47, SR), or a butter-rice measurement (79).
    DiaBite's white rice is 73 and the table's "White rice" (ISO, 2 values) is 72, which the rice-with-vegetables dishes already use.
  - "Tortilla, flour" (survey 2707824) took a barley tortilla (52). DiaBite's flour tortilla is 34.

Not changed, on purpose: brown rice (78 is the ISO-compliant measurement for "Brown rice", match 100%, not a mismatch), parboiled,
short-grain and glutinous rice (their own measurements), wild-rice mixes, whole wheat and gluten-free pasta, and potato skin.

    FDC_DIR=<same as for fix_bread_gi.py> python3 data/foods-usda/fix_staple_gi.py [--check]

--check changes nothing and exits 1 if the file still has a value this script would change.
"""
import os, sys

import fix_bread_gi as fb

DATE = '20 November 2026'
PASTA, RICE, TORTILLA = 49, 73, 34

# fdc_id -> (new GI, what DiaBite's own record is)
TARGETS = {}
for k in ('2708357', '168928', '172014', '169737', '169751', '169736'):
    TARGETS[k] = (PASTA, 'White pasta, cooked al dente')
for k in ('2708403', '2708405', '2708406', '2708407', '2708408', '2710788',
          '168878', '168880', '168930', '168935', '169753', '169757'):
    TARGETS[k] = (RICE, 'White rice, cooked')
TARGETS['2707824'] = (TORTILLA, 'Flour tortilla, 8-inch')

RECOMPUTE_NOTE = '; recomputed ' + DATE + ' after a staple in its recipe was corrected'


def basis(own):
    return ('equivalent food: DiaBite ingredient "' + own + '" (match 100%, International Tables of Glycemic Index 2021); corrected ' + DATE +
            ': the earlier match was to a different food (' + 'barley, a protein-enriched brand, basmati, quick-cooking rice or a butter-rice measurement' + ')')


def main():
    check = '--check' in sys.argv
    data = fb.load()
    foods = data['foods']
    byf = {str(f['fdc_id']): f for f in foods}
    ndb, comp = fb.components()
    missing = [k for k in TARGETS if k not in byf]
    if missing:
        sys.exit(f'not in the file: {missing}')
    dishes = [f for f in foods if f['dataset'] == 'survey_fndds' and 'ingredient breakdown' in (f.get('gi_basis') or '')]
    levels = lambda f: (1, 2, 3, 4) if 'estimated at level 4' in f['gi_basis'] else (1, 2, 3)

    off = [f for f in dishes if fb.computed(str(f['fdc_id']), lambda s: s['gi'], levels(f), byf, ndb, comp) != f['gi']]
    if off:
        sys.exit(f'the recompute no longer reproduces {len(off)} of {len(dishes)} computed dishes (first: {off[0]["name"]}); not changing anything')

    direct = {k: (gi, basis(own)) for k, (gi, own) in TARGETS.items() if byf[k]['gi'] != gi}
    corrected_gi = lambda s: direct[str(s['fdc_id'])][0] if str(s['fdc_id']) in direct else s['gi']
    changed = {}
    for f in dishes:
        g = fb.computed(str(f['fdc_id']), corrected_gi, levels(f), byf, ndb, comp)
        if g is not None and g != f['gi']:
            changed[str(f['fdc_id'])] = g
    print(f'{len(dishes)} computed dishes reproduced exactly; {len(direct)} foods to correct, {len(changed)} dishes to recompute')
    if check:
        sys.exit(1 if direct or changed else 0)
    log = []
    for k, (gi, b) in direct.items():
        log.append((k, byf[k]['name'], byf[k]['gi'], gi))
        byf[k]['gi'], byf[k]['gi_basis'], byf[k]['gi_level'] = gi, b, 3
    for k, gi in changed.items():
        log.append((k, byf[k]['name'], byf[k]['gi'], gi))
        byf[k]['gi'] = gi
        if RECOMPUTE_NOTE not in byf[k]['gi_basis']:
            byf[k]['gi_basis'] = byf[k]['gi_basis'] + RECOMPUTE_NOTE
    open(fb.PATH, 'w', encoding='utf-8').write(__import__('json').dumps(data, ensure_ascii=False))
    print('wrote', fb.PATH)
    for k, n, a, b in log:
        print(f'  {k:>8}  {a!s:>4} -> {b!s:<4} {n[:70]}')


if __name__ == '__main__':
    main()
