#!/usr/bin/env python3
"""
A dry run for a batch of recipes that is not in the database yet.

    python3 data/recipes-db/preview_batch.py data/recipes-db/drafts/*.jsonl

It prices each draft exactly as build.py does (the same ingredient table, the same carbohydrate-weighted
glycemic index, the same glycemic load), prints a table, and flags what a person should look at before the
batch is added: an ingredient that is not in the table, a name that is already taken, a dish that is too
light or too heavy for a serving, a heavy glycemic load, a serving that is mostly one thing. It writes
nothing. Numbers come from the table; this script only multiplies.
"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from ingredients import ING
from gi_sources import GI_SOURCE

HERE = os.path.dirname(__file__)
files = sys.argv[1:] or sorted(glob.glob(os.path.join(HERE, 'drafts', '*.jsonl')))
existing = [json.loads(l)['name'] for f in sorted(glob.glob(os.path.join(HERE, 'recipes_*.jsonl'))) for l in open(f) if l.strip()]
norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()
taken = {norm(n) for n in existing}

rows, problems = [], []
seen = set()
for f in files:
    for n, line in enumerate(open(f), 1):
        if not line.strip():
            continue
        r = json.loads(line)
        where = f"{os.path.basename(f)}:{n} {r['name']}"
        if norm(r['name']) in taken: problems.append(f'{where}: the name is already in the database')
        if norm(r['name']) in seen: problems.append(f'{where}: the name is in the batch twice')
        seen.add(norm(r['name']))
        for key in ('name', 'cat', 'cuisine', 'servings', 'prep', 'cook', 'ing', 'steps'):
            if key not in r: problems.append(f'{where}: missing {key}')
        tot = dict(kcal=0.0, protein=0.0, fat=0.0, carbs=0.0, fiber=0.0)
        gi_num = avail_total = measured = 0.0
        biggest = 0.0
        for it in r['ing']:
            key, grams = it[0], float(it[1])
            if key not in ING:
                problems.append(f'{where}: ingredient "{key}" is not in the table'); continue
            name, kcal, p, fat, c, fib, gi, group = ING[key]
            k = grams / 100.0
            tot['kcal'] += kcal * k; tot['protein'] += p * k; tot['fat'] += fat * k; tot['carbs'] += c * k; tot['fiber'] += fib * k
            avail = max(0.0, (c - fib) * k)
            gi_num += gi * avail; avail_total += avail
            if GI_SOURCE.get(key, {}).get('confidence') in ('high', 'medium'): measured += avail
            biggest = max(biggest, grams)
        s = max(1, int(r['servings']))
        per = {k: v / s for k, v in tot.items()}
        net = max(0.0, per['carbs'] - per['fiber'])
        gi = round(gi_num / avail_total) if avail_total > 0.5 else 0
        gl = round(gi * net / 100, 1)
        share = round(100 * measured / avail_total) if avail_total > 0.5 else 100
        LIGHT = r['cat'] in ('Side Dish', 'Snack & Appetizer', 'Drinks & Smoothies', 'Dessert')
        if not (60 if LIGHT else 150) <= per['kcal'] <= 750: problems.append(f"{where}: {per['kcal']:.0f} kcal a serving")
        if gl > 18: problems.append(f'{where}: glycemic load {gl} a serving')
        if per['protein'] < 8 and not LIGHT and r['cat'] != 'Salad': problems.append(f"{where}: only {per['protein']:.0f} g protein")
        if not (1 if LIGHT else 3) <= len(r['steps']) <= 8: problems.append(f"{where}: {len(r['steps'])} steps")
        if share < 60 and net > 10: problems.append(f'{where}: only {share}% of its carbohydrate has a measured GI')
        rows.append((r['cat'], r['name'], s, round(per['kcal']), round(per['protein']), round(net, 1), gi, gl, share))

rows.sort()
print(f"{'category':<20} {'dish':<52} {'srv':>3} {'kcal':>5} {'prot':>5} {'net C':>6} {'GI':>3} {'GL':>5} {'meas%':>5}")
for c, n, s, k, p, nc, gi, gl, sh in rows:
    print(f'{c:<20} {n[:52]:<52} {s:>3} {k:>5} {p:>5} {nc:>6} {gi:>3} {gl:>5} {sh:>5}')
print(f'\n{len(rows)} dishes; median {sorted(r[3] for r in rows)[len(rows)//2]} kcal, median GL {sorted(r[7] for r in rows)[len(rows)//2]}')
print('\nFLAGS' if problems else '\nno flags')
for p in problems: print('  -', p)
