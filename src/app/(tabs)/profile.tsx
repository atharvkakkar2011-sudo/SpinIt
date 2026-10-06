import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Glass, Headline, Label, tap } from '../../components/ui';
import { placeById } from '../../data/places';
import { useStore } from '../../store';
import { ACCENTS, colors, fonts } from '../../theme';

const REACTIONS = ['😐', '🙂', '😄', '🤩', '🔥'];

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <Glass radius={18} style={{ flex: 1, padding: 14, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.headline, fontSize: 24, color: colors.white }}>{n}</Text>
      <Label style={{ marginTop: 4, fontSize: 9 }}>{label}</Label>
    </Glass>
  );
}

function SettingRow({ label, value, onChange, acc }: { label: string; value: boolean; onChange: (v: boolean) => void; acc: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: acc, false: colors.disabled }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const s = useStore();
  const used = s.deals.filter((d) => d.used).length;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 20, paddingBottom: 140 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Image source={require('../../../assets/images/sp-avatar.png')} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: s.acc }} />
        <View style={{ flex: 1 }}>
          <Headline size={24}>You</Headline>
          <Body style={{ color: colors.mid, fontSize: 14 }}>Spins with {s.wheelName} {s.emoji}</Body>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Stat n={s.history.length} label="SPINS" />
        <Stat n={s.evenings.length} label="NIGHTS KEPT" />
        <Stat n={used} label="BONUSES USED" />
      </View>

      <Label style={{ marginTop: 28, marginBottom: 10 }}>BONUS WALLET</Label>
      {s.deals.length === 0 ? (
        <Body style={{ color: colors.mid }}>Spin to unlock a bonus at every spot you land on.</Body>
      ) : (
        <View style={{ gap: 8 }}>
          {s.deals.map((d) => {
            const p = placeById(d.placeId);
            if (!p) return null;
            return (
              <Pressable key={d.placeId} onPress={() => { tap(); s.toggleDeal(d.placeId); }} accessibilityRole="button" accessibilityLabel={`${p.deal.title}, ${d.used ? 'used' : 'unused'}`}>
                <Glass radius={16} style={{ padding: 14, opacity: d.used ? 0.5 : 1, borderStyle: 'dashed' }}>
                  <Label style={{ color: s.acc }}>{p.deal.code}{d.used ? ' · USED' : ''}</Label>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white, marginTop: 4, textDecorationLine: d.used ? 'line-through' : 'none' }}>{p.deal.title}</Text>
                </Glass>
              </Pressable>
            );
          })}
        </View>
      )}

      <Label style={{ marginTop: 28, marginBottom: 10 }}>HISTORY</Label>
      {s.history.length === 0 ? (
        <Body style={{ color: colors.mid }}>No spins yet. The wheel is waiting.</Body>
      ) : (
        <View style={{ gap: 8 }}>
          {s.history.slice(0, 8).map((h, i) => {
            const p = placeById(h.placeId);
            if (!p) return null;
            return (
              <Glass key={`${h.at}-${i}`} radius={16} style={{ padding: 14 }}>
                <Pressable onPress={() => { tap(); router.push(`/place/${p.id}`); }} accessibilityRole="button">
                  <Text style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.5, color: colors.white }}>{p.short}</Text>
                  <Label style={{ marginTop: 4, fontSize: 9 }}>{h.mode.toUpperCase()} · {new Date(h.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}</Label>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }} accessibilityLabel="Rate this night">
                  {REACTIONS.map((r, k) => (
                    <Pressable key={r} onPress={() => { tap(); s.rate(i, k + 1); }} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Rate ${k + 1} of 5`} accessibilityState={{ selected: h.rating === k + 1 }}
                      style={{ opacity: h.rating == null || h.rating === k + 1 ? 1 : 0.35, padding: 4 }}>
                      <Text style={{ fontSize: 20 }}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </Glass>
            );
          })}
        </View>
      )}

      <Label style={{ marginTop: 28, marginBottom: 10 }}>THEME</Label>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {ACCENTS.map((c) => (
          <Pressable key={c} onPress={() => { tap(); s.setWheelStyle({ acc: c }); }} accessibilityRole="button" accessibilityLabel={`Accent ${c}`} accessibilityState={{ selected: s.acc === c }}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: s.acc === c ? 3 : 0, borderColor: '#fff' }} />
        ))}
      </View>

      <Label style={{ marginTop: 28, marginBottom: 4 }}>SETTINGS</Label>
      <SettingRow label="Calm mode (no confetti or trippy)" value={s.calm} onChange={s.setCalm} acc={s.acc} />
      <SettingRow label="3-spin nightly limit" value={s.limitOn} onChange={s.setLimit} acc={s.acc} />
      <Pressable onPress={() => { tap(); router.push('/edit-wheel'); }} accessibilityRole="button" style={{ paddingVertical: 12 }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: s.acc }}>Customise your wheel →</Text>
      </Pressable>
    </ScrollView>
  );
}
