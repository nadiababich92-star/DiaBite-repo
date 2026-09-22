"""Cross-check ingredients.py GI values against the University of Sydney GI database (sydney_gi_db.json)."""
import json, re, statistics
from ingredients import ING
db = json.load(open("sydney_gi_db.json"))["rows"]
def find(pat, excl=None):
    rx = re.compile(pat, re.I); ex = re.compile(excl, re.I) if excl else None
    hits = [r for r in db if rx.search(r["food"]) and not (ex and ex.search(r["food"])) and r["gi"].strip().isdigit()]
    return hits
# key -> (regex include, regex exclude)
P = {
 "greek_yogurt": (r"yogh?urt.*(greek|natural|plain|unsweetened)", r"sweet|fruit|flavou?r|drink"),
 "milk": (r"^(cow'?s? )?milk, ?(full|reduced|low|skim|2%|whole)", r"chocolate|flavou?r|condensed|soy|rice|almond|oat|goat"),
 "kefir": (r"kefir", None),
 "soy_milk": (r"soy ?milk|soya milk", r"chocolate|flavou?r"),
 "almond_milk": (r"almond milk", None),
 "lentils": (r"lentils?,? (green|brown|boiled|cooked)|^lentils", r"red|soup|canned|pasta|flour"),
 "red_lentils": (r"lentils?,? red|red lentil", r"pasta|flour"),
 "chickpeas": (r"chick ?peas?", r"flour|pasta|hummus|falafel|roasted|snack"),
 "black_beans": (r"black beans?", r"soup|sauce"),
 "kidney_beans": (r"kidney beans?", r"canned"),
 "pinto_beans": (r"pinto", None),
 "white_beans": (r"cannellini|haricot|white beans?", None),
 "navy_beans": (r"navy beans?|haricot", None),
 "lima_beans": (r"lima|butter beans?", None),
 "black_eyed_peas": (r"black-?eyed", None),
 "split_peas": (r"split peas?", r"soup"),
 "hummus": (r"hummus", None),
 "edamame": (r"edamame|soy ?beans?, ?(boiled|cooked)", None),
 "quinoa": (r"quinoa", r"flake|puff|pasta|bread"),
 "brown_rice": (r"rice, brown|brown rice", r"puff|cake|pasta|noodle|flour|cracker|milk|bran"),
 "wild_rice": (r"wild rice", None),
 "barley": (r"barley, pearl|pearl(ed)? barley", r"flour|bread|flake"),
 "farro": (r"farro|emmer|spelt.*(grain|kernel|boiled)", r"bread|pasta|flour"),
 "bulgur": (r"bulgh?ur|burghul", None),
 "buckwheat": (r"buckwheat", r"noodle|soba|bread|pancake|flour"),
 "rolled_oats": (r"porridge|oats?, rolled|rolled oats|oatmeal", r"instant|quick|bar|cookie|bread|muffin"),
 "steel_cut_oats": (r"steel.?cut|oats, whole|coarse oat", None),
 "oat_bran": (r"oat bran", r"bread|cereal|bar"),
 "whole_wheat_pasta": (r"(whole ?meal|whole ?wheat|wholegrain).*(spaghetti|pasta|penne|macaroni)", None),
 "chickpea_pasta": (r"chickpea (pasta|penne|spaghetti)|pasta.*chickpea", None),
 "lentil_pasta": (r"lentil (pasta|penne|spaghetti)|pasta.*lentil", None),
 "soba": (r"soba", None),
 "whole_grain_bread": (r"(whole ?meal|whole ?wheat|whole ?grain) bread|bread, whole", r"rye|barley|oat|sourdough|fruit"),
 "ezekiel_bread": (r"sprouted|ezekiel", None),
 "rye_bread": (r"pumpernickel|rye bread|bread, rye|rye kernel", r"crisp|cracker"),
 "corn_tortilla": (r"corn tortilla|tortilla, corn", None),
 "whole_wheat_pita": (r"pita|pitta", r"white"),
 "whole_wheat_english_muffin": (r"english muffin", None),
 "popcorn": (r"popcorn", None),
 "sweet_potato": (r"sweet potato", r"chips|fries|crisp"),
 "new_potato": (r"potato.*(new|baby|cooled|cold)|new potato", r"sweet|chips|fries|mash|instant"),
 "carrot": (r"carrots?", r"juice|cake|soup"),
 "beet": (r"beetroot|beets?", r"juice|sugar"),
 "corn": (r"sweet ?corn|corn, sweet|corn on the cob", r"chips|flakes|bread|tortilla|starch|syrup|pop"),
 "green_peas": (r"^peas?, (green|frozen|boiled)|green peas", r"split|chick|snow|sugar"),
 "butternut_squash": (r"butternut|pumpkin", r"seed|bread|soup|pie"),
 "pumpkin_puree": (r"pumpkin", r"seed|bread|soup|pie"),
 "turnip": (r"turnip|swede|rutabaga", None),
 "okra": (r"okra", None),
 "water_chestnuts": (r"water chestnut", None),
 "apple": (r"^apple,? (raw|fresh)|^apples?$|^apple, golden|^apple, braeburn|^apple, gala|apple, granny|apple, red", r"juice|dried|sauce|pie|cake|cider"),
 "pear": (r"^pears?", r"juice|canned|dried|cake"),
 "orange": (r"^oranges?", r"juice|marmalade|cordial|drink"),
 "grapefruit": (r"grapefruit", r"juice"),
 "peach": (r"^peach", r"canned|juice|dried"),
 "plum": (r"^plums?", r"dried|prune"),
 "cherries": (r"cherries|^cherry", r"juice|dried|tomato|jam"),
 "kiwi": (r"kiwi", None),
 "banana": (r"^banana", r"bread|cake|chips|dried|smoothie|milk"),
 "mango": (r"^mango", r"juice|dried|smoothie|lassi"),
 "pineapple": (r"^pineapple", r"juice|canned|dried"),
 "pomegranate": (r"pomegranate", r"juice"),
 "cranberries": (r"cranberr", r"juice|dried|sauce"),
 "applesauce": (r"apple ?sauce|apple, puree", None),
 "dates": (r"^dates?", r"syrup"),
 "blueberries": (r"blueberr", r"muffin|juice|jam"),
 "strawberries": (r"strawberr", r"jam|juice|yogh?urt|milk|smoothie"),
 "raspberries": (r"raspberr", r"jam|juice"),
 "blackberries": (r"blackberr", r"jam|juice"),
 "honey": (r"^honey", r"cake|bread|cereal|snack|bar|loop|nut|oat|weet"),
 "maple_syrup": (r"maple syrup", None),
 "dark_chocolate": (r"chocolate, dark|dark chocolate", r"milk|bar\b.*milk|ice cream|cake|cookie"),
 "cocoa_powder": (r"cocoa", r"drink|milk|cake|pop|puff"),
 "coconut_milk": (r"coconut milk", None),
 "tofu": (r"tofu", None),
 "peanuts": (r"^peanuts?", r"butter|bar|snack|brittle"),
 "cashews": (r"cashew", None),
 "sesame_seeds": (r"sesame", r"bar|snap"),
 "tahini": (r"tahini", None),
 "tomato_sauce": (r"tomato (sauce|soup|puree|paste)", r"pasta.*sauce|ketchup"),
 "salsa": (r"salsa", None),
 "balsamic_vinegar": (r"vinegar", None),
 "gochujang": (r"gochujang", None),
 "miso": (r"miso", None),
 "coconut_flour": (r"coconut flour", None),
 "almond_flour": (r"almond (flour|meal)", None),
 "arrowroot": (r"arrowroot", None),
 "sugar_free_chocolate_chips": (r"chocolate.*(sugar.?free|stevia|no added sugar)", None),
}
report = []
for key, (inc, exc) in P.items():
    if key not in ING: print("no such key", key); continue
    hits = find(inc, exc)
    gis = [int(r["gi"]) for r in hits]
    ours = ING[key][6]
    if gis:
        med = statistics.median(gis); mean = round(statistics.mean(gis))
        flag = "" if abs(ours - med) <= 10 else ("HIGHER in our table" if ours > med else "LOWER in our table")
        report.append((key, ours, len(gis), med, mean, min(gis), max(gis), flag, hits[0]["food"][:70]))
    else:
        report.append((key, ours, 0, None, None, None, None, "NO MATCH", ""))
print(f"{'key':28}{'ours':>5}{'n':>5}{'med':>6}{'mean':>6}{'min':>5}{'max':>5}  flag / example")
for r in report:
    print(f"{r[0]:28}{r[1]:>5}{r[2]:>5}{str(r[3]):>6}{str(r[4]):>6}{str(r[5]):>5}{str(r[6]):>5}  {r[7]}  | {r[8]}")
json.dump([dict(zip(["key","ours","n","median","mean","min","max","flag","example"], r)) for r in report], open("gi_crosscheck.json","w"), indent=1)
