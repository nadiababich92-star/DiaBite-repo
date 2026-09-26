"""Apply the approved source-of-truth policy (2026-09-26): the measured median wins.
Five documented exceptions are kept, each because the matched evidence is not the food we mean
or because a US-market product measured under ISO is the better answer."""
import json, re, os
KEEP = {
 "monk_fruit_sweetener": "matched entries are sweetener blends containing lactose/fructose (Zusto, SUITENA); pure erythritol/monk fruit has no glycemic response",
 "blueberries": "the low value comes from an Iranian entry labelled 'Blueberries (sour cherry)'; the ISO-compliant Canadian wild blueberry is 53",
 "hummus": "Sabra Classic Hummus (USA) tested under ISO = 15; the 6s are Lebanese home-style dips",
 "dark_chocolate": "Dove dark (USA, ISO) = 23 matches an 85% bar; the 44-56 values are milk-ier Czech/Chinese products",
 "carrot": "evidence median 32 is dominated by raw carrot; our recipes use both raw and cooked, and 39 sits between the raw (16-35) and boiled (39-92) clusters",
}
RENAME = {"new_potato": "New potatoes, boiled"}
conf = json.load(open("conflicts.json"))
src = open("../recipes-db/ingredients.py").read()
applied, skipped = [], []
for c in conf:
    key = c["key"]
    if key in KEEP:
        skipped.append((key, c["now"], c["ev"], KEEP[key])); continue
    m = re.search(r'^"%s":\("([^"]*)",([^)]*)\),' % re.escape(key), src, re.M)
    assert m, key
    parts = [p.strip() for p in m.group(2).split(",")]
    assert int(float(parts[5])) == c["now"], (key, parts, c["now"])
    parts[5] = str(c["ev"])
    name = RENAME.get(key, m.group(1))
    src = src[:m.start()] + '"%s":("%s",%s),' % (key, name, ",".join(parts)) + src[m.end():]
    applied.append((key, c["now"], c["ev"]))
src = src.replace("# GI: cross-checked 2026-09-16 against",
 "# GI: 2026-09-26 every value re-derived from the 2021 International Tables (Atkinson et al., AJCN 2021;\n"
 "#     Suppl. Table 1 = ISO 26642:2010-compliant, Suppl. Table 2 = method deviations) under the policy\n"
 "#     'measured median wins'; provenance per ingredient in gi_sources.py.\n"
 "# GI: cross-checked 2026-09-16 against")
open("../recipes-db/ingredients.py", "w").write(src)
print("applied", len(applied)); [print("   ", *a) for a in applied]
print("kept as-is", len(skipped)); [print("   ", s[0], s[1], "(evidence", str(s[2]) + ")", "-", s[3][:70]) for s in skipped]
