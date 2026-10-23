// The app's look: "Desert night" – desert gold and sand on deep navy, with date-palm teal.
// The design was drawn in a neon pink / purple-black palette; every build swaps its colours through this
// map (scripts/patches.mjs → applyPatches), so the design file itself stays untouched.
// To try another look, change the right-hand values and rebuild. Keys are the design's own colours.
export const PALETTE_NAME = 'Desert night';

export const PALETTE = {
  // accent (was neon pink) and its light tint
  '#FF3D8B': '#E8B86B', '#FF7AB0': '#F5D9A8',
  // secondary neons, softened to match
  '#3DF2FF': '#7FC8C0', '#C6FF3D': '#C9D98A', '#FFB23D': '#F0A35E', '#FF7A3D': '#D9774E', '#FFE08A': '#F3DDA0',
  '#7B5CFF': '#6FA8A1', '#B03DFF': '#B5835A', '#1E8C9E': '#2F6F77',
  // background and surfaces (were purple-black), now deep navy
  '#0E0A12': '#0B1020', '#0A0710': '#080C18', '#0A060D': '#070B16', '#07050A': '#05080F', '#120D16': '#0D1324',
  '#1A1320': '#121A2E', '#1C1424': '#141C30', '#1F1726': '#161E33', '#211829': '#182036', '#271C30': '#1D2540',
  '#2C2233': '#202842', '#3A2E42': '#2A3350',
  // text greys (were lavender), now warm sand
  '#F5EEF6': '#F7F0E4', '#EDE4F0': '#EFE6D6', '#D9CEDD': '#E2D9C8', '#B9ADC0': '#BDB3A2', '#9C8FA4': '#968E80', '#7D7086': '#7A7366',
  // the same colours written as rgba(
  'rgba(14,10,18': 'rgba(11,16,32', 'rgba(14, 10, 18': 'rgba(11, 16, 32', 'rgba(10,6,13': 'rgba(7,11,22', 'rgba(10,7,16': 'rgba(8,12,24',
  'rgba(22,15,27': 'rgba(18,26,46', 'rgba(40,20,30': 'rgba(32,30,24', 'rgba(61,242,255': 'rgba(127,200,192', 'rgba(255,61,139': 'rgba(232,184,107',
  // theme names in the picker
  "'Neon pink'": "'Desert gold'", "'Acid lime'": "'Sage'", "'Ice cyan'": "'Lagoon'", "'Sunset'": "'Sunset'",
};

export function recolour(src) {
  const keys = Object.keys(PALETTE).sort((a, b) => b.length - a.length);
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  return src.replace(re, (m) => PALETTE[Object.keys(PALETTE).find((k) => k.toLowerCase() === m.toLowerCase())]);
}
