"""Build the DiaBite recipe database: 1000 recipes -> xlsx + json + csv.

Nutrition per serving is computed from the ingredient master table (ingredients.py).
Dish GI = carbohydrate-weighted mean of ingredient GIs (Wolever & Jenkins 1986 method):
    GI_dish = sum(GI_i * availCarb_i) / sum(availCarb_i),   availCarb = carbs - fiber
Glycemic load per serving: GL = GI_dish * availCarb_serving / 100
"""
import json, glob, csv, re, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule
from openpyxl.worksheet.table import Table, TableStyleInfo
sys.path.insert(0, os.path.dirname(__file__))
from ingredients import ING, MEAT, FISH, DAIRY, EGG, GLUTEN, NUTS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
OUT_XLSX = os.path.join(OUT_DIR, "DiaBite_Recipes_1000.xlsx")
OUT_JSON = os.path.join(os.path.dirname(__file__), "recipes_db.json")
OUT_CSV  = os.path.join(os.path.dirname(__file__), "recipes_db.csv")

def slug(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

def gi_cat(gi):
    return "low" if gi <= 55 else ("medium" if gi <= 69 else "high")

def gl_cat(gl):
    return "low" if gl <= 10 else ("medium" if gl < 20 else "high")

recipes = []
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "recipes_*.jsonl"))):
    for line in open(f):
        line = line.strip()
        if line:
            recipes.append(json.loads(line))
assert len(recipes) == 1000, len(recipes)

rows = []
for i, r in enumerate(recipes, 1):
    tot = dict(kcal=0.0, protein=0.0, fat=0.0, carbs=0.0, fiber=0.0)
    gi_num = 0.0; avail_total = 0.0
    ing_lines = []; ing_json = []; keys = set()
    for it in r["ing"]:
        key, grams = it[0], float(it[1])
        note = it[2] if len(it) > 2 else ""
        name, kcal, p, fat, c, fib, gi, group = ING[key]
        k = grams / 100.0
        tot["kcal"] += kcal * k; tot["protein"] += p * k; tot["fat"] += fat * k
        tot["carbs"] += c * k; tot["fiber"] += fib * k
        avail = max(0.0, (c - fib) * k)
        gi_num += gi * avail; avail_total += avail
        keys.add(key)
        oz = grams / 28.35
        disp = f"{name} — {grams:g} g ({oz:.1f} oz)" + (f" [{note}]" if note else "")
        ing_lines.append(disp)
        ing_json.append({"ingredient_id": key, "name": name, "grams": grams, "note": note})
    s = r["servings"]
    per = {k: v / s for k, v in tot.items()}
    net = max(0.0, per["carbs"] - per["fiber"])
    gi = round(gi_num / avail_total) if avail_total > 0.5 else 0
    gl = round(gi * net / 100, 1)
    note = ""
    if net < 5:
        note = "Negligible carbohydrate (<5 g net/serving): GI has little practical meaning, glycemic load is what matters."
    elif gi >= 56:
        note = "Medium-GI dish: keep to the stated portion and pair with the protein/fat in the recipe; GL per serving is the better guide."
    # diet tags (derived)
    diet = []
    if not (keys & MEAT) and not (keys & FISH):
        diet.append("vegan" if not (keys & DAIRY) and not (keys & EGG) else "vegetarian")
    if keys & FISH and not (keys & MEAT): diet.append("pescatarian")
    if not (keys & GLUTEN): diet.append("gluten-free")
    if not (keys & DAIRY): diet.append("dairy-free")
    if not (keys & NUTS): diet.append("nut-free")
    if net <= 15: diet.append("low-carb")
    if per["protein"] >= 25: diet.append("high-protein")
    if per["fiber"] >= 7: diet.append("high-fiber")
    manual = [t for t in r.get("tags", []) if t not in diet and t not in ("vegan","vegetarian","gluten-free","low-carb","high-protein","high-fiber","vegetarian-option","vegan-option")]
    tags = diet + manual
    steps = r["steps"]
    rows.append({
        "id": f"DB-{i:04d}",
        "name": r["name"],
        "category": r["cat"],
        "cuisine": r["cuisine"],
        "servings": s,
        "prep_min": r["prep"], "cook_min": r["cook"], "total_min": r["prep"] + r["cook"],
        "photo_file": slug(r["name"]) + ".jpg",
        "photo_keywords": r["name"] + ", healthy food photography, plated, natural light",
        "photo_url": "",
        "ingredients": "\n".join(ing_lines),
        "ingredients_json": json.dumps(ing_json, ensure_ascii=False),
        "kcal": round(per["kcal"]),
        "protein_g": round(per["protein"], 1),
        "fat_g": round(per["fat"], 1),
        "carbs_g": round(per["carbs"], 1),
        "fiber_g": round(per["fiber"], 1),
        "net_carbs_g": round(net, 1),
        "glycemic_index": gi,
        "gi_category": gi_cat(gi),
        "glycemic_load": gl,
        "gl_category": gl_cat(gl),
        "gi_note": note,
        "diet_tags": ", ".join(tags),
        "instructions": "\n".join(f"{n}. {st}" for n, st in enumerate(steps, 1)),
        "steps_json": json.dumps(steps, ensure_ascii=False),
    })

