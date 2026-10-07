import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Body, Button, Glass, Headline, Label, RoundButton, tap } from '../components/ui';
import { photoSource } from '../data/photos';
import { MOODS, type Mood } from '../data/places';
import { whatsappUrl } from '../lib/plan';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

interface Member { name: string; initial: string; av: string; vote: Mood | null; justJoined?: boolean }
const CODE = 'SPIN-4821';
// Simulated friends until the realtime backend exists (BACKEND.md §2).
const FRIENDS: [string, string, string, Mood, number][] = [
  ['Noor', 'N', '#F5EEF6', 'Romantic', 1100], ['Omar', 'O', '#9C8FA4', 'Chill', 2600], ['Lulwa', 'L', '#FFB23D', 'Adventurous', 4300],
];

export default function Squad() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { acc, user, filters, say, setFilters, patch } = useStore();
  const [members, setMembers] = useState<Member[]>([{ name: 'You', initial: (user?.name ?? 'A')[0].toUpperCase(), av: acc, vote: filters.mood ?? 'Chill' }]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    FRIENDS.forEach(([name, initial, av, vote, t]) => {
      timers.current.push(setTimeout(() => { setMembers((m) => [...m, { name, initial, av, vote: null, justJoined: true }]); say(`${name} pulled up 👀`); }, t));
      timers.current.push(setTimeout(() => setMembers((m) => m.map((x) => (x.name === name ? { ...x, vote, justJoined: false } : x))), t + 1300 + Math.random() * 900));
    });
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, [say]);

  const tally = MOODS.map((m) => ({ m, n: members.filter((x) => x.vote === m).length }));
  const voted = members.filter((x) => x.vote).length;
  const leading = [...tally].sort((a, b) => b.n - a.n)[0];
  const url = `https://spinit.app/s/${CODE.split('-')[1]}`;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop source={photoSource('souq-1')} dim={0.82} />
      <ScrollView contentContainerStyle={{ paddingTop: top + 8, paddingHorizontal: 20, paddingBottom: bottom + 30 }}>
        <RoundButton glyph="‹" label="Back" onPress={() => router.back()} />
        <Headline size={32} style={{ marginTop: 18 }}>Squad spin.</Headline>
        <Body style={{ color: colors.mid, marginTop: 6 }}>Everyone votes a vibe. The majority drives the wheel.</Body>

        <View style={{ marginTop: 20, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: acc, padding: 18, backgroundColor: acc + '14', alignItems: 'center' }}>
          <Label style={{ color: acc }}>YOUR CODE</Label>
          <Text selectable style={{ fontFamily: fonts.headline, fontSize: 30, letterSpacing: -0.5, color: colors.white, marginTop: 6 }}>{CODE}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button label="Copy" variant="glass" accent={acc} style={{ width: 110 }} onPress={async () => { await Clipboard.setStringAsync(CODE); say('Code copied, shabab'); }} />
            <Button label="Share" variant="glass" accent={acc} style={{ width: 110 }} onPress={() => Share.share({ message: `Vote for tonight 🎡 ${url} (code ${CODE})` })} />
          </View>
          <Pressable onPress={() => { tap(); Linking.openURL(whatsappUrl(`Shabab, vote for tonight 🎡 Tap to pick your vibe, the wheel decides: ${url}`)).catch(() => say('Couldn’t open WhatsApp.')); }} accessibilityRole="button" style={{ marginTop: 14 }}>
            <Text style={{ fontFamily: fonts.bodySemi, color: acc }}>Send the vote link on WhatsApp →</Text>
          </Pressable>
        </View>

        <Label style={{ marginTop: 26, marginBottom: 10 }}>THE SHABAB · {members.length}</Label>
        <View style={{ gap: 8 }}>
          {members.map((m, k) => (
            <Glass key={m.name} radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: m.av, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.headline, fontSize: 16, color: '#0E0A12' }}>{m.initial}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>{m.name}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: k === 0 || m.vote ? colors.mid : acc }}>{k === 0 ? 'Host' : m.vote ? `Voted ${m.vote}` : m.justJoined ? 'Just pulled up' : 'Thinking…'}</Text>
              </View>
              <Pressable disabled={k !== 0} onPress={() => { tap(); setMembers((ms) => ms.map((x, j) => (j === 0 ? { ...x, vote: MOODS[(MOODS.indexOf(x.vote ?? 'Chill') + 1) % 4] } : x))); }} accessibilityRole="button" accessibilityLabel={k === 0 ? 'Change your vote' : `${m.name}'s vote`}>
                <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: m.vote ? acc : 'rgba(255,255,255,0.22)', backgroundColor: k === 0 && m.vote ? acc : 'transparent', paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: k === 0 && m.vote ? '#0E0A12' : colors.white }}>{m.vote ?? '…'}</Text>
                </View>
              </Pressable>
            </Glass>
          ))}
        </View>
        {members.length < 4 && <Label style={{ marginTop: 12 }}>WAITING FOR THE SHABAB… {4 - members.length} MORE INVITED</Label>}

        <Label style={{ marginTop: 26, marginBottom: 10 }}>LIVE VOTES</Label>
        <View style={{ gap: 10 }}>
          {tally.map(({ m, n }) => (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ width: 96, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.offWhite }}>{m}</Text>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <View style={{ width: `${(n / Math.max(1, voted)) * 100}%`, height: '100%', backgroundColor: acc }} />
              </View>
              <Text style={{ width: 16, fontFamily: fonts.label, fontSize: 12, color: colors.mid }}>{n}</Text>
            </View>
          ))}
        </View>

        <Button label={`Spin for the squad · ${leading.n ? leading.m : '…'}`} accent={acc} disabled={!voted} style={{ marginTop: 28 }}
          onPress={() => { setFilters({ mood: leading.m }); patch({ who: 'Friends', squadUsed: true, autoSpin: true }); router.dismissTo('/spin'); }} />
      </ScrollView>
    </View>
  );
}
