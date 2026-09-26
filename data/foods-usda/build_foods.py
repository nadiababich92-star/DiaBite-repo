"""Build the DiaBite food-coverage layer from USDA FoodData Central.

Inputs (public domain, downloaded from fdc.nal.usda.gov/fdc-datasets):
  survey_fndds (FNDDS, 'foods as eaten' in NHANES), sr_legacy, foundation
Output: foods_usda.json — one record per food with nutrients per 100 g, household
portions, and a glycemic index assigned by the five-level confidence scheme of
Aston LM et al. Developing a methodology for assigning glycaemic index values to
foods consumed across Europe. Obes Rev 2010;11(1):92-100.

  level 1  measured value for this exact food (our evidence pool, ISO-compliant study)
  level 2  published value for this food (evidence pool, any tier)
  level 3  value of an equivalent food (our own 351-ingredient table)
  level 4  estimated from the median of measured foods in the same USDA category
  level 5  NOT USED — Aston assigns a nominal 70 here; DiaBite leaves GI unknown
           so the agent can say it does not know instead of inventing a number.
"""
import csv, json, os, re, sys, statistics, collections

BASE = "/private/tmp/claude-501/-Users-nadiab--untitled-folder-Claude-folder/f5c6d73a-1e57-4a64-8ea4-8cca8cf1c5c2/scratchpad/fdc"
SETS = {
 "survey_fndds": f"{BASE}/FoodData_Central_survey_food_csv_2024-10-31/FoodData_Central_survey_food_csv_2024-10-31",
 "sr_legacy":    f"{BASE}/FoodData_Central_sr_legacy_food_csv_2018-04/FoodData_Central_sr_legacy_food_csv_2018-04",
 "foundation":   f"{BASE}/FoodData_Central_foundation_food_csv_2025-04-24/FoodData_Central_foundation_food_csv_2025-04-24",
}
# FDC ids and the legacy nutrient_nbr codes (the Survey/FNDDS export uses the latter)
NUT = {"1008": "kcal", "1003": "protein", "1004": "fat", "1005": "carbs", "1079": "fiber", "2000": "sugar",
       "208": "kcal", "203": "protein", "204": "fat", "205": "carbs", "291": "fiber", "269": "sugar"}
csv.field_size_limit(10 ** 7)

def load_set(name, path):
    keep = {"survey_fndds": {"survey_fndds_food"}, "sr_legacy": {"sr_legacy_food"},
            "foundation": {"foundation_food"}}[name]
    foods = {}
    for r in csv.DictReader(open(f"{path}/food.csv")):
        if r["data_type"] in keep:
            foods[r["fdc_id"]] = {"fdc_id": r["fdc_id"], "name": r["description"].strip(),
                                  "dataset": name, "category_id": r["food_category_id"],
                                  "per100": {}, "portions": []}
    for r in csv.DictReader(open(f"{path}/food_nutrient.csv")):
        f = foods.get(r["fdc_id"])
        if f and r["nutrient_id"] in NUT and r["amount"]:
            f["per100"][NUT[r["nutrient_id"]]] = round(float(r["amount"]), 2)
    if os.path.exists(f"{path}/food_portion.csv"):
        for r in csv.DictReader(open(f"{path}/food_portion.csv")):
            f = foods.get(r["fdc_id"])
            if f and r["gram_weight"] and float(r["gram_weight"]) > 0 and len(f["portions"]) < 4:
                label = (r.get("portion_description") or "").strip() or (r.get("modifier") or "").strip()
                if label and label.lower() != "quantity not specified":
                    f["portions"].append({"label": label, "grams": round(float(r["gram_weight"]), 1)})
    # category names
    cats = {}
    if name == "survey_fndds":
        for r in csv.DictReader(open(f"{path}/wweia_food_category.csv")):
            cats[r["wweia_food_category"]] = r["wweia_food_category_description"]
    elif os.path.exists(f"{path}/food_category.csv"):
        for r in csv.DictReader(open(f"{path}/food_category.csv")):
            cats[r["id"]] = r["description"]
    for f in foods.values():
        f["category"] = cats.get(f["category_id"], "")
    return [f for f in foods.values() if "carbs" in f["per100"] and "kcal" in f["per100"]]

