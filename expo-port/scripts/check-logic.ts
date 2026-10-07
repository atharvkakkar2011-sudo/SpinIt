import assert from 'node:assert/strict';
import { PLACES } from '../src/data/places';
import { budgetLabel, defaultFilters, nightKey, sliceAtRotation, targetRotation, wheelList } from '../src/lib/logic';
import { localReply, okEmail, passStrength, placesIn, routeFor } from '../src/lib/extra';

// 34 places, unique ids, every place has two food + two dessert options and a deal.
assert.equal(PLACES.length, 34);
assert.equal(new Set(PLACES.map((p) => p.id)).size, 34);
for (const p of PLACES) {
  assert.ok(p.food.length >= 2 && p.dessert.length >= 2, p.id);
  assert.ok(p.deal.code && p.photos.length >= 1, p.id);
}

// The wheel lands on exactly the slice we asked for, for any wheel size and start rotation.
for (const n of [2, 3, 6, 11, 34]) {
  for (const cur of [0, 123.4, 1800, -75]) {
    for (let k = 0; k < n; k++) {
      assert.equal(sliceAtRotation(targetRotation(cur, k, n), n), k, `n=${n} cur=${cur} k=${k}`);
    }
  }
}

// Filters
assert.equal(wheelList(PLACES, {}, defaultFilters).length, 34);
assert.ok(wheelList(PLACES, { katara: false }, defaultFilters).every((p) => p.id !== 'katara'));
assert.ok(wheelList(PLACES, {}, { ...defaultFilters, cool: true }).every((p) => p.indoor));
assert.ok(wheelList(PLACES, {}, { ...defaultFilters, mood: 'Romantic' }).every((p) => p.moods.includes('Romantic')));

// Night rolls at 6 PM.
const d = (h: number) => new Date(2026, 9, 6, h, 0).getTime();
assert.equal(nightKey(d(17)), nightKey(d(3)));
assert.notEqual(nightKey(d(17)), nightKey(d(19)));
// Budget copy matches the prototype.
assert.equal(budgetLabel(0, 60), 'broke era');
assert.equal(budgetLabel(50, 150), 'balanced queen');
assert.equal(budgetLabel(150, 400), 'bougie mode');
assert.equal(budgetLabel(0, 400), 'no limits');

// Auth validation helpers.
assert.ok(okEmail('a@b.co') && !okEmail('a@b') && !okEmail('nope'));
assert.deepEqual(['', 'abc', 'abcdef', 'abcdefghi', 'abcdefgh1'].map(passStrength), [0, 1, 2, 3, 4]);

// Route map: three pins inside the frame for every place, two legs.
PLACES.forEach((p, i) => {
  const r = routeFor(p, i);
  assert.equal(r.pts.length, 3);
  assert.equal(r.legs.length, 2);
  assert.ok(r.totalMins > 0);
});

// Local AI only recommends real places, and respects "romantic".
const reply = localReply('Date night under QAR 150, make it cute', { ratings: [] });
const named = placesIn(reply);
assert.ok(named.length >= 1 && named.every((p) => p.moods.includes('Romantic')));
console.log('logic ok');
