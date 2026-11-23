"""
Correct the glycemic index of chocolate syrup (and the drinks computed from it), as the other fix_*_gi.py scripts do.

Why (23 November 2026): "Syrup, NESTLE, chocolate" (SR 170681) and the survey "Chocolate syrup" and "Chocolate syrup, light" matched "Soy-based dairy product
alternatives: tofu-based frozen dessert" at GI 115. Hot chocolate made with non-dairy milk and two iced mochas are computed from that syrup, so they carry 115 too.
The International Tables hold no chocolate syrup; the closest measured foods are sugar-sweetened chocolate drinks prepared with water: Nesquik chocolate 53,
Complete hot chocolate 51, Milo 55 and 52, Ovaltine 50 (all ISO-compliant), median 52. Approximate, and labelled so.

    FDC_DIR=<same as for fix_bread_gi.py> python3 data/foods-usda/fix_syrup_gi.py [--check]

--check changes nothing and exits 1 if the file still has a value this script would change; either way it prints every change it would make.
"""
import json, sys
import fix_bread_gi as fb

DATE = '23 November 2026'
GI = 52
TARGETS = ('2710276', '2710277', '170681')
BASIS = ('equivalent food: sugar-sweetened chocolate drinks prepared with water (International Tables of Glycemic Index 2021, ISO: Nesquik chocolate 53, '
         'Complete hot chocolate 51, Milo 55 and 52, Ovaltine 50; median 52); corrected ' + DATE + ': the earlier match was to a soy-based frozen dessert (115) — approximate')
NOTE = '; recomputed ' + DATE + ' after a chocolate syrup in its recipe was corrected'


def main():
    check = '--check' in sys.argv
    data = fb.load(); foods = data['foods']
    byf = {str(f['fdc_id']): f for f in foods}
    ndb, comp = fb.components()
    dishes = [f for f in foods if f['dataset'] == 'survey_fndds' and 'ingredient breakdown' in (f.get('gi_basis') or '')]
    levels = lambda f: (1, 2, 3, 4) if 'estimated at level 4' in f['gi_basis'] else (1, 2, 3)
    off = [f for f in dishes if fb.computed(str(f['fdc_id']), lambda s: s['gi'], levels(f), byf, ndb, comp) != f['gi']]
    if off:
        sys.exit(f'the recompute no longer reproduces {len(off)} of {len(dishes)} computed dishes (first: {off[0]["name"]}); not changing anything')
    direct = [k for k in TARGETS if byf[k]['gi'] != GI]
    corrected = lambda s: GI if str(s['fdc_id']) in TARGETS else s['gi']
    changed = {}
    for f in dishes:
        g = fb.computed(str(f['fdc_id']), corrected, levels(f), byf, ndb, comp)
        if g is not None and g != f['gi']:
            changed[str(f['fdc_id'])] = g
    print(f'{len(dishes)} computed dishes reproduced exactly; {len(direct)} foods to correct, {len(changed)} dishes to recompute')
    for k in direct: print(f'  food {k:>8}  {byf[k]["gi"]} -> {GI}  {byf[k]["name"][:60]}')
    for k, g in changed.items(): print(f'  dish {k:>8}  {byf[k]["gi"]} -> {g}  {byf[k]["name"][:60]}')
    if check:
        sys.exit(1 if direct or changed else 0)
    for k in direct:
        byf[k]['gi'], byf[k]['gi_basis'], byf[k]['gi_level'] = GI, BASIS, 3
    for k, g in changed.items():
        byf[k]['gi'] = g
        if NOTE not in byf[k]['gi_basis']: byf[k]['gi_basis'] += NOTE
    open(fb.PATH, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False))
    print('wrote', fb.PATH)


if __name__ == '__main__':
    main()