# ── JSON / CSV ──────────────────────────────────────────────────────────
json.dump({"meta": {"count": len(rows), "nutrition_basis": "per serving",
                    "gi_method": "carbohydrate-weighted mean of ingredient GI (Wolever & Jenkins 1986); ingredient GI from International Tables of GI 2021 / University of Sydney",
                    "nutrient_source": "USDA FoodData Central"},
           "recipes": [dict(r, ingredients=json.loads(r["ingredients_json"]), steps=json.loads(r["steps_json"]))
                       for r in rows]},
          open(OUT_JSON, "w"), ensure_ascii=False, indent=1)
with open(OUT_CSV, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

# ── XLSX ────────────────────────────────────────────────────────────────
wb = Workbook()
FONT = "Arial"
hdr_font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
hdr_fill = PatternFill("solid", fgColor="1F4E78")
body_font = Font(name=FONT, size=10)
thin = Side(style="thin", color="D9D9D9")
border = Border(left=thin, right=thin, top=thin, bottom=thin)

def style_header(ws, ncols, row=1):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = hdr_font; cell.fill = hdr_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border

# Sheet 1: Recipes
ws = wb.active; ws.title = "Recipes"
headers = list(rows[0].keys())
widths = {"id":9,"name":38,"category":18,"cuisine":16,"servings":9,"prep_min":9,"cook_min":9,"total_min":9,
          "photo_file":34,"photo_keywords":40,"photo_url":18,"ingredients":58,"ingredients_json":30,
          "kcal":8,"protein_g":10,"fat_g":8,"carbs_g":9,"fiber_g":9,"net_carbs_g":11,"glycemic_index":11,
          "gi_category":11,"glycemic_load":11,"gl_category":11,"gi_note":40,"diet_tags":36,"instructions":80,"steps_json":30}
ws.append(headers); style_header(ws, len(headers))
ws.row_dimensions[1].height = 32
for r in rows:
    ws.append([r[h] for h in headers])
for ci, h in enumerate(headers, 1):
    ws.column_dimensions[get_column_letter(ci)].width = widths.get(h, 14)
wrap_cols = {"ingredients","instructions","gi_note","diet_tags","photo_keywords","name"}
for row in ws.iter_rows(min_row=2, max_row=ws.max_row):
    for cell in row:
        cell.font = body_font; cell.border = border
        h = headers[cell.column - 1]
        cell.alignment = Alignment(vertical="top", wrap_text=(h in wrap_cols),
                                   horizontal="center" if h in ("id","servings","prep_min","cook_min","total_min","kcal","protein_g","fat_g","carbs_g","fiber_g","net_carbs_g","glycemic_index","gi_category","glycemic_load","gl_category") else "left")
        if h in ("protein_g","fat_g","carbs_g","fiber_g","net_carbs_g","glycemic_load"): cell.number_format = "0.0"
for rr in range(2, ws.max_row + 1):
    ws.row_dimensions[rr].height = 96
ws.freeze_panes = "C2"
ws.auto_filter.ref = ws.dimensions
# GI traffic-light colouring
gi_col = get_column_letter(headers.index("glycemic_index") + 1)
gl_col = get_column_letter(headers.index("glycemic_load") + 1)
green = PatternFill("solid", fgColor="C6EFCE"); yellow = PatternFill("solid", fgColor="FFEB9C"); red = PatternFill("solid", fgColor="FFC7CE")
rng = f"{gi_col}2:{gi_col}{ws.max_row}"
ws.conditional_formatting.add(rng, CellIsRule(operator="lessThanOrEqual", formula=["55"], fill=green))
ws.conditional_formatting.add(rng, CellIsRule(operator="between", formula=["56","69"], fill=yellow))
ws.conditional_formatting.add(rng, CellIsRule(operator="greaterThanOrEqual", formula=["70"], fill=red))
rng = f"{gl_col}2:{gl_col}{ws.max_row}"
ws.conditional_formatting.add(rng, CellIsRule(operator="lessThanOrEqual", formula=["10"], fill=green))
ws.conditional_formatting.add(rng, CellIsRule(operator="between", formula=["10.01","19.99"], fill=yellow))
ws.conditional_formatting.add(rng, CellIsRule(operator="greaterThanOrEqual", formula=["20"], fill=red))

# Sheet 2: Ingredients master
wi = wb.create_sheet("Ingredients")
ih = ["ingredient_id","name","group","kcal_per_100g","protein_g","fat_g","carbs_g","fiber_g","net_carbs_g","glycemic_index","gi_source"]
wi.append(ih); style_header(wi, len(ih))
for key, (name, kcal, p, fat, c, fib, gi, group) in ING.items():
    if gi == 0:
        src = "No available carbohydrate (protein / fat / water) → GI 0"
    elif gi == 15 and group in ("veg","herb","spice","nut","seed","legume") and key not in ("tofu","tempeh"):
        src = "Conventional placeholder 15: too little carbohydrate to test (non-starchy vegetable, nut, seed, herb)"
    else:
        src = "International Tables of Glycemic Index 2021 (Atkinson et al.) / University of Sydney GI database"
    wi.append([key, name, group, kcal, p, fat, c, fib, round(max(0, c - fib), 1), gi, src])
for ci, w in enumerate([24,42,12,13,10,10,10,10,12,12,70], 1):
    wi.column_dimensions[get_column_letter(ci)].width = w
for row in wi.iter_rows(min_row=2):
    for cell in row: cell.font = body_font; cell.border = border
wi.freeze_panes = "B2"; wi.auto_filter.ref = wi.dimensions

# Sheet 3: Summary (live formulas)
wsum = wb.create_sheet("Summary")
wsum["A1"] = "Category"; wsum["B1"] = "Recipes"; wsum["C1"] = "Avg kcal/serving"; wsum["D1"] = "Avg net carbs (g)"; wsum["E1"] = "Avg GI"; wsum["F1"] = "Avg GL"; wsum["G1"] = "Low-GI share"
style_header(wsum, 7)
cats = sorted(set(r["category"] for r in rows))
N = ws.max_row
col = {h: get_column_letter(headers.index(h) + 1) for h in headers}
for i, c in enumerate(cats, 2):
    wsum.cell(row=i, column=1, value=c)
    wsum.cell(row=i, column=2, value=f'=COUNTIF(Recipes!${col["category"]}$2:${col["category"]}${N},A{i})')
    wsum.cell(row=i, column=3, value=f'=AVERAGEIF(Recipes!${col["category"]}$2:${col["category"]}${N},A{i},Recipes!${col["kcal"]}$2:${col["kcal"]}${N})')
    wsum.cell(row=i, column=4, value=f'=AVERAGEIF(Recipes!${col["category"]}$2:${col["category"]}${N},A{i},Recipes!${col["net_carbs_g"]}$2:${col["net_carbs_g"]}${N})')
    wsum.cell(row=i, column=5, value=f'=AVERAGEIF(Recipes!${col["category"]}$2:${col["category"]}${N},A{i},Recipes!${col["glycemic_index"]}$2:${col["glycemic_index"]}${N})')
    wsum.cell(row=i, column=6, value=f'=AVERAGEIF(Recipes!${col["category"]}$2:${col["category"]}${N},A{i},Recipes!${col["glycemic_load"]}$2:${col["glycemic_load"]}${N})')
    wsum.cell(row=i, column=7, value=f'=COUNTIFS(Recipes!${col["category"]}$2:${col["category"]}${N},A{i},Recipes!${col["gi_category"]}$2:${col["gi_category"]}${N},"low")/B{i}')
    for cc in range(1, 8):
        cell = wsum.cell(row=i, column=cc); cell.font = body_font; cell.border = border
    wsum.cell(row=i, column=3).number_format = "0"; wsum.cell(row=i, column=4).number_format = "0.0"
    wsum.cell(row=i, column=5).number_format = "0"; wsum.cell(row=i, column=6).number_format = "0.0"
    wsum.cell(row=i, column=7).number_format = "0%"
t = len(cats) + 2
wsum.cell(row=t, column=1, value="TOTAL").font = Font(name=FONT, bold=True)
wsum.cell(row=t, column=2, value=f"=SUM(B2:B{t-1})").font = Font(name=FONT, bold=True)
wsum.cell(row=t, column=7, value=f'=COUNTIF(Recipes!${col["gi_category"]}$2:${col["gi_category"]}${N},"low")/B{t}').number_format = "0%"
for ci, w in enumerate([24,10,16,18,10,10,14], 1):
    wsum.column_dimensions[get_column_letter(ci)].width = w
wsum.cell(row=t + 2, column=1, value="Formulas reference the Recipes sheet and recalculate automatically when it is opened in Excel / Google Sheets / Numbers.").font = Font(name=FONT, italic=True, size=9)

# Sheet 4: Methodology / column legend (RU + EN)
wm = wb.create_sheet("Methodology")
wm.column_dimensions["A"].width = 26; wm.column_dimensions["B"].width = 110
legend = [
 ("DiaBite recipe database", "1000 рецептов для людей с инсулинорезистентностью, преддиабетом и СД2 (рынок США). Все числа рассчитаны детерминированно из таблицы Ingredients — не сгенерированы моделью."),
 ("", ""),
 ("КАК СЧИТАЕТСЯ", ""),
 ("Nutrition (kcal, protein, fat, carbs, fiber)", "Сумма по ингредиентам: граммы × значение на 100 г из листа Ingredients (USDA FoodData Central), делённая на число порций. Все значения на 1 порцию."),
 ("net_carbs_g", "Усвояемые углеводы = carbs − fiber (на порцию). Именно от них считается гликемическая нагрузка."),
 ("glycemic_index", "ГИ блюда = Σ(ГИ ингредиента × его усвояемые углеводы) / Σ(усвояемые углеводы) — стандартный метод углеводно-взвешенного среднего (Wolever & Jenkins, Am J Clin Nutr 1986). ГИ ингредиентов — International Tables of Glycemic Index and Glycemic Load Values 2021 (Atkinson, Brand-Miller et al.) / база University of Sydney (glycemicindex.com). Некрахмалистые овощи, орехи, травы: условное значение 15 (углеводов слишком мало для измерения). Белки, жиры, вода: 0."),
 ("gi_category", "low ≤ 55, medium 56–69, high ≥ 70 (классификация ISO 26642:2010 / Brand-Miller)."),
 ("glycemic_load", "ГН порции = ГИ × net_carbs_g / 100."),
 ("gl_category", "low ≤ 10, medium 11–19, high ≥ 20 на порцию."),
 ("gi_note", "Пояснение: у блюд с < 5 г усвояемых углеводов ГИ практически не имеет смысла (ориентируйтесь на ГН); у блюд со средним ГИ — рекомендация по порции."),
 ("Сверка с glycemicindex.com", "16.09.2026 таблица Ingredients сверена с базой University of Sydney (glycemicindex.com/gi-search, 4 384 записи; выгрузка — data/recipes-db/sydney_gi_db.json, отчёт — gi_crosscheck.json). По итогам исправлены: цельнозерновой хлеб 51→71, пророщенный хлеб 36→55, фарро 40→63, дикий рис 45→57, гречка 45→51, овсяные хлопья 55→57, попкорн 55→65, хумус 25→15, чёрноглазая фасоль 33→42, мёд 58→61, вишня 22→38, репа 30→72 (значение брюквы — ближайший протестированный аналог). Батат разделён на варёный (GI 46) и запечённый (GI 85) — способ приготовления меняет ГИ почти вдвое; в фаршированных бататах рецепт переведён на варку."),
 ("", ""),
 ("ОГРАНИЧЕНИЯ МЕТОДА", "1) Взвешенный ГИ — оценка, а не лабораторное измерение: белок, жир, кислота и клетчатка в блюде обычно снижают реальный гликемический ответ, поэтому расчёт консервативен (завышает). 2) Способ приготовления меняет ГИ (паста al dente, остывший картофель, замачивание овсянки) — учтено выбором значений для типичной формы. 3) Разброс между источниками ±10–15 пунктов — это нормально. Перед публикацией сверить таблицу Ingredients с выбранным источником (см. README проекта, раздел Data source)."),
 ("", ""),
 ("КОЛОНКИ", ""),
 ("id", "Уникальный ключ DB-0001…DB-1000."),
 ("name / category / cuisine", "Название (англ., для рынка США), категория (Breakfast, Salad, Soup & Stew, Poultry, Beef Pork & Lamb, Seafood, Vegetarian & Vegan, Snack & Appetizer, Side Dish, Dessert, Drinks & Smoothies, Sandwiches & Wraps), кухня."),
 ("servings / prep_min / cook_min / total_min", "Число порций в рецепте (граммы в ingredients — на весь рецепт); время подготовки, готовки и общее в минутах."),
 ("photo_file / photo_keywords / photo_url", "photo_file — имя файла изображения (slug названия) для папки картинок приложения. photo_keywords — запрос для стока (Unsplash/Pexels) или генерации. photo_url — пусто, заполняется при загрузке фото. Фотографии в файл не встроены — см. сопроводительное сообщение."),
 ("ingredients", "Список для отображения: название — граммы (унции) [пояснение в штуках, если есть]. Граммы на ВЕСЬ рецепт."),
 ("ingredients_json", "Тот же список в JSON для импорта в приложение: ingredient_id ссылается на лист Ingredients."),
 ("kcal … net_carbs_g", "БЖУ и клетчатка на 1 порцию."),
 ("diet_tags", "Автоматически из состава: vegan / vegetarian / pescatarian / gluten-free / dairy-free / nut-free / low-carb (≤15 г net) / high-protein (≥25 г) / high-fiber (≥7 г) + ручные метки (quick, make-ahead, one-pan, meal-prep, omega-3 …). Овёс считается содержащим глютен (риск контаминации)."),
 ("instructions / steps_json", "Рецепт по шагам: текстом (нумерованный) и в JSON-массиве."),
 ("", ""),
 ("Листы", "Recipes — база; Ingredients — справочник (ключ ingredient_id); Summary — сводка по категориям (живые формулы); Methodology — этот лист."),
 ("Источники", "USDA FoodData Central: https://fdc.nal.usda.gov/ | Atkinson FS, Brand-Miller JC et al. International tables of glycemic index and glycemic load values 2021. Am J Clin Nutr 2021;114:1625–32 | University of Sydney GI Database: https://glycemicindex.com | Wolever TMS, Jenkins DJA. The use of the glycemic index in predicting the blood glucose response to mixed meals. Am J Clin Nutr 1986;43:167–72."),
]
for a, b in legend:
    wm.append([a, b])
for row in wm.iter_rows():
    row[0].font = Font(name=FONT, bold=True, size=10); row[1].font = body_font
    row[0].alignment = Alignment(vertical="top", wrap_text=True); row[1].alignment = Alignment(vertical="top", wrap_text=True)
wm["A1"].font = Font(name=FONT, bold=True, size=14)

wb.save(OUT_XLSX)
print("saved", OUT_XLSX, OUT_JSON, OUT_CSV)
# quick stats
import statistics
gis = [r["glycemic_index"] for r in rows if r["net_carbs_g"] >= 5]
print("recipes:", len(rows), "| categories:", {c: sum(1 for r in rows if r["category"]==c) for c in cats})
print("GI (dishes with >=5g net carbs): mean", round(statistics.mean(gis)), "| low", sum(1 for r in rows if r["gi_category"]=="low"), "medium", sum(1 for r in rows if r["gi_category"]=="medium"), "high", sum(1 for r in rows if r["gi_category"]=="high"))
print("GL: low", sum(1 for r in rows if r["gl_category"]=="low"), "medium", sum(1 for r in rows if r["gl_category"]=="medium"), "high", sum(1 for r in rows if r["gl_category"]=="high"))
print("kcal range", min(r["kcal"] for r in rows), max(r["kcal"] for r in rows))
hi = [(r["name"], r["glycemic_index"], r["net_carbs_g"], r["glycemic_load"]) for r in rows if r["gi_category"]=="high" or r["gl_category"]=="high"]
print("HIGH GI/GL:", hi)
