#!/usr/bin/env python3
"""
Build data/foods-usda/branded_common.json from the USDA FoodData Central
Branded Foods CSV release.

    python3 scripts/build-branded.py /path/to/FoodData_Central_branded_food_csv_YYYY-MM-DD

The list is chosen, not sampled: data/foods-usda/branded_wanted.txt names the
products (every word on a line must appear in the brand and description of a
row), and for each line the single simplest matching US row is kept. A row needs
a serving in grams (or in ml for a drink, taken as grams at 1 g/ml), carbohydrate
and energy; anything else is left out and listed in branded_dropped.txt.

Python rather than TypeScript because the three tables are 0.4, 1.0 and 1.5 GB
of CSV with quoted fields that span lines; the standard csv module reads them
without a dependency. Nothing here ever contacts the network.
"""
import csv, json, re, sys
from collections import defaultdict
from pathlib import Path

csv.field_size_limit(sys.maxsize)
ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if SRC is None or not (SRC / 'branded_food.csv').exists():
    sys.exit('usage: build-branded.py <folder holding branded_food.csv, food.csv, food_nutrient.csv>')

WANTED = ROOT / 'data' / 'foods-usda' / 'branded_wanted.txt'
OUT = ROOT / 'data' / 'foods-usda' / 'branded_common.json'
DROPPED = ROOT / 'data' / 'foods-usda' / 'branded_dropped.txt'
CAP = 2000
NUTRIENTS = {'1008': 'kcal', '2047': 'kcal2', '2048': 'kcal3', '1003': 'protein', '1004': 'fat', '1005': 'carbs', '1079': 'fiber'}
DRINK = re.compile(r'soda|water|juice|drink|beverage|tea|coffee|cola|energy|milk|smoothie|sport', re.I)

def stem(t): return t[:-1] if len(t) > 3 and t.endswith('s') else t
def toks(s): return {stem(t) for t in re.findall(r'[a-z0-9]+', s.lower().replace("'", ''))}

seeds = []
for line in WANTED.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#'):
        t = toks(line)
        if t: seeds.append((line, t))
# index each seed under its longest token: the most selective one
index = defaultdict(list)
for i, (_, t) in enumerate(seeds): index[max(t, key=len)].append(i)

