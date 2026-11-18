#!/usr/bin/env python3
"""
One table of how DiaBite's own foods are tied to USDA records: data/recipes-db/usda-links.csv.

    python3 scripts/export-usda-links.py

Rows: the 364 curated ingredients and the 86 everyday foods. For each, which USDA record (FoodData Central id) its household measures
come from, if any, and how well that record agrees with ours.

  status "applied"    the food is in data/recipes-db/portion_mapping.json: the engine uses that record's measures ("1 cup") today.
  status "candidate"  not applied. The closest USDA record by name and nutrients, shown so it can be read; nothing uses it.
  status "none"       no record with both a similar name and similar nutrients.

`distance` is how far the nutrients are (energy, protein, fat, carbohydrate; 0 is identical) and `name_overlap` the share of our name's
words found in the USDA name. A low distance with a high overlap is a match you can trust; a candidate with a high distance (a
sweet potato offered for a potato) is the reason nothing is applied without a person reading it. It only reads files; it writes the CSV.
"""
import csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
STOP = {'and', 'or', 'with', 'the', 'a', 'of', 'in', 'without', 'salt', 'added', 'drained', 'all', 'types', 'from', 'to', 'for'}
SYN = {'boiled': 'cooked', 'roasted': 'cooked', 'baked': 'cooked', 'steamed': 'cooked', 'grilled': 'cooked', 'fried': 'cooked', 'skinless': '', 'boneless': ''}
MEASURE = re.compile(r'^(?:1 )?(cup|tablespoon|tbsp|teaspoon|tsp|fl oz|oz|slice|piece|medium|small|large)$', re.I)


def toks(name):
    out = set()
    for w in re.findall(r'[a-z]+', name.lower()):
        w = SYN.get(w, w)
        if not w or w in STOP:
            continue
        if len(w) > 3 and w.endswith('ies'): w = w[:-3] + 'y'
        elif len(w) > 3 and w.endswith('s') and not w.endswith('ss'): w = w[:-1]
        out.add(w)
    return out


KEYS = ('kcal', 'protein', 'fat', 'carbs')


def dist(a, b):
    return (abs(a['kcal'] - b['kcal']) / max(40, a['kcal']) + abs(a['protein'] - b['protein']) / max(3, a['protein'])
            + abs(a['fat'] - b['fat']) / max(3, a['fat']) + abs(a['carbs'] - b['carbs']) / max(5, a['carbs']))


usda = json.load(open(ROOT / 'data/foods-usda/foods_usda.json'))['foods']
by_fdc = {r['fdc_id']: r for r in usda}
pool = [{'r': r, 'toks': toks(r['name'])} for r in usda if r['dataset'] in ('sr_legacy', 'foundation') and r['per100'].get('kcal') is not None]
mapped = json.load(open(ROOT / 'data/recipes-db/portion_mapping.json'))['foods']

items = []
for i in json.load(open(ROOT / 'data/recipes-db/ingredients.json')):
    items.append({'key': f"ing:{i['id']}", 'name': i['name'], 'kind': 'curated ingredient', 'group': i.get('group', ''), 'per100': {k: i['per100'].get(k, 0) or 0 for k in KEYS}})
src = (ROOT / 'src/data/foods.ts').read_text(encoding='utf-8')
for m in re.finditer(r"id: '([^']+)', name: '([^']+)',\s*category:\s*'([^']+)'.*?per100: \{ kcal: ([\d.]+),\s*carbs: ([\d.]+),\s*fiber: [\d.]+,\s*protein: ([\d.]+),\s*fat: ([\d.]+)", src):
    items.append({'key': f"seed:{m.group(1)}", 'name': m.group(2), 'kind': 'everyday food', 'group': m.group(3),
                  'per100': {'kcal': float(m.group(4)), 'carbs': float(m.group(5)), 'protein': float(m.group(6)), 'fat': float(m.group(7))}})


def measures_text(ms):
    return '; '.join(f"{m['label']} {m['grams']:g} g" for m in ms)


rows = []
for it in items:
    row = {'key': it['key'], 'our_name': it['name'], 'kind': it['kind'], 'group': it['group'],
           'our_kcal': it['per100']['kcal'], 'our_carbs': it['per100']['carbs'], 'our_protein': it['per100']['protein'], 'our_fat': it['per100']['fat']}
    t = toks(it['name'])
    if it['key'] in mapped:
        v = mapped[it['key']]
        rec = by_fdc.get(v['fdc_id'])
        d = ''
        ns = ''
        if rec and rec['per100'].get('kcal') is not None:
            d = round(dist(it['per100'], {k: (rec['per100'].get(k) or 0) for k in KEYS}), 3)
        if t and rec:
            ns = round(len(t & toks(rec['name'])) / len(t), 2)
        row.update(status='applied', fdc_id=v['fdc_id'], usda_name=v['usda_name'], usda_dataset=rec['dataset'] if rec else '', distance=d, name_overlap=ns,
                   measures=measures_text(v['measures']), accepted_by=v.get('accepted_by', 'rule: distance <= 0.10 and name overlap >= 0.6'))
    else:
        best = None
        for c in pool:
            if not t: break
            ns = len(t & c['toks']) / len(t)
            if ns < 0.34: continue
            d = dist(it['per100'], {k: (c['r']['per100'].get(k) or 0) for k in KEYS})
            score = d - 0.5 * ns
            if best is None or score < best[0]: best = (score, d, ns, c['r'])
        if best is None:
            row.update(status='none', fdc_id='', usda_name='', usda_dataset='', distance='', name_overlap='', measures='', accepted_by='')
        else:
            _, d, ns, rec = best
            ms = [{'label': p['label'], 'grams': p['grams']} for p in (rec.get('portions') or []) if MEASURE.match(str(p['label']).strip()) and p['grams'] > 0]
            row.update(status='candidate', fdc_id=rec['fdc_id'], usda_name=rec['name'], usda_dataset=rec['dataset'], distance=round(d, 3), name_overlap=round(ns, 2),
                       measures=measures_text(ms), accepted_by='')
    rows.append(row)

order = {'applied': 0, 'candidate': 1, 'none': 2}
rows.sort(key=lambda r: (order[r['status']], r['kind'], r['our_name'].lower()))
cols = ['status', 'key', 'our_name', 'kind', 'group', 'fdc_id', 'usda_name', 'usda_dataset', 'distance', 'name_overlap', 'measures', 'accepted_by',
        'our_kcal', 'our_carbs', 'our_protein', 'our_fat']
out = ROOT / 'data/recipes-db/usda-links.csv'
with open(out, 'w', newline='', encoding='utf-8-sig') as f:   # BOM so Excel reads the UTF-8
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)
n = {s: sum(1 for r in rows if r['status'] == s) for s in order}
print(f"{len(rows)} foods: {n}  ->  {out.relative_to(ROOT)}")
