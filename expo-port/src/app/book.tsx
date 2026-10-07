import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Body, Button, Chip, Glass, Headline, Label, tap } from '../components/ui';
import { BOOKING_TIMES, term } from '../lib/extra';
import { placeOf, useStore } from '../store';
import { colors, fonts } from '../theme';

export default function Book() {
  const router = useRouter();
  const { result, foodAlt, booking, book, say, acc, user } = useStore();
  const place = placeOf(result);
  const here = !!booking && booking.placeId === result && booking.foodAlt === foodAlt;
  const [size, setSize] = useState(here ? booking!.size : 2);
  const [time, setTime] = useState(here ? booking!.time : '8:00 PM');
  if (!place) return null;
  const food = place.food[foodAlt] ?? place.food[0];
  const note = size === 1 ? 'solo date, iconic' : size === 2 ? 'date night?' : size >= 6 ? 'full shabab' : 'the crew';

  return (
    <Sheet>
      <Label style={{ color: acc }}>RESERVE A TABLE</Label>
      <Headline size={24} style={{ marginTop: 6 }}>{food.name}</Headline>
      <Body style={{ color: colors.mid, marginTop: 4 }}>{place.short} · {food.price} per person</Body>

      <Label style={{ marginTop: 22, marginBottom: 10 }}>PARTY SIZE</Label>
      <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
        <Pressable onPress={() => { tap(); setSize(Math.max(1, size - 1)); }} accessibilityRole="button" accessibilityLabel="Fewer people" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: colors.white }}>−</Text></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.headline, fontSize: 26, color: colors.white }}>{size}</Text>
          <Label style={{ fontSize: 9 }}>{note.toUpperCase()}</Label>
        </View>
        <Pressable onPress={() => { tap(); setSize(Math.min(12, size + 1)); }} accessibilityRole="button" accessibilityLabel="More people" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: colors.white }}>+</Text></Pressable>
      </Glass>

      <Label style={{ marginTop: 22, marginBottom: 10 }}>TIME</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BOOKING_TIMES.map(([label, n]) => {
          const full = n === 'Full';
          const on = time === label;
          return (
            <Pressable key={label} onPress={() => { if (full) return say('9:00 is full, try another.'); tap(); setTime(label); }} accessibilityRole="button" accessibilityState={{ selected: on, disabled: full }} style={{ width: '23%', opacity: full ? 0.4 : 1 }}>
              <Glass radius={14} style={on ? { backgroundColor: acc, borderColor: acc } : undefined}>
                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: on ? '#0E0A12' : colors.white }}>{label.replace(' PM', '')}</Text>
                  <Text style={{ fontFamily: fonts.label, fontSize: 8, color: on ? '#0E0A12' : colors.mid, marginTop: 2, minHeight: 10 }}>{n.toUpperCase()}</Text>
                </View>
              </Glass>
            </Pressable>
          );
        })}
      </View>

      <Button label={here ? 'Update booking' : `Book for ${size} at ${time.replace(' PM', '')}`} accent={acc} style={{ marginTop: 24 }}
        onPress={() => { book({ placeId: place.id, foodAlt, size, time }); say(`Booked, ${term(user?.g)}! Table for ${size} at ${time} ✓`); router.back(); }} />
      {here && <Button label="Cancel booking" variant="glass" accent={acc} style={{ marginTop: 10 }} onPress={() => { book(null); say('Booking cancelled. No worries.'); router.back(); }} />}
      <Body style={{ color: colors.dim, fontSize: 12, marginTop: 14, textAlign: 'center' }}>Requests go to the venue; availability is simulated until booking is connected.</Body>
    </Sheet>
  );
}
