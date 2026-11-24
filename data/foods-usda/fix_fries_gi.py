"""
Give restaurant and fast-food french fries a glycemic index, as the other fix_*_gi.py scripts correct one.

Why (24 November 2026): "fries" counted as "Potato, french fries, from fresh, fried" (18.5 g carbohydrate per 100 g), about half
of what USDA measures for fast-food fries (41.4 g) and restaurant fries (37.2 g). Those two records had no glycemic index, so a
meal with them could only be carbohydrate-only. The owner chose to count them with the index the catalogue already uses for
french fries: 78, computed from the USDA ingredient breakdown of "Potato, french fries, from fresh, fried" (fdc 2709458). Same
food, fried the same way; approximate, and labelled so. No dish is recomputed: no computed dish lists these two as an ingredient.

    python3 data/foods-usda/fix_fries_gi.py [--check]

--check changes nothing and exits 1 if the file still has a value this script would change.
"""
import json, os, sys

DATE = '24 November 2026'
GI = 78
TARGETS = ('2709461', '2709462')  # Potato, french fries, fast food; Potato, french fries, restaurant
BASIS = ('equivalent food: Potato, french fries, from fresh, fried (fdc 2709458), GI 78 from its own USDA ingredient breakdown; '
         'assigned ' + DATE + ' by the owner\'s decision so restaurant fries are counted at their measured carbohydrate — approximate')
PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'foods_usda.json')


def main():
    check = '--check' in sys.argv
    raw = open(PATH, encoding='utf-8').read(); data = json.loads(raw)
    assert json.dumps(data, ensure_ascii=False) == raw.rstrip('\n'), 'foods_usda.json no longer round-trips; the diff would be noise'
    byf = {str(f['fdc_id']): f for f in data['foods']}
    todo = [k for k in TARGETS if byf[k].get('gi') != GI]
    for k in todo:
        print(f"{byf[k]['name']}: gi {byf[k].get('gi')} -> {GI}")
    if check:
        sys.exit(1 if todo else 0)
    for k in todo:
        f = byf[k]
        f['gi'] = GI; f['gi_level'] = 4; f['gi_basis'] = BASIS
    if todo:
        open(PATH, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False))
    print(f'{len(todo)} changed')


if __name__ == '__main__':
    main()
