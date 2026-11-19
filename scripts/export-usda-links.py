#!/usr/bin/env python3
"""
One table of how DiaBite's own foods are tied to USDA records: data/recipes-db/usda-links.csv.

    python3 scripts/export-usda-links.py

Rows: the 364 curated ingredients and the 86 everyday foods. For each, which USDA record (FoodData Central id) its household measures
come from, if any, and how well that record agrees with ours.

  status "applied"    the food is in data/recipes-db/portion_mapping.json: the engine uses that record's measures ("1 cup") today.
  status "candidate"  not applied. The closest USDA record by name and nutrients, shown so it can be read; nothing uses it.
  status "none"       no record with both a similar name and similar nutrients.

`auto` is "yes" when a rule accepts the candidate without a person: distance 0.25 or less, 60% of our name's words found, and no modifier
word (sweet, juice, milk, dried, canned...) in the USDA name that ours lacks. `decision` ("yes", "no", blank) is the owner's reading and is
carried over by `key` when the table is rewritten; `use_fdc_id` names a different USDA record than the candidate when she chose it herself. `scripts/apply-portion-links.py` is the only thing that writes portion_mapping.json.

`distance` is how far the nutrients are (energy, protein, fat, carbohydrate; 0 is identical) and `name_overlap` the share of our name's
words found in the USDA name. A low distance with a high overlap is a match you can trust; a candidate with a high distance (a
sweet potato offered for a potato) is the reason nothing is applied without a person reading it. It only reads files; it writes the CSV.
"""
import csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
STOP = {'and', 'or', 'with', 'the', 'a', 'of', 'in', 'without', 'salt', 'added', 'drained', 'all', 'types', 'from', 'to', 'for'}
SYN = {'boiled': 'cooked', 'roasted': 'cooked', 'baked': 'cooked', 'steamed': 'cooked', 'grilled': 'cooked', 'fried': 'cooked', 'skinless': '', 'boneless': ''}
MEASURE = re.compile(r'^(?:1 )?(cup|tablespoon|tbsp|teaspoon|tsp|fl oz|oz|slice|piece|medium|small|large)$', re.I)


# A port of `readPortion` in server/foods.ts, enough to tell whether a USDA table has a usable household row. (The engine's reading is the
# reference; this only decides which records are worth offering.)
WHOLE_WORDS = {'regular', 'whole', 'fruit', 'item', 'each'}
UNIT_RE = re.compile(r'^(cup|tablespoon|tbsp|teaspoon|tsp|fl oz|oz|lb|slice|piece|medium|small|large)\b(.*)$')
SLICE_RE = re.compile(r'^(medium or regular|large or thick|small or thin/very thin) slice\b(.*)$')


def stem(w):
    w = w.lower()
    return re.sub(r's$', '', re.sub(r'ies$', 'y', w))


def read_portion(label, grams, record_name):
    """Returns (unit, qualifier) or None."""
    if not grams or grams <= 0: return None
    raw = str(label).strip()
    m = re.match(r'^(\d+(?:\.\d+)?(?:/\d+)?)\s+(.*)$', raw)
    rest = (m.group(2) if m else raw).strip()
    if m and (('/' in m.group(1)) or float(m.group(1)) != 1): return None
    low = rest.lower()
    def qual(r):
        r = r.strip().lower()
        r = re.sub(r'\((?:8 fl oz|nfs|yield after cooking)\)', ' ', r)
        r = re.sub(r'^,?\s*nfs\b', ' ', r)
        r = re.sub(r'^,\s*', ' ', r)
        if re.search(r'\(1 nlea serving\)', r): return 'nlea'
        if re.search(r'\((?:no|with) ice\)', r): return 'ice'
        return re.sub(r'\s+', ' ', re.sub(r'[()]', ' ', r)).strip()
    def plausible(u):
        return not ((u == 'oz' and not 27 <= grams <= 29.5) or (u == 'fl oz' and not 26 <= grams <= 34))
    mm = SLICE_RE.match(low)
    if mm: return ('slice', qual(mm.group(2)))
    # as in server/foods.ts readPortion (19 November): a bacon slice, a pizza piece, a fast food order size
    mm = re.match(r'^(small|medium|large|thin|thick)(?: or \w+)? slice\b(.*)$', low)
    if mm: return ('slice', qual(mm.group(2)))
    mm = re.match(r'^piece,? (small|medium|large) pizza\b(.*)$', low)
    if mm: return ('slice', qual(mm.group(2)))
    mm = re.match(r"^(small|medium|large|kid'?s?) (?:fast food )?(?:order|serving)\b(.*)$", low)
    if mm and re.search(r'fast food|order', low): return ('small' if mm.group(1).startswith('kid') else mm.group(1), qual(mm.group(2)))
    mm = UNIT_RE.match(low)
    if mm:
        u = {'tablespoon': 'tbsp', 'teaspoon': 'tsp'}.get(mm.group(1), mm.group(1))
        q = qual(mm.group(2))
        if q == 'cooked' and re.search(r'\bcooked\b', record_name, re.I): q = ''   # as in server/foods.ts readPortion
        return (u, q) if plausible(u) else None
    mm = re.match(r'^(\w+)$', low)
    if mm and grams <= 600 and (mm.group(1) in WHOLE_WORDS or stem(mm.group(1)) in {stem(w) for w in re.split(r'[^a-z]+', record_name.lower()) if w}):
        return ('whole', '')
    return None