# PRODUCT words change WHAT the food is: "banana" and "banana nectar" are different foods,
# so a measured value for one may never be copied onto the other.
PRODUCT = set("juice nectar drink beverage smoothie chips crisps soup sandwich burger pizza cake muffin "
              "cookie biscuit cracker bar pie sauce syrup powder concentrate spread jam jelly candy "
              "yogurt yoghurt milk cheese butter oil flour bread roll bun tortilla noodle pasta salad "
              "stew casserole pudding custard sorbet sherbet infant baby toddler formula wine beer "
              "chocolate candy candies marshmallow topping frosting icing shake cone sushi jerky "
              "soda cola coffee tea liqueur cereal granola dressing dip gravy".split())
# COOK words change only the preparation. They matter for GI, but a value from a differently
# prepared version of the same food is exactly Aston's level 3 ("equivalent food"), not a lie.
COOK = set("raw fresh boiled baked fried roasted grilled mashed steamed canned frozen dried dehydrated "
           "instant cooked prepared toasted".split())

STOP = set("and or with without the a of in on to for from nfs ns include includes "
           "made uncooked commercially usda commodity brand brands type types "
           "all any other others not further specified g ml oz cup "
           "salt salted unsalted sodium added drained solids liquids distribution program "
           "school lunch child care centers reduced regular light".split())
def toks(s):
    s = re.sub(r"\(.*?\)", " ", s.lower())
    return {w for w in re.findall(r"[a-z]{3,}", s) if w not in STOP}

def build_index(items):
    idx = collections.defaultdict(list)
    for i, it in enumerate(items):
        for t in it["tokens"]:
            idx[t].append(i)
    return idx

def head(s):
    """First content word of a USDA name — 'Beans, kidney, red, cooked' -> 'beans'."""
    w = re.findall(r"[a-z]{3,}", re.sub(r"\(.*?\)", " ", s.lower()))
    return next((x for x in w if x not in STOP), "")

def best_match(q, items, idx, min_score, need_head=None, strict_form=False):
    cand = collections.Counter()
    for t in q:
        for i in idx.get(t, ()):
            cand[i] += 1
    best, score = None, 0.0
    for i, _ in cand.most_common(80):
        it = items[i]
        if need_head and need_head not in it["tokens"]: continue
        if strict_form and (q & PRODUCT) != (it["tokens"] & PRODUCT): continue
        inter = len(q & it["tokens"])
        if not inter: continue
        # one shared word is not a match unless both names are one word long
        if inter < 2 and not (len(q) == 1 and len(it["tokens"]) == 1): continue
        # containment, not Jaccard: USDA names carry long qualifier chains
        # ("Beans, kidney, red, mature seeds, cooked, boiled, without salt"), so the right
        # question is whether one name's content words sit inside the other's.
        s = inter / min(len(q), len(it["tokens"]))
        if s > score:
            best, score = it, s
    return (best, score) if score >= min_score else (None, score)

def same_prep(a, b):
    return (a & COOK) == (b & COOK)

