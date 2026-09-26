"""Pick a GI value for every ingredient from the evidence pool and record its provenance.

Evidence pools, in order of authority:
  A  2021 International Tables, Supplemental Table 1  — method consistent with ISO 26642:2010
  B  2021 International Tables, Supplemental Table 2  — method deviations / wide variability
  C  University of Sydney online GI database (glycemicindex.com/gi-search), scraped 2026-09-16
Nutrient values always come from USDA FoodData Central and are not touched here.
"""
import json, re, statistics, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "recipes-db"))
from ingredients import ING
from matchers import M, WEST, DEFAULT_EX

INTL = json.load(open(os.path.join(os.path.dirname(__file__), "intl_tables_2021.json")))["rows"]
SYD = json.load(open(os.path.join(os.path.dirname(__file__), "..", "recipes-db", "sydney_gi_db.json")))["rows"]
SYD = [{"food": r["food"], "gi": float(r["gi"]), "country": r["country"], "year": r["year"], "tier": "sydney"}
       for r in SYD if r["gi"].strip().isdigit()]

DEF = re.compile(DEFAULT_EX, re.I)

def match(pool, inc, exc, countries, kind="whole"):
    rx, ex = re.compile(inc, re.I), (re.compile(exc, re.I) if exc else None)
    hits = [r for r in pool if rx.search(r["food"]) and not (ex and ex.search(r["food"]))]
    if kind == "whole":
        hits = [h for h in hits if not DEF.search(h["food"])]
    if countries:
        pref = [h for h in hits if h["country"] in countries]
        if len(pref) >= 3:
            return pref, True
    return hits, False

def summarise(hits):
    if not hits: return None
    g = sorted(h["gi"] for h in hits)
    return {"n": len(g), "median": round(statistics.median(g)), "min": g[0], "max": g[-1]}

rows = []
for key, (inc, exc, countries, kind) in M.items():
    if key not in ING:
        continue
    iso, iso_pref = match([r for r in INTL if r["tier"] == "ISO"], inc, exc, countries, kind)
    dev, _ = match([r for r in INTL if r["tier"] == "deviation"], inc, exc, countries, kind)
    syd, _ = match(SYD, inc, exc, countries, kind)
    A, B, C = summarise(iso), summarise(dev), summarise(syd)
    cur = ING[key][6]
    if A and A["n"] >= 2:
        rec, basis = A["median"], "ISO"
    elif A:
        rec, basis = (round(statistics.median([A["median"]] + [B["median"]])) if B else A["median"]), ("ISO+deviation" if B else "ISO")
    elif B:
        rec, basis = B["median"], "deviation"
    elif C:
        rec, basis = C["median"], "sydney"
    else:
        rec, basis = cur, "none"
    rows.append({"key": key, "name": ING[key][0], "current": cur, "recommended": rec, "basis": basis,
                 "pref_western": iso_pref, "iso": A, "deviation": B, "sydney": C,
                 "delta": rec - cur,
                 "examples": [f'{h["gi"]:g} — {h["food"][:80]} ({h["country"]} {h["year"]})' for h in sorted((iso or dev or syd), key=lambda x: x["gi"])[:5]],
                 })
json.dump(rows, open(os.path.join(os.path.dirname(__file__), "gi_provenance.json"), "w"), ensure_ascii=False, indent=1)

def fmt(s): return f'{s["median"]:>3} (n={s["n"]:<3} {s["min"]:g}-{s["max"]:g})' if s else "      —       "
print(f'{"ingredient":30}{"ours":>5}{"ISO 2021":>22}{"deviation":>20}{"Sydney online":>20}  rec  Δ')
for r in sorted(rows, key=lambda x: -abs(x["delta"])):
    flag = "  <<< CONFLICT" if abs(r["delta"]) >= 8 else ""
    print(f'{r["key"]:30}{r["current"]:>5}{fmt(r["iso"]):>22}{fmt(r["deviation"]):>20}{fmt(r["sydney"]):>20}{r["recommended"]:>5}{r["delta"]:>5}{flag}')
print("\nno evidence found:", [r["key"] for r in rows if r["basis"] == "none"])
print("ingredients with GI>0 not covered by a matcher:",
      [k for k, v in ING.items() if v[6] not in (0, 15) and k not in M])
