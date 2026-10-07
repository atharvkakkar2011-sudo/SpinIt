// The prototype addresses places by their position in its list (6 originals, then the 28 from the
// spreadsheet). The database uses stable text ids. This is the single translation point.
import places from '../../supabase/seed-src/places.json';

export const PLACE_IDS = places.map((p) => p.id);
export const idxOf = (id) => PLACE_IDS.indexOf(id);
export const idOf = (i) => PLACE_IDS[i];
export const placeShort = (i) => places[i]?.short ?? '';
export const placeName = (i) => places[i]?.name ?? '';
export const dealTitle = (i) => places[i]?.deal?.title ?? '';
