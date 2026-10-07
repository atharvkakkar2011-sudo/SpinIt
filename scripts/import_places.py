"""Add places from a spreadsheet in the Doha_Night_Out_Places.xlsx format to the app.

    python3 scripts/import_places.py docs/design/Doha_120_New_Places.xlsx

Appends new ids to supabase/seed-src/places.json (existing ids are left as they are, so the app's
place order never shifts) and their opening hours to supabase/seed-src/hours.json. Gaps are filled
with the same rules the design used for its 28 spreadsheet places:
  food/dessert  spreadsheet names ("Name — Branch" -> "Name"), else "Food nearby" / "Something sweet nearby"
  bonus         "10% off with SpinIt", code = first 8 letters/digits of the id + "-10"
  budget tier   from budget_per_person_qar (<=60 -> 1, <=150 -> 2, else 3), else by category
  price/hours   spreadsheet text, else "Price varies" / "Check before you go"
Then run `node scripts/gen-seed.mjs` and `npm run build:www`.
"""
import json
import re
import sys

import openpyxl

PLACES = 'supabase/seed-src/places.json'
HOURS = 'supabase/seed-src/hours.json'
TIER_BY_CATEGORY = {'Restaurant': 3, 'Trip': 3, 'Spot': 2, 'Activity': 2, 'Café': 1, 'Dessert': 1}


def clean_name(n):
    return re.split(r'\s+[—–]\s+', str(n).strip())[0]


def tag_of(n):
    return ' '.join(clean_name(n).split()[:2])


def price(p):
    return f'QAR {p}' if p not in (None, '') else 'Price varies'


def tier(r):
    b = r['budget_per_person_qar']
    if isinstance(b, (int, float)):
        return 1 if b <= 60 else 2 if b <= 150 else 3
    return TIER_BY_CATEGORY.get(r['category'], 2)


def tags(r, has_food):
    cat, text = r['category'], f"{r['name']} {r['about'] or ''}".lower()
    if cat in ('Restaurant', 'Dessert'):
        return ['Food']
    if cat == 'Café':
        return ['Coffee', 'Food'] if has_food else ['Coffee']
    if cat in ('Trip', 'Activity'):
        return ['Outdoors']
    out = []
    if re.search(r'museum|gallery|library|heritage|souq|fort|mosque|art|cultur', text):
        out.append('Culture')
    if re.search(r'beach|park|island|promenade|corniche|garden|marina|walk|dunes|sea', text):
        out.append('Outdoors')
    if re.search(r'mall|galleria|plaza|market|restaurant|dining|food', text) or not out:
        out.append('Food')
    return out


def food(r, short):
    nearby = {'tag': 'Nearby', 'name': 'Food nearby', 'note': f'Plenty of spots around {short}.', 'price': 'Price varies'}
    items = [{'tag': tag_of(r[f'food_{k}_name']), 'name': clean_name(r[f'food_{k}_name']), 'note': 'On-site or right nearby.', 'price': price(r[f'food_{k}_price'])}
             for k in (1, 2) if r[f'food_{k}_name']]
    if not items:
        first = {'Restaurant': {'tag': 'Dinner', 'name': short, 'note': 'Book ahead on weekends.', 'price': 'Price varies'},
                 'Café': {'tag': 'Coffee', 'name': short, 'note': 'Coffee and a little something.', 'price': 'Price varies'}}.get(
            r['category'], {'tag': 'Bites', 'name': 'Food nearby', 'note': f'Plenty of spots around {short}.', 'price': 'Price varies'})
        items = [first]
    while len(items) < 2:
        items.append(nearby)
    return items[:2]


def dessert(r, short):
    karak = {'tag': 'Karak', 'name': 'Karak to go', 'note': 'End the night on sugar.', 'price': 'Price varies'}
    items = [{'tag': tag_of(r[f'dessert_{k}_name']), 'name': clean_name(r[f'dessert_{k}_name']), 'note': 'Sweet stop to end it.', 'price': price(r[f'dessert_{k}_price'])}
             for k in (1, 2) if r[f'dessert_{k}_name']]
    if not items:
        items = [{'tag': 'Dessert', 'name': short, 'note': 'The whole point of the trip.', 'price': 'Price varies'} if r['category'] == 'Dessert'
                 else {'tag': 'Sweets', 'name': 'Something sweet nearby', 'note': 'End the night on sugar.', 'price': 'Price varies'}]
    while len(items) < 2:
        items.append(karak)
    return items[:2]


def main(path):
    places = json.load(open(PLACES, encoding='utf8'))
    hours = json.load(open(HOURS, encoding='utf8'))
    known = {p['id'] for p in places}
    codes = {p['deal']['code'] for p in places}
    ws = openpyxl.load_workbook(path, data_only=True)['Places']
    rows = list(ws.iter_rows(values_only=True))
    head = rows[0]
    added = 0
    for raw in rows[1:]:
        r = dict(zip(head, raw))
        pid = (r['id'] or '').strip()
        if not pid or pid in known:
            continue
        short = (r['short_name'] or r['name']).strip()
        base = re.sub(r'[^A-Za-z0-9]', '', pid).upper()[:8]
        code, n = f'{base}-10', 2
        while code in codes:
            code, n = f'{base}{n}-10', n + 1
        codes.add(code)
        budget = r['budget_per_person_qar']
        f = food(r, short)
        places.append({
            'id': pid, 'name': r['name'].strip(), 'short': short, 'area': r['area'] or 'Doha',
            'vibe': r['vibe'] or '', 'tags': tags(r, any(r[f'food_{k}_name'] for k in (1, 2))),
            'moods': [m.strip() for m in (r['moods'] or '').split(',') if m.strip()] or ['Chill'],
            'budget': tier(r),
            'photos': [r[k] for k in ('image_url_1', 'image_url_2', 'image_url_3') if r[k]],
            'about': r['about'] or '', 'hours': r['opening_hours'] or 'Check before you go',
            'price': r['price_label'] or ('Free to wander' if budget == 0 else 'Price varies'),
            'best': r['best_time'] or 'Evening', 'food': f, 'dessert': dessert(r, short),
            'deal': {'title': '10% off with SpinIt', 'code': code},
            'lat': r['latitude'], 'lng': r['longitude'], 'indoor': r['indoor'] == 'Yes',
            'category': r['category'] or 'Spot', 'insta': r['instagram'] or '', 'web': r['website'] or '',
            'credit': r['image_credit'] or '',
        })
        if r['opening_hours']:
            hours[pid] = r['opening_hours']
        known.add(pid)
        added += 1
    json.dump(places, open(PLACES, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    json.dump(hours, open(HOURS, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    print(f'added {added} places (now {len(places)})')


if __name__ == '__main__':
    main(sys.argv[1])
