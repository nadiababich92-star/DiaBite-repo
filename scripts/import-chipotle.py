#!/usr/bin/env python3
"""
Read Chipotle's own US nutrition table into data/foods-usda/restaurant_items.json.

    python3 scripts/import-chipotle.py /path/to/US-Nutrition-Facts-Paper-Menu-3-2025.pdf 2026-11-17

The PDF is the one Chipotle publishes at
https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf
(needs `pip install pypdf`; run with `python3 -I` from a folder that holds nothing else).

What is taken and what is not, so nothing is invented:
  * Only rows whose portion is a weight (oz) or a volume (fl oz): they become grams (oz x 28.35, rounded; fl oz x 29.57, at
    1 g per ml as USDA's own drink rows are treated). A row measured "1 ea" (the tortillas) has no weight in the table and is
    LEFT OUT, and so are the soft drinks (22 and 32 fl oz); both are listed at the end.
  * "< 1" is taken as 0: a fibre figure under one gram counts as no fibre, which makes available carbohydrate higher, not lower.
  * Every figure is the table's own, per portion; per-100 g is the portion divided by its weight.
  * Only the main table is read, not the kids' menu below it (half portions under the same names). The two pages that hold
    the main table must agree row for row, no name may appear twice, and calories must roughly follow 4/4/9 from the three
    macros; a row that does not is a misread and stops the run.
"""
import json, re, sys
from pathlib import Path
from pypdf import PdfReader

pdf_path, read_on = Path(sys.argv[1]), sys.argv[2]
URL = 'https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf'
OUT = Path(__file__).resolve().parent.parent / 'data' / 'foods-usda' / 'restaurant_items.json'
CHAIN = 'Chipotle'

NUM = r'<?\s?\d+(?:\.\d+)?'
ROW = re.compile(rf'^(?P<name>.+?)\s+(?P<qty>\d+(?:\.\d+)?)\s(?P<unit>fl oz|oz|ea)\s+(?P<n>(?:{NUM}\s+){{10}}{NUM})\s*$')
GRAMS = {'oz': 28.3495, 'fl oz': 29.5735}
CATEGORY = [(r'rice|chips', 'grains'), (r'beans', 'legumes'), (r'barbacoa|chicken|carnitas|steak|sofritas', 'protein'),
            (r'cheese|sour cream|queso', 'dairy'), (r'guacamole|vinaigrette', 'fats'), (r'salsa|vegetables|lettuce|salad mix', 'vegetables')]

def num(t: str) -> float:
    t = t.strip()
    return 0.0 if t.startswith('<') else float(t)

def parse(page_text: str):
    # The page ends with a second table, the kids' menu, whose rows reuse the names of the first at half the portion
    # ("Cilantro-Lime White Rice 2 oz"). Read only the table above it: a name that appears twice once overwrote the full
    # portion with the child's, and the carbohydrate came out at half.
    rows = {}
    lines = [l.strip() for l in page_text.split('kids Menu')[0].splitlines()]
    pending = ''
    for l in lines:
        m = ROW.match(l)
        if m:
            if m['name'] in rows:
                sys.exit(f"{m['name']} appears twice in the main table: the parse is not reading what it thinks it reads")
            rows[m['name']] = (m['qty'], m['unit'], [num(x) for x in re.findall(NUM, m['n'])])
    return rows

reader = PdfReader(str(pdf_path))
p2, p3 = parse(reader.pages[1].extract_text()), parse(reader.pages[2].extract_text())
shared = [k for k in p2 if k in p3]
for k in shared:
    if p2[k] != p3[k]:
        sys.exit(f'page 2 and page 3 disagree on {k}: {p2[k]} vs {p3[k]}')

items, left_out = [], []
for name, (qty, unit, v) in p2.items():
    cal, cal_fat, fat, sat, trans, chol, sodium, carbs, fiber, sugar, protein = v
    if unit == 'ea' or (unit == 'fl oz' and float(qty) >= 12):   # tortillas have no weight; 22 and 32 fl oz are the soft drinks
        left_out.append(f'{name} ({qty} {unit})'); continue
    grams = round(float(qty) * GRAMS[unit])
    # a misread row would put a wrong carbohydrate figure in front of a person on insulin
    est = 4 * carbs + 4 * protein + 9 * fat
    if cal and abs(est - cal) > max(25, 0.18 * cal):
        sys.exit(f'{name}: {cal} cal does not follow from carbs {carbs}, protein {protein}, fat {fat} (about {est:.0f})')
    if fiber > carbs:
        sys.exit(f'{name}: fibre {fiber} above carbohydrate {carbs}')
    cat = next((c for pat, c in CATEGORY if re.search(pat, name, re.I)), None)
    if cat is None:
        sys.exit(f'no category for {name}')
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    per = lambda x: round(x * 100 / grams, 3)
    items.append({
        'id': f'rest:chipotle-{slug}', 'name': name, 'chain': CHAIN, 'category': cat,
        'per100': {'kcal': per(cal), 'protein': per(protein), 'fat': per(fat), 'carbs': per(carbs), 'fiber': per(fiber)},
        'serving': {'grams': grams, 'label': f'{qty} {unit}'},
        'url': URL, 'read': read_on,
    })

existing = json.loads(OUT.read_text()) if OUT.exists() else []
kept = [r for r in existing if not r['id'].startswith('rest:chipotle-')]
OUT.write_text(json.dumps(kept + items, indent=1, ensure_ascii=False) + '\n')
print(f'{len(items)} Chipotle items written; {len(kept)} rows of other chains kept')
print('left out (no weight, or a soft drink):', '; '.join(left_out) if left_out else 'none')
