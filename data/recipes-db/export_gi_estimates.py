"""The ingredients whose glycemic index is an estimate (#99): confidence "low" in gi_sources.py, the GI of the closest
tested food rather than a measurement of this one. Writes gi_estimates.json, which the engine and the menu build read
so that a receipt and a recipe can say "GI estimated". Run after gi_sources.py changes; changes nothing else.

A placeholder (a non-starchy vegetable, a herb) is not listed: its carbohydrate is too small for the GI to matter,
and the load is what DiaBite judges by."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from gi_sources import GI_SOURCE
from ingredients import ING

ids = sorted(k for k, v in GI_SOURCE.items() if v.get("confidence") == "low" and k in ING)
out = {"rule": "confidence 'low' in gi_sources.py", "ids": ids}
with open(os.path.join(os.path.dirname(__file__), "gi_estimates.json"), "w") as f:
    json.dump(out, f, indent=1)
    f.write("\n")
print(f"{len(ids)} ingredients with an estimated GI")