def main():
    foods = []
    for name, path in SETS.items():
        got = load_set(name, path)
        print(f"{name:14} {len(got):6} foods")
        foods += got
    seen, uniq = set(), []
    for f in sorted(foods, key=lambda x: {"survey_fndds": 0, "foundation": 1, "sr_legacy": 2}[x["dataset"]]):
        k = f["name"].lower().strip()
        if k not in seen:
            seen.add(k); uniq.append(f)
    print("unique foods:", len(uniq))

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "recipes-db"))
    from ingredients import ING
    from gi_sources import GI_SOURCE
    pool = json.load(open(os.path.join(os.path.dirname(__file__), "..", "gi-evidence", "intl_tables_2021.json")))["rows"]
    syd = json.load(open(os.path.join(os.path.dirname(__file__), "..", "recipes-db", "sydney_gi_db.json")))["rows"]
    measured = [{"name": r["food"], "gi": r["gi"], "tier": r["tier"]} for r in pool]
    measured += [{"name": r["food"], "gi": float(r["gi"]), "tier": "sydney"} for r in syd if r["gi"].strip().isdigit()]
    for m in measured: m["tokens"] = toks(m["name"])
    measured = [m for m in measured if m["tokens"]]
    ingr = [{"name": v[0], "key": k, "gi": v[6], "net": max(0.0, v[4] - v[5]), "tokens": toks(v[0])}
            for k, v in ING.items()]
    m_idx, i_idx = build_index(measured), build_index(ingr)

    # category medians from measured foods that matched at level 1-2 (computed in a second pass)
    for f in uniq:
        f["tokens"] = toks(f["name"])
        net = max(0.0, f["per100"].get("carbs", 0) - f["per100"].get("fiber", 0))
        f["net_carbs"] = round(net, 2)
        if net < 2.0:
            f.update(gi=0, gi_level="n/a",
                     gi_basis="negligible available carbohydrate (<2 g/100 g) — GI carries no meaning, "
                              "glycemic load is ~0 at any realistic portion")
            continue
        h = head(f["name"])
        m, s = best_match(f["tokens"], measured, m_idx, 0.60, h, strict_form=True)
        if m and not same_prep(f["tokens"], m["tokens"]):
            # right food, different preparation -> Aston level 3
            iso = [x["gi"] for x in measured if x["tokens"] == m["tokens"]]
            f.update(gi=round(statistics.median(iso)), gi_level=3,
                     gi_basis=f'equivalent food, different preparation: measured value for '
                              f'"{m["name"][:60]}" (match {s:.0%}) — cooking method shifts GI, treat as approximate')
            continue
        if m and s >= 0.65:
            iso = [x["gi"] for x in measured if x["tokens"] == m["tokens"] and x["tier"] == "ISO"]
            same = [x["gi"] for x in measured if x["tokens"] == m["tokens"]]
            f.update(gi=round(statistics.median(iso or same)),
                     gi_level=1 if iso else 2,
                     gi_basis=f'{"ISO-compliant measurement" if iso else "published measurement"} for "{m["name"][:70]}" '
                              f'(match {s:.0%}, {len(iso or same)} value(s))')
            continue
        g, s = best_match(f["tokens"], ingr, i_idx, 0.55, h, strict_form=True)
        if g and g["net"] < 5 and net >= 5:
            g = None      # the food has carbohydrate; a carb-free ingredient cannot speak for it
        if not g:
            g, s = best_match(f["tokens"], ingr, i_idx, 0.70, strict_form=True)
        if g:
            f.update(gi=g["gi"], gi_level=3,
                     gi_basis=f'equivalent food: DiaBite ingredient "{g["name"]}" (match {s:.0%}); '
                              f'{GI_SOURCE.get(g["key"], {}).get("gi_source", "")[:80]}')
            continue
        f.update(gi=None, gi_level=None, gi_basis="")
    # level 4: category median of everything resolved at level 1-3
    bycat = collections.defaultdict(list)
    for f in uniq:
        if f.get("gi") and f.get("gi_level") in (1, 2, 3):
            bycat[f["category"]].append(f["gi"])
    def spread(v):
        v = sorted(v); n = len(v)
        return v[int(0.75 * (n - 1))] - v[int(0.25 * (n - 1))]
    for f in uniq:
        if f.get("gi_level") is None:
            vals = bycat.get(f["category"], [])
            if len(vals) >= 5 and spread(vals) <= 25:
                f.update(gi=round(statistics.median(vals)), gi_level=4,
                         gi_basis=f'estimated from {len(vals)} resolved foods in USDA category "{f["category"]}" '
                                  f'(median, interquartile spread {spread(vals):g} GI points)')
            else:
                f.update(gi=None, gi_level=5,
                         gi_basis="no value could be assigned with confidence — the agent must answer "
                                  "'unknown' rather than guess (Aston level 5 would assign a nominal 70; we do not)")
    def component_pass(allow_level4):
        ndb_, computed_ = {}, 0
        for r in csv.DictReader(open(f'{SETS["sr_legacy"]}/sr_legacy_food.csv')):
            ndb_[r["NDB_number"].lstrip("0")] = r["fdc_id"]
        byfdc_ = {f["fdc_id"]: f for f in uniq}
        comp_ = collections.defaultdict(list)
        for r in csv.DictReader(open(f'{SETS["survey_fndds"]}/input_food.csv')):
            if r["gram_weight"]:
                comp_[r["fdc_id"]].append((r["sr_code"].lstrip("0"), float(r["gram_weight"])))
        ok_levels = (1, 2, 3, 4) if allow_level4 else (1, 2, 3)
        for f in uniq:
            if f["dataset"] != "survey_fndds" or f.get("gi_level") in (1, 2, 3, "n/a"):
                continue
            num = den = unres = 0.0
            for code, grams in comp_.get(f["fdc_id"], []):
                src = byfdc_.get(ndb_.get(code, ""))
                if not src: continue
                carb = src["net_carbs"] * grams / 100.0
                if carb <= 0: continue
                if src.get("gi") is not None and src.get("gi_level") in ok_levels:
                    num += src["gi"] * carb; den += carb
                else:
                    unres += carb
            tot = den + unres
            if den > 0 and tot > 0 and den / tot >= 0.6:
                f.update(gi=round(num / den), gi_level=3, gi_from_components=True,
                         gi_basis=f"computed from this dish's own USDA ingredient breakdown "
                                  f"(carbohydrate-weighted mean, {100*den/tot:.0f}% of its carbohydrate resolved"
                                  + (", some components estimated at level 4)" if allow_level4 else ")"))
                computed_ += 1
        return computed_

    print("\nFNDDS dishes resolved from their ingredient breakdown, pass 1:", component_pass(False))
    # ── FNDDS mixed dishes: compute GI from the dish's own USDA ingredient breakdown ──
    # Every FNDDS food ships with input_food.csv: the SR ingredients and their grams per 100 g of
    # the dish. That is the same carbohydrate-weighted mean the recipe engine uses
    # (Wolever TMS, Jenkins DJA. Am J Clin Nutr 1986;43:167-72), applied to USDA's own recipe.
    print("FNDDS dishes resolved in pass 2 (after category estimates):", component_pass(True))

    for f in uniq:
        f.pop("tokens", None)
    out = {"meta": {"source": "USDA FoodData Central (public domain): Survey/FNDDS 2021-2023 (2024-10-31), "
                              "SR Legacy (2018-04), Foundation Foods (2025-04-24); fdc.nal.usda.gov",
                    "gi_assignment": "five-level confidence scheme of Aston LM et al., Obes Rev 2010;11:92-100, "
                                     "level 5 (nominal 70) deliberately not used",
                    "built": "2026-09-26", "count": len(uniq)},
           "foods": uniq}
    json.dump(out, open(os.path.join(os.path.dirname(__file__), "foods_usda.json"), "w"), ensure_ascii=False)
    import collections as _c
    per = _c.defaultdict(_c.Counter)
    for f in uniq: per[f["dataset"]][f["gi_level"]] += 1
    for ds, cc in per.items():
        tot = sum(cc.values()); ok = tot - cc[5]
        print(f'  {ds:14} {tot:6} foods | usable GI {100*ok/tot:5.1f}% | levels 1-3 {100*(cc[1]+cc[2]+cc[3])/tot:5.1f}%')
    c = collections.Counter(f["gi_level"] for f in uniq)
    print("\nGI assignment levels:")
    for k in (1, 2, 3, 4, 5, "n/a"):
        print(f"  level {k}: {c[k]:6}  {100*c[k]/len(uniq):5.1f}%")
    known = sum(v for k, v in c.items() if k != 5)
    print(f"  usable GI (or definitional 0): {known} / {len(uniq)} = {100*known/len(uniq):.1f}%")

main()
