"""How often would the agent have to say 'not in the database'?
40 phrases a US user with type 2 diabetes might actually type, matched against the
food layer (13,169 USDA foods) and the 1,000-recipe book."""
import json, re, collections, sys
sys.path.insert(0, "../recipes-db")
FOODS = json.load(open("foods_usda.json"))["foods"]
RECIPES = json.load(open("../recipes-db/recipes_db.json"))["recipes"]
STOP = set("and or with without the a of in on to for from my i ate had some".split())
def toks(s):
    return {w for w in re.findall(r"[a-z]{3,}", s.lower()) if w not in STOP}
items = [{"name": f["name"], "t": toks(f["name"]), "gi": f["gi"], "lvl": f["gi_level"], "src": "USDA"} for f in FOODS]
items += [{"name": r["name"], "t": toks(r["name"]), "gi": r["glycemic_index"], "lvl": "recipe", "src": "recipe"} for r in RECIPES]
idx = collections.defaultdict(list)
for i, it in enumerate(items):
    for w in it["t"]: idx[w].append(i)
QUERIES = """chipotle chicken burrito bowl|starbucks grande latte|two scrambled eggs with cheddar|
oatmeal with blueberries|whole wheat toast with peanut butter|greek yogurt with honey|banana|
turkey sandwich on rye|caesar salad with grilled chicken|slice of pepperoni pizza|cheeseburger and fries|
sushi salmon roll|pad thai with shrimp|chicken tikka masala with rice|black bean soup|
protein bar|almonds handful|apple with peanut butter|diet coke|orange juice|
mashed potatoes|corn on the cob|baked sweet potato|steamed broccoli|caesar dressing|
grilled salmon fillet|beef tacos|refried beans|guacamole and chips|macaroni and cheese|
pancakes with syrup|bagel with cream cheese|cottage cheese with pineapple|lentil soup|
hummus with carrots|dark chocolate square|ice cream vanilla|popcorn movie theater|
chicken noodle soup|french toast""".replace("\n", "").split("|")
def best(q):
    qt = toks(q); c = collections.Counter()
    for w in qt:
        for i in idx.get(w, ()): c[i] += 1
    bi, bs = None, 0
    for i, _ in c.most_common(120):
        it = items[i]; inter = len(qt & it["t"])
        s = inter / len(qt | it["t"]) + 0.25 * inter / max(1, len(qt))
        if s > bs: bi, bs = it, s
    return bi, bs
found = gi_known = 0
rows = []
for q in [x.strip() for x in QUERIES if x.strip()]:
    m, s = best(q)
    ok = m is not None and s >= 0.30
    gi = (m["gi"] if ok else None)
    found += ok; gi_known += bool(ok and gi is not None)
    rows.append((q, m["name"][:52] if ok else "— NOT FOUND —", m["src"] if ok else "", gi if gi is not None else "?", round(s, 2)))
for r in rows: print(f'  {r[0][:38]:38} -> {r[1]:52} [{r[2]:6}] GI {str(r[3]):>3}')
n = len(rows)
print(f"\nmatched a food: {found}/{n} = {100*found/n:.0f}%   |   with a usable GI: {gi_known}/{n} = {100*gi_known/n:.0f}%")
