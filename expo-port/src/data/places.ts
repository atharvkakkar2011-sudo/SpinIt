import raw from './places.json';

export type Mood = 'Chill' | 'Romantic' | 'Adventurous' | 'Family';
export const MOODS: Mood[] = ['Chill', 'Romantic', 'Adventurous', 'Family'];

export interface MenuItem {
  tag: string;
  name: string;
  note: string;
  price: string;
}

export interface Place {
  id: string;
  name: string;
  short: string;
  area: string;
  vibe: string;
  tags: string[];
  moods: Mood[];
  /** 1 = cheap, 3 = splurge */
  budget: 1 | 2 | 3;
  photos: string[];
  about: string;
  hours: string;
  price: string;
  best: string;
  food: MenuItem[];
  dessert: MenuItem[];
  deal: { title: string; code: string };
  lat: number | null;
  lng: number | null;
  indoor: boolean;
  category: string;
  insta?: string;
  web?: string;
  credit?: string;
}

export const PLACES = raw as unknown as Place[];

export const placeById = (id: string): Place | undefined => PLACES.find((p) => p.id === id);

export const CHIPS = ['Food', 'Coffee', 'Culture', 'Outdoors'] as const;

export const googleMapsUrl = (p: Place) =>
  p.lat != null && p.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' Doha')}`;
