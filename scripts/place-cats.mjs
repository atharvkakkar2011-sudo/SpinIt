// Explore categories (the chips under the search box). Worked out from each place's own data so new
// places sort themselves: category (Restaurant / Café / Dessert / Spot / Activity / Trip), the indoor
// flag, and a few keywords in the name and description. A place can be in several categories.
export const CATEGORIES = ['Restaurants', 'Outdoor', 'Indoor', 'Coffee shops', 'Entertainment', 'Fitness', 'Culture'];

const FOOD = new Set(['Restaurant', 'Café', 'Dessert']);
// activities are matched in the name and description; parks and landmarks by name only, so a mall
// "beside Aspire Park" or a promenade "under the Katara Towers" doesn't count
const FITNESS = /\b(golf|kayak\w*|padel|gym|fitness|climb\w*|cycl\w*|running|jogging|yoga|surf\w*|div(e|ing))\b/i;
const FITNESS_NAME = /aspire park|oxygen park/i;
const CULTURE = /museum|mosque|library|heritage|galler(y|ies)|cultural/i;
const CULTURE_NAME = /souq|katara|\bfort\b/i;
const ENTERTAINMENT = /mall|galleria|printemps|city cent|festival city|place vend|villaggio|cinema|theme park|bowling|arcade|karting|escape room|\bvr\b|kidzania|snow|water park|waterslide/i;

export function placeCategories(p) {
  const text = `${p.name} ${p.about || ''}`;
  const fit = FITNESS.test(text) || FITNESS_NAME.test(p.name);
  const cats = [];
  if (p.category === 'Restaurant') cats.push('Restaurants');
  if (p.category === 'Café' || p.category === 'Dessert' || (p.tags || []).includes('Coffee') && FOOD.has(p.category)) cats.push('Coffee shops');
  if (!FOOD.has(p.category)) cats.push(p.indoor ? 'Indoor' : 'Outdoor');
  if (fit) cats.push('Fitness');
  if (p.category === 'Activity' && !fit || ENTERTAINMENT.test(text) && !FOOD.has(p.category)) cats.push('Entertainment');
  if (!FOOD.has(p.category) && ((p.tags || []).includes('Culture') || CULTURE.test(text) || CULTURE_NAME.test(p.name))) cats.push('Culture');
  return [...new Set(cats)];
}

export function categoryMap(places) {
  return Object.fromEntries(places.map((p) => [p.id, placeCategories(p)]));
}
