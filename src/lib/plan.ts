import type { Place } from '../data/places';

export function planText(p: Place, food: string, dessert: string, time = '8:00 PM'): string {
  return `Tonight we’re pulling up to ${p.short} 🎡\n6:30 PM · ${p.name}\n${time} · ${food}\n9:30 PM · ${dessert}\nNo take-backs. Spun on SpinIt → spinit.app`;
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
