"""Extract Supplemental Tables 1 & 2 of:
Atkinson FS, Brand-Miller JC, Foster-Powell K, Buyken AE, Goletzke J.
International tables of glycemic index and glycemic load values 2021.
Am J Clin Nutr 2021;114(5):1625-1632. doi:10.1093/ajcn/nqab233

Table 1 = method consistent with ISO 26642:2010  -> evidence tier "ISO"
Table 2 = method deviations / wide variability   -> evidence tier "deviation"
Rows are recovered by vertical bands anchored on the food-number column, because the
PDF has no row rules and wrapped food names sit above and below their number.
"""
import pdfplumber, json, re

SRC = "/Users/nadiab./Downloads/mmc1-nqab233_supplemental_files/"

SPEC = {
 "SupplementalTable1.pdf": dict(tier="ISO", first=2, cols=[
   ("num",0,71),("food",71,282),("country",282,338),("year",338,375),("gi",375,420),
   ("gl",420,445),("subjects",445,496),("carb_portion_g",496,529),("test_portion_g",529,568),
   ("reference_food",568,623),("timepoints",623,676),("sample_collection",676,738),
   ("analysis_method",738,791),("ref_no",791,2000)]),
 "SupplementalTable2.pdf": dict(tier="deviation", first=2, cols=[
   ("num",0,57),("food",57,243),("country",243,294),("year",294,328),("gi",328,367),
   ("gl",367,393),("subjects",393,442),("carb_portion_g",442,480),("test_portion_g",480,520),
   ("reference_food",520,575),("ref_repeated",575,607),("timepoints",607,660),
   ("sample_collection",660,722),("analysis_method",722,776),("ref_no",776,2000)]),
}

def lines_of(page):
    out = {}
    for w in page.extract_words():
        if w.get("upright") is False:
            continue
        out.setdefault(round(w["top"] / 3.0), []).append(w)
    return [(min(x["top"] for x in ws), sorted(ws, key=lambda z: z["x0"])) for k, ws in sorted(out.items())]

def cells_of(ws, cols):
    cells = {c[0]: [] for c in cols}
    for w in ws:
        xc = (w["x0"] + w["x1"]) / 2
        name = cols[-1][0]
        for n, a, b in cols:
            if a <= xc < b:
                name = n; break
        cells[name].append(w["text"])
    return {k: " ".join(v) for k, v in cells.items()}

def extract(fname):
    spec = SPEC[fname]; cols = spec["cols"]
    records = []
    with pdfplumber.open(SRC + fname) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            if pno < spec["first"]:
                continue
            if "Footnotes for Supplemental" in (page.extract_text() or "")[:400]:
                break
            L = [x for x in lines_of(page) if x[0] > 95]
            anchors = [(top, cells_of(ws, cols)) for top, ws in L
                       if re.fullmatch(r"\d{1,5}", cells_of(ws, cols)["num"].strip())]
            if not anchors:
                continue
            tops = [a[0] for a in anchors]
            bounds = [tops[0] - 42] + [(tops[i] + tops[i + 1]) / 2 for i in range(len(tops) - 1)] + [tops[-1] + 42]
            recs = [{k: "" for k, _, _ in cols} for _ in anchors]
            for top, ws in L:
                if top < bounds[0] or top >= bounds[-1]:
                    continue
                for i in range(len(anchors)):
                    if bounds[i] <= top < bounds[i + 1]:
                        c = cells_of(ws, cols)
                        for k in c:
                            if c[k]:
                                recs[i][k] = (recs[i][k] + " " + c[k]).strip()
                        break
            for r, (atop, acell) in zip(recs, anchors):
                r["num"] = acell["num"].strip()
                r["page"] = pno; r["tier"] = spec["tier"]
            records += recs
    return records