def usable(portions, record_name):
    out = []
    for p in portions or []:
        r = read_portion(p['label'], p['grams'], record_name)
        if r and r[1] == '':
            out.append({'label': p['label'], 'grams': p['grams'], 'unit': r[0]})
    return out


NEUTRAL = {'raw', 'fresh', 'year', 'round', 'average', 'whole', 'nfs', 'ns', 'as', 'type', 'plain', 'with', 'skin', 'peel', 'eaten', 'not', 'cooking', 'method'}
MAX_EXTRA_WORDS = 2     # more unexplained words than this and the USDA record is a variety or a different preparation, not our food
DENY = {'sweet', 'cooked', 'juice', 'milk', 'powder', 'dried', 'dry', 'canned', 'frozen', 'babyfood', 'baby', 'toddler', 'infant', 'flour', 'oil', 'sauce', 'soup',
        'broth', 'fried', 'breaded', 'pickled', 'jam', 'jelly', 'syrup', 'nectar', 'smoothie', 'formula', 'bar', 'chips', 'cereal', 'snack'}


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
pool = [{'r': r, 'toks': toks(r['name'])} for r in usda if r['per100'].get('kcal') is not None]   # survey, SR Legacy and Foundation records
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
            ms = usable(c['r'].get('portions'), c['r']['name'])
            if not ms: continue                     # a candidate is only worth offering if it has a household row the engine can use
            d = dist(it['per100'], {k: (c['r']['per100'].get(k) or 0) for k in KEYS})
            score = d - 0.5 * ns
            if best is None or score < best[0]: best = (score, d, ns, c['r'], ms)
        if best is None:
            row.update(status='none', fdc_id='', usda_name='', usda_dataset='', distance='', name_overlap='', measures='', accepted_by='')
        else:
            _, d, ns, rec, ms = best
            extra = (toks(rec['name']) - t) & DENY      # a modifier the USDA name has and ours lacks: a different food
            unexplained = {w for w in (toks(re.sub(r'\(.*?\)', ' ', rec['name'])) - t) if w not in NEUTRAL}
            auto = 'yes' if (d <= 0.25 and ns >= 0.6 and not extra and len(unexplained) <= MAX_EXTRA_WORDS) else ''
            row.update(status='candidate', fdc_id=rec['fdc_id'], usda_name=rec['name'], usda_dataset=rec['dataset'], distance=round(d, 3), name_overlap=round(ns, 2),
                       measures=measures_text([{'label': m['label'], 'grams': m['grams']} for m in ms]), accepted_by='', auto=auto)
    rows.append(row)

# The owner's reading survives a rewrite: decisions are carried over by key; a food whose best candidate changed since she decided
# loses the decision and says which record it was.
out = ROOT / 'data/recipes-db/usda-links.csv'
prev = {}
if out.exists():
    for r in csv.DictReader(open(out, newline='', encoding='utf-8-sig')):
        prev[r['key']] = r
for row in rows:
    row.setdefault('auto', '')
    p = prev.get(row['key'])
    row['decision'] = ''
    row['use_fdc_id'] = ''
    row['changed_since_decision'] = ''
    if p and p.get('decision') and p.get('use_fdc_id'):
        row['decision'] = p['decision']; row['use_fdc_id'] = p['use_fdc_id']      # the owner named the record herself: it is kept as she wrote it
    elif p and p.get('decision'):
        if str(p.get('fdc_id', '')) == str(row['fdc_id']): row['decision'] = p['decision']
        else: row['changed_since_decision'] = f"was {p.get('fdc_id', '')} {p.get('usda_name', '')[:40]}"

order = {'applied': 0, 'candidate': 1, 'none': 2}
rows.sort(key=lambda r: (order[r['status']], r['kind'], r['our_name'].lower()))
cols = ['status', 'key', 'our_name', 'kind', 'group', 'fdc_id', 'usda_name', 'usda_dataset', 'distance', 'name_overlap', 'auto', 'decision', 'use_fdc_id', 'changed_since_decision',
        'measures', 'accepted_by', 'our_kcal', 'our_carbs', 'our_protein', 'our_fat']
with open(out, 'w', newline='', encoding='utf-8-sig') as f:   # BOM so Excel reads the UTF-8
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)
n = {s: sum(1 for r in rows if r['status'] == s) for s in order}
print(f"{len(rows)} foods: {n}; candidates the rule accepts: {sum(1 for r in rows if r['status'] == 'candidate' and r['auto'] == 'yes')}  ->  {out.relative_to(ROOT)}")
