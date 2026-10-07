import { LOCAL_PHOTOS } from './localPhotos';
import type { Place } from './places';

/** Local bundled photo name ('katara-2') or remote URL → an expo-image source. */
export function photoSource(photo: string): number | { uri: string } {
  return LOCAL_PHOTOS[photo] ?? { uri: photo };
}

export const coverPhoto = (p: Place) => photoSource(p.photos[0]);

const SP_AVATAR = require('../../assets/images/sp-avatar.png');
/** Avatar id: 'sp-avatar' (default) or the name of a bundled place photo. */
export const avatarSource = (id?: string) => (!id || id === 'sp-avatar' ? SP_AVATAR : photoSource(id));
