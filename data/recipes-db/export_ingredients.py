"""Export the ingredient master table to JSON for the engine service.
Run: python3 data/recipes-db/export_ingredients.py
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from ingredients import ING  # noqa: E402

out = []
for key, (name, kcal, protein, fat, carbs, fiber, gi, group) in ING.items():
    out.append({
        "id": key, "name": name, "group": group,
        "per100": {"kcal": kcal, "protein": protein, "fat": fat, "carbs": carbs, "fiber": fiber},
        "gi": gi,
    })
path = pathlib.Path(__file__).parent / "ingredients.json"
path.write_text(json.dumps(out, indent=1, ensure_ascii=False))
print(f"wrote {path.name}: {len(out)} ingredients")
