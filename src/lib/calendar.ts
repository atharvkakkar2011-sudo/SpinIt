import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

/** Adds tonight's plan (6:30 PM, 4h) to the default calendar. Returns false if unavailable or denied. */
export async function addNightToCalendar(title: string, location: string, notes: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return false;
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const cal = cals.find((c) => c.allowsModifications && (c.isPrimary || c.source?.name === 'Default')) ?? cals.find((c) => c.allowsModifications);
    if (!cal) return false;
    const start = new Date();
    start.setHours(18, 30, 0, 0);
    await Calendar.createEventAsync(cal.id, { title, location, notes, startDate: start, endDate: new Date(start.getTime() + 4 * 3600e3) });
    return true;
  } catch {
    return false;
  }
}
