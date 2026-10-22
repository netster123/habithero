"""Baut aus der USDA-Datenbank (SR Legacy, gemeinfrei) die Nährwertdaten der App.

Aufruf: python3 -I tools/build-foods.py <Ordner mit food.csv, food_nutrient.csv>
Erzeugt:
  data/foods-de.json  – deutsche Grundliste (tools/foods-de.tsv) mit allen Nährwerten pro 100 g
  data/usda.json      – alle übrigen Lebensmittel (englische Namen) für die Suche nach fehlenden Zutaten
"""
import csv
import json
import os
import sys

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# Reihenfolge = Reihenfolge der Werte in den JSON-Dateien (siehe js/foods.js)
NUTRIENTS = [
    ('kcal', 1008), ('protein', 1003), ('carbs', 1005), ('fat', 1004), ('fiber', 1079),
    ('vitA', 1106), ('b1', 1165), ('b6', 1175), ('b12', 1178), ('folate', 1190), ('vitC', 1162),
    ('vitD', 1114), ('vitE', 1109), ('potassium', 1092), ('magnesium', 1090), ('calcium', 1087),
    ('iron', 1089), ('zinc', 1095), ('copper', 1098), ('selenium', 1103), ('iodine', 1100), ('sodium', 1093),
]
NID = {nid: i for i, (_, nid) in enumerate(NUTRIENTS)}
FOLATE_TOTAL = 1177
SKIP_CATEGORIES = {'3', '21', '24', '25', '26', '27'}  # Babynahrung, Fast Food, Restaurant, Marken, Testmaterial

foods = {}
with open(os.path.join(SRC, 'food.csv'), newline='', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        foods[row['fdc_id']] = {'desc': row['description'], 'cat': row['food_category_id'], 'v': [None] * len(NUTRIENTS)}

folate_total = {}
with open(os.path.join(SRC, 'food_nutrient.csv'), newline='', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        food = foods.get(row['fdc_id'])
        if not food:
            continue
        nid = int(row['nutrient_id'])
        if nid in NID:
            food['v'][NID[nid]] = float(row['amount'])
        elif nid == FOLATE_TOTAL:
            folate_total[row['fdc_id']] = float(row['amount'])

# Folat als Folat-Äquivalent; fehlt das, Gesamtfolat
fi = NID[1190]
for fid, food in foods.items():
    if food['v'][fi] is None and fid in folate_total:
        food['v'][fi] = folate_total[fid]


def compact(values):
    return [None if v is None else round(v, 3 if v < 1 else 1) for v in values]


SUFFIX = " (Includes foods for USDA's Food Distribution Program)"
for food in foods.values():
    food['desc'] = food['desc'].replace(SUFFIX, '')
by_desc = {}
for fid, food in foods.items():
    by_desc.setdefault(food['desc'], fid)

base, missing, used = [], [], set()
with open(os.path.join(ROOT, 'tools', 'foods-de.tsv'), encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if not line or line.startswith('#'):
            continue
        name, group, desc, *rest = line.split('\t')
        fid = by_desc.get(desc)
        if not fid:
            missing.append(f'{name}: {desc}')
            continue
        portions = {}
        for part in (rest[0] if rest else '').split(','):
            if '=' in part:
                k, g = part.split('=')
                portions[k.strip()] = float(g)
        used.add(fid)
        base.append({'id': f'u{fid}', 'name': name, 'group': group, 'src': desc, 'portions': portions, 'v': compact(foods[fid]['v'])})

if missing:
    print('NICHT GEFUNDEN:\n  ' + '\n  '.join(missing))
    sys.exit(1)

full = [[int(fid), food['desc'], int(food['cat'])] + compact(food['v'])
        for fid, food in foods.items() if food['cat'] not in SKIP_CATEGORIES and food['v'][0] is not None]

os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
meta = {'nutrients': [k for k, _ in NUTRIENTS], 'source': 'USDA FoodData Central, SR Legacy (April 2018), gemeinfrei', 'per': '100 g'}
with open(os.path.join(ROOT, 'data', 'foods-de.json'), 'w', encoding='utf-8') as f:
    json.dump({**meta, 'foods': base}, f, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(ROOT, 'data', 'usda.json'), 'w', encoding='utf-8') as f:
    json.dump({**meta, 'foods': full}, f, ensure_ascii=False, separators=(',', ':'))
print(f'Grundliste: {len(base)} Lebensmittel, Gesamtdatenbank: {len(full)} Lebensmittel')