CRUFT = [
    r"Average available carbohydrate portion = \d+ ?g[^.]*\.?",
    r"this value was used to determine the nominal glycemic load[^.]*\.?",
    r"was used to determine[^.]*\.?", r"each item in this category\.?",
    r"Atkinson FS[^.]*\.", r"Number and Item", r"\bNS\b$",
]
def scrub(s):
    s = re.sub(r"\s+", " ", s or "").strip()
    for c in CRUFT:
        s = re.sub(c, " ", s)
    s = re.sub(r"\b([A-Z]{3,}(?: [A-Z&,]{2,})*)\b", lambda m: m.group(0) if len(m.group(0)) < 8 else " ", s)
    return re.sub(r"\s+", " ", s).strip(" ,.;")

def num(x):
    m = re.search(r"(\d+(?:\.\d+)?)", x or "")
    return float(m.group(1)) if m else None

def clean(recs):
    out, bad = [], 0
    for r in recs:
        gi = num(r["gi"])
        if gi is None or gi > 200:
            bad += 1; continue
        sem = None
        m = re.search(r"±\s*(\d+(?:\.\d+)?)", r["gi"])
        if m: sem = float(m.group(1))
        n = None
        mn = re.search(r"(\d+)\s*$", r["subjects"].strip())
        if mn: n = int(mn.group(1))
        yr = re.findall(r"(19|20)\d{2}", r["year"])
        out.append({
            "entry_no": int(r["num"]), "tier": r["tier"],
            "food": scrub(r["food"]),
            "country": re.sub(r"\s+", " ", r["country"]).strip(),
            "year": r["year"].strip(),
            "gi": gi, "gi_sem": sem, "gl": num(r["gl"]),
            "subjects": re.sub(r"\s+", " ", r["subjects"]).strip(), "n_subjects": n,
            "carb_portion_g": num(r["carb_portion_g"]), "test_portion_g": num(r["test_portion_g"]),
            "reference_food": r["reference_food"].strip(),
            "ref_no": r["ref_no"].strip(), "page": r["page"],
        })
    return out, bad

if __name__ == "__main__":
    def dedupe(rows):
        by = {}
        for r in rows:
            k = (r["tier"], r["entry_no"])
            if k in by:                      # entry split across a page break
                o = by[k]
                o["food"] = (o["food"] + " " + r["food"]).strip()
                for f in ("country","year","subjects","reference_food","ref_no"):
                    if not o[f]: o[f] = r[f]
                for f in ("gi","gl","gi_sem","n_subjects","carb_portion_g","test_portion_g"):
                    if o[f] is None: o[f] = r[f]
            else:
                by[k] = r
        return list(by.values())
    t1, b1 = clean(extract("SupplementalTable1.pdf"))
    t2, b2 = clean(extract("SupplementalTable2.pdf"))
    t1, t2 = dedupe(t1), dedupe(t2)
    # two records sit beside the "BAKERY PRODUCTS" banner on the title page; fix them from the raw text
    for r in t1:
        if r["entry_no"] == 1:
            r.update(food="Cake, chocolate, iced (Bakery School, Herk-de-Stad, Belgium)",
                     country="Belgium", year="2010*", subjects="Normal, 10", n_subjects=10)
    for r in t2:
        if r["entry_no"] == 2092:
            r.update(food="Angel food cake (Loblaw's, Toronto, Canada)", country="Canada",
                     year="1984-1992", subjects="Type 1 & 2, 9", n_subjects=9)
    print(f"Table 1 (ISO): {len(t1)} rows ({b1} skipped) | Table 2 (deviation): {len(t2)} rows ({b2} skipped)")
    json.dump({"citation": "Atkinson FS, Brand-Miller JC, Foster-Powell K, Buyken AE, Goletzke J. "
               "International tables of glycemic index and glycemic load values 2021. "
               "Am J Clin Nutr 2021;114(5):1625-1632. doi:10.1093/ajcn/nqab233",
               "tables": {"1": "method consistent with ISO 26642:2010", "2": "method deviations or wide variability"},
               "rows": t1 + t2}, open("intl_tables_2021.json", "w"), ensure_ascii=False, indent=0)
    for r in t1[:3]: print(r["entry_no"], r["gi"], "|", r["food"][:80], "|", r["country"], r["year"], r["subjects"])
    for r in t2[:3]: print(r["entry_no"], r["gi"], "|", r["food"][:80], "|", r["country"], r["year"], r["subjects"])
