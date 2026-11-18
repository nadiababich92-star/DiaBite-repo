#!/usr/bin/env python3
"""
DRAFTS ONLY (18 November 2026): scripts/apply-portion-links.py is the writer of portion_mapping.json.
Draft a mapping from DiaBite's curated ingredients (364) and everyday foods (86) to USDA SR Legacy / Foundation records, so each can carry
that record's table of household measures ("1 cup", "1 slice", "1 medium"). Nothing is applied: this writes a draft for the owner to review.

The curated values were taken from USDA, so a record whose nutrients also agree (energy, protein, fat, carbohydrate) and whose name shares
the ingredient's words is very likely the same food; the nutrient distance is the safety check, not the name alone.

  python3 scripts/map-portions.py        ->  data/recipes-db/portion_mapping_draft.json  and  docs/ingredient-portion-mapping-draft.md
"""
import json, re, collections, pathlib

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


def dist(a, b):
    return (abs(a['kcal'] - b['kcal']) / max(40, a['kcal']) + abs(a['protein'] - b['protein']) / max(3, a['protein'])
            + abs(a['fat'] - b['fat']) / max(3, a['fat']) + abs(a['carbs'] - b['carbs']) / max(5, a['carbs']))


def clean_measures(portions):
    return [p for p in portions or [] if MEASURE.match(str(p['label']).strip()) and p['grams'] > 0]


foods = json.load(open(ROOT / 'data/foods-usda/foods_usda.json'))['foods']
pool = []
for r in foods:
    if r['dataset'] not in ('sr_legacy', 'foundation'): continue
    p = r['per100']
    if p.get('kcal') is None: continue
    pool.append({'fdc': r['fdc_id'], 'name': r['name'], 'dataset': r['dataset'], 'per100': p, 'toks': toks(r['name']), 'measures': clean_measures(r.get('portions')), 'portions': r.get('portions') or []})

items = []
for i in json.load(open(ROOT / 'data/recipes-db/ingredients.json')):
    p = i['per100']; items.append({'key': f"ing:{i['id']}", 'name': i['name'], 'per100': {k: p.get(k, 0) or 0 for k in ('kcal', 'protein', 'fat', 'carbs')}, 'kind': 'ingredient'})
src = (ROOT / 'src/data/foods.ts').read_text()
for m in re.finditer(r"id: '([^']+)', name: '([^']+)'.*?per100: \{ kcal: ([\d.]+),\s*carbs: ([\d.]+),\s*fiber: [\d.]+,\s*protein: ([\d.]+),\s*fat: ([\d.]+)", src):
    items.append({'key': f"seed:{m.group(1)}", 'name': m.group(2), 'per100': {'kcal': float(m.group(3)), 'carbs': float(m.group(4)), 'protein': float(m.group(5)), 'fat': float(m.group(6))}, 'kind': 'everyday'})

out = {}
for it in items:
    t = toks(it['name'])
    best = None
    for c in pool:
        if not t: break
        ns = len(t & c['toks']) / len(t)
        if ns < 0.34: continue
        d = dist(it['per100'], {k: (c['per100'].get(k) or 0) for k in ('kcal', 'protein', 'fat', 'carbs')})
        score = d - 0.5 * ns
        if best is None or score < best[0]: best = (score, d, ns, c)
    if best is None:
        out[it['key']] = {'name': it['name'], 'confidence': 'none'}; continue
    _, d, ns, c = best
    conf = 'high' if d <= 0.25 and ns >= 0.5 else 'medium' if d <= 0.5 else 'low'
    if not c['measures']: conf = conf + ' (no usable measure)'
    out[it['key']] = {'name': it['name'], 'kind': it['kind'], 'confidence': conf, 'fdc_id': c['fdc'], 'usda_name': c['name'], 'distance': round(d, 3), 'name_overlap': round(ns, 2),
                      'measures': [{'label': m['label'], 'grams': m['grams']} for m in c['measures']]}

(ROOT / 'data/recipes-db/portion_mapping_draft.json').write_text(json.dumps(out, indent=1, ensure_ascii=False))
# This script DRAFTS and no longer writes data/recipes-db/portion_mapping.json: it rewrote the file from the draft and would have dropped
# every entry accepted by hand. scripts/apply-portion-links.py (from the owner's decisions in usda-links.csv) is the only writer.
cnt = collections.Counter(v['confidence'].split(' ')[0] for v in out.values())
usable = sum(1 for v in out.values() if v['confidence'] in ('high', 'medium'))
labels = collections.Counter(p['label'] for c in pool for p in c['portions']).most_common(14)
print('items', len(out), dict(cnt), '| high or medium with a usable measure:', usable)
print('top SR labels:', labels)
lines = ['# Draft: household measures for curated ingredients and everyday foods', '', f'Made by `scripts/map-portions.py`. {len(out)} items; {dict(cnt)}. Nothing is applied until the owner has read this.', '',
         'Name, the USDA record, how far its nutrients are (distance; 0 = identical) and the measures it would add. **High** means nutrients and name agree; read **medium** and **low** with care.', '']
for lvl in ('medium', 'low', 'none'):
    rows = [(k, v) for k, v in out.items() if v['confidence'].split(' ')[0] == lvl]
    if not rows: continue
    lines += [f'## {lvl} ({len(rows)})', '']
    for k, v in sorted(rows, key=lambda kv: kv[1].get('distance', 9)):
        ms = ', '.join(f"{m['label']} {m['grams']:g} g" for m in v.get('measures', [])[:4]) if v.get('measures') else ''
        lines.append(f"- {v['name']} ({k}) → {v.get('usda_name', '—')} [{v.get('fdc_id', '')}] d={v.get('distance', '')}  {ms}")
    lines.append('')
(ROOT / 'docs/ingredient-portion-mapping-draft.md').write_text('\n'.join(lines))
