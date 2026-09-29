import json, sys, glob
from ingredients import ING
names=set(); n=0; bad=0
for f in sorted(glob.glob("recipes_*.jsonl")):
    for i,line in enumerate(open(f),1):
        line=line.strip()
        if not line: continue
        try: r=json.loads(line)
        except Exception as e: print(f"{f}:{i} JSON error {e}"); bad+=1; continue
        n+=1
        for k in ("name","cat","cuisine","servings","prep","cook","ing","steps"):
            if k not in r: print(f"{f}:{i} missing {k} in {r.get('name')}"); bad+=1
        if r["name"] in names: print(f"{f}:{i} DUPLICATE name {r['name']}"); bad+=1
        names.add(r["name"])
        for it in r["ing"]:
            if it[0] not in ING: print(f"{f}:{i} unknown ingredient '{it[0]}' in {r['name']}"); bad+=1
        if len(r["steps"])<2: print(f"{f}:{i} too few steps {r['name']}"); bad+=1
print(f"{n} recipes, {bad} problems")
