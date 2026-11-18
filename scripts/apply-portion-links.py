#!/usr/bin/env python3
"""
Apply the USDA links the owner and the rule accepted to data/recipes-db/portion_mapping.json. This is the ONLY writer of that file.

    python3 scripts/apply-portion-links.py            # applies and prints what it did
    python3 scripts/apply-portion-links.py --dry-run  # prints what it would do, writes nothing

Reads data/recipes-db/usda-links.csv (made by scripts/export-usda-links.py). A row is applied when `decision` is "yes", or when `decision`
is blank and `auto` is "yes" (the rule: close nutrients, our name's words found, no modifier of another food). Never a row with
`decision` "no", never a candidate with neither. `use_fdc_id`, when the owner filled it, names the USDA record to take instead of the
candidate. Entries already in the mapping that carry an `accepted_by` are never rewritten or deleted: if a row would change one, it is
listed under would_change and left alone. (scripts/map-portions.py used to rewrite this file and would have dropped the entries made by hand.)

The measures written are the usable rows of the USDA record, as the engine reads them (server/foods.ts readPortion).
"""
import csv, datetime, json, pathlib, sys, importlib.util

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('links', ROOT / 'scripts' / 'export-usda-links.py')   # reuse its reader of rows, without running it
src = (ROOT / 'scripts' / 'export-usda-links.py').read_text(encoding='utf-8')
head = src[:src.index('usda = json.load')]
ns = {'__file__': str(ROOT / 'scripts' / 'export-usda-links.py')}
exec(compile(head, 'export-usda-links-head', 'exec'), ns)
usable = ns['usable']

dry = '--dry-run' in sys.argv
rows = list(csv.DictReader(open(ROOT / 'data/recipes-db/usda-links.csv', newline='', encoding='utf-8-sig')))
mapping_path = ROOT / 'data/recipes-db/portion_mapping.json'
mapping = json.load(open(mapping_path, encoding='utf-8'))
foods = mapping['foods']
usda = {r['fdc_id']: r for r in json.load(open(ROOT / 'data/foods-usda/foods_usda.json', encoding='utf-8'))['foods']}

today = datetime.date.today().isoformat()
done = {'rule': 0, 'owner': 0}
skipped_no = skipped_blank = unchanged = 0
would_change, applied = [], []
for row in rows:
    key = row['key']
    if row['status'] == 'applied' or key in foods:
        if key in foods and row['decision'] == 'yes' and row.get('use_fdc_id') and str(foods[key]['fdc_id']) != str(row['use_fdc_id']):
            would_change.append(f"{key}: has {foods[key]['fdc_id']}, the CSV asks for {row['use_fdc_id']}")
        unchanged += 1
        continue
    decision, auto = row['decision'], row['auto']
    if decision == 'no': skipped_no += 1; continue
    if not (decision == 'yes' or (decision == '' and auto == 'yes')): skipped_blank += 1; continue
    fdc = row.get('use_fdc_id') or row['fdc_id']
    rec = usda.get(str(fdc))
    if rec is None: print(f"error: {key} names USDA record {fdc}, which is not in data/foods-usda/foods_usda.json"); sys.exit(1)
    ms = usable(rec.get('portions'), rec['name'])
    if not ms: print(f"error: {key} -> {fdc} {rec['name']} has no household row the engine can use"); sys.exit(1)
    by = 'owner, ' + today if decision == 'yes' else 'rule: distance<=0.25, overlap>=0.6, no modifier of another food'
    done['owner' if decision == 'yes' else 'rule'] += 1
    applied.append(f"{key} <- {rec['name'][:40]} [{fdc}] " + '; '.join(f"{m['label']} {m['grams']:g}" for m in ms[:3]))
    foods[key] = {'fdc_id': str(fdc), 'usda_name': rec['name'] + (' (USDA FNDDS, foods as eaten)' if rec['dataset'] == 'survey_fndds' else ''),
                  'measures': [{'label': m['label'], 'grams': m['grams']} for m in ms], 'accepted_by': by}

mapping['meta']['rule'] = ('distance <= 0.10 and name overlap >= 0.6 (the first 186), plus links applied by scripts/apply-portion-links.py: a row the owner marked yes in '
                           'data/recipes-db/usda-links.csv, or one the rule accepts (distance <= 0.25, name overlap >= 0.6, no modifier of another food, few unexplained words)')
print(f"applied by the owner's yes: {done['owner']}; by the rule: {done['rule']}; skipped (no): {skipped_no}; skipped (nobody decided): {skipped_blank}; already in the mapping: {unchanged}")
for a in applied: print('  +', a)
if would_change:
    print('would_change (left alone):')
    for w in would_change: print('  !', w)
if not dry:
    json.dump(mapping, open(mapping_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('wrote', mapping_path.relative_to(ROOT))
else:
    print('dry run: nothing written')