# pass 1: descriptions, then the branded table
desc = {}
with open(SRC / 'food.csv', newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        desc[r['fdc_id']] = r['description']

PER_SEED = 3   # a flavour or two besides the plainest row, each under its own name
best = defaultdict(list)   # seed index -> [(rank tuple, row info)]
dropped = []
with open(SRC / 'branded_food.csv', newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['market_country'] and r['market_country'] != 'United States': continue
        if r['discontinued_date']: continue
        d = desc.get(r['fdc_id'], '')
        text = toks(f"{r['brand_owner']} {r['brand_name']} {r['subbrand_name']} {d}")
        hit = [i for k in text if k in index for i in index[k]]
        if not hit: continue
        try: size = float(r['serving_size'])
        except ValueError: continue
        unit = (r['serving_size_unit'] or '').lower()
        cat = r['branded_food_category'] or ''
        if size <= 0: continue
        if unit in ('g', 'grm'): grams = size
        elif unit in ('ml', 'mlt') and DRINK.search(cat + ' ' + d): grams = size
        else: continue
        for i in set(hit):
            if not seeds[i][1] <= text: continue
            extra = len(text - seeds[i][1])
            rank = (extra, -(len(r['modified_date'] or '') and int(r['modified_date'].replace('-', '') or 0)))
            if True:
                best[i].append((rank, dict(fdc_id=r['fdc_id'], desc=d, brand=r['brand_name'] or r['brand_owner'], grams=grams,
                                      label=r['household_serving_fulltext'] or f'{size:g} {unit}', cat=cat, unit=unit,
                                      published=r['available_date'] or r['modified_date'])))
                best[i] = sorted(best[i], key=lambda x: x[0])[:PER_SEED * 4]
print(f'{len(seeds)} wanted lines, {len(best)} matched', file=sys.stderr)
for i, (line, _) in enumerate(seeds):
    if i not in best: dropped.append(f'no US row with a gram serving: {line}')

# pass 2: five nutrients for the chosen rows only
chosen = {c[1]['fdc_id']: i for i, cs in best.items() for c in cs}
nutr = defaultdict(dict)
with open(SRC / 'food_nutrient.csv', newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['fdc_id'] in chosen and r['nutrient_id'] in NUTRIENTS:
            try: nutr[r['fdc_id']][NUTRIENTS[r['nutrient_id']]] = float(r['amount'])
            except ValueError: pass

def category(cat, d):
    s = f'{cat} {d}'.lower()
    if re.search(r'soda|water|juice|drink|beverage|tea|coffee|cola|energy|smoothie', s): return 'drinks'
    if re.search(r'cookie|candy|chocolate|ice cream|dessert|cake|snack bar|sweet|donut|pastr', s): return 'sweets'
    if re.search(r'cheese|yogurt|milk|dairy|cream', s): return 'dairy'
    if re.search(r'nut|seed|peanut', s): return 'nuts'
    if re.search(r'meat|sausage|chicken|fish|tuna|bacon|beef|pork|turkey', s): return 'protein'
    if re.search(r'oil|butter|margarine|dressing|mayo', s): return 'fats'
    return 'grains'

def pretty(s):
    words = re.sub(r'\s+', ' ', s).strip().lower().split(' ')
    return ' '.join(w if re.search(r'\d', w) or w in ('and', 'of', 'with', 'in', 'a', 'the') else w.capitalize() for w in words)

def clean_name(desc, brand):
    d = re.sub(r'\s+', ' ', desc).strip()
    # "Lemon-lime Zero Sugar Soda, Lemon-lime": the tail repeats the head
    if ',' in d:
        head, _, tail = d.rpartition(',')
        if toks(tail) <= toks(head): d = head.strip()
    b = re.sub(r'\b(the|company|co|inc|llc|corporation|corp|ltd|brands?)\b\.?,?', '', brand, flags=re.I).strip(' ,.')
    if b and not (toks(b) <= toks(d)): d = f'{b} {d}'
    return d

def label_values(fdc_id):
    n = dict(nutr.get(fdc_id, {}))
    kcal = n.pop('kcal', None)
    for k in ('kcal2', 'kcal3'):
        alt = n.pop(k, None)
        if kcal is None and alt is not None: kcal = alt
    if kcal is not None: n['kcal'] = kcal
    return n

records = []
for i, cands in best.items():
    taken = 0
    for _rank, info in cands:
        if taken >= PER_SEED: break
        n = label_values(info['fdc_id'])
        if 'carbs' not in n or 'kcal' not in n:
            dropped.append(f"missing carbohydrate or energy: {info['desc']} ({info['fdc_id']})"); continue
        n.setdefault('fiber', 0.0); n.setdefault('protein', 0.0); n.setdefault('fat', 0.0)
        if n['carbs'] > 100 or n['kcal'] > 900 or n['carbs'] + n['protein'] + n['fat'] > 105 or n['fiber'] > n['carbs']:
            dropped.append(f"implausible label values: {info['desc']} ({info['fdc_id']})"); continue
        liquid = info['unit'] in ('ml', 'mlt')
        records.append({
            'id': f"branded:{info['fdc_id']}", 'fdc_id': int(info['fdc_id']), 'name': pretty(clean_name(info['desc'], info['brand'])),
            'brand': pretty(info['brand']) if info['brand'] else '', 'category': category(info['cat'], info['desc']),
            'per100': {k: round(n[k], 1) for k in ('kcal', 'protein', 'fat', 'carbs', 'fiber')},
            'serving': {'grams': round(info['grams'], 1), 'label': info['label'], **({'ml': True} if liquid else {})},
            'source': 'USDA FoodData Central, Branded Foods (label data supplied by the manufacturer)'
                      + ('; a drink, so 1 ml is taken as 1 g' if liquid else '')
                      + '. Glycemic index: none is published for packaged products.',
            'published': info['published'],
        })
        taken += 1
seen, out = set(), []
for r in sorted(records, key=lambda r: r['id']):
    key = re.sub(r'[^a-z0-9]', '', r['name'].lower())
    if key in seen: dropped.append(f"duplicate name: {r['name']} ({r['fdc_id']})"); continue
    seen.add(key); out.append(r)
out = out[:CAP]
OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
DROPPED.write_text('\n'.join(sorted(dropped)) + '\n')
print(f'wrote {len(out)} records to {OUT.name}; {len(dropped)} lines in {DROPPED.name}', file=sys.stderr)
