import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Chip, Glass, Headline, Label, Toggle, tap } from '../../components/ui';
import { avatarSource, coverPhoto, photoSource } from '../../data/photos';
import { PLACES, placeById } from '../../data/places';
import { BADGES, eraLabel, term } from '../../lib/extra';
import { useStore } from '../../store';
import { ACCENTS, colors, fonts } from '../../theme';

type Tab = 'overview' | 'saved' | 'history';
const THEMES: [string, string][] = [['#FF3D8B', 'Neon pink'], ['#C6FF3D', 'Acid lime'], ['#3DF2FF', 'Ice cyan'], ['#FFB23D', 'Sunset']];
const REACTIONS = ['😴', '😐', '🙂', '🔥', '💯'];
const FRIENDS: [string, string, string, string][] = [['Noor', 'N', '#F5EEF6', '#C6FF3D'], ['Omar', 'O', '#9C8FA4', '#C6FF3D'], ['Lulwa', 'L', '#FFB23D', 'rgba(255,255,255,0.3)'], ['Hamad', 'H', '#3DF2FF', 'rgba(255,255,255,0.3)']];

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Label>{title}</Label>
        {right ? <Label>{right}</Label> : null}
      </View>
      {children}
    </View>
  );
}

function Row({ label, sub, value, onChange, acc }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void; acc: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>{label}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.mid }}>{sub}</Text>
      </View>
      <Toggle value={value} onValueChange={onChange} acc={acc} label={label} />
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const s = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [savedTab, setSavedTab] = useState<'places' | 'evenings'>('places');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const u = s.user;
  const t = term(u?.g);

  const counts: Record<string, number> = {};
  s.history.forEach((h) => { counts[h.placeId] = (counts[h.placeId] ?? 0) + 1; });
  const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const top1 = topId ? placeById(topId) : undefined;
  const spins = s.history.length;
  const used = s.deals.filter((d) => d.used).length;
  const streak = Math.min(7, spins);
  const badges = BADGES(spins, Object.keys(counts).length, used, s.evenings.length, s.squadUsed);
  const visited = new Set(s.history.map((h) => h.placeId));
  const spots = PLACES.filter((p) => s.saved[p.id]);

  const logout = () => { s.setUser(null); router.replace('/auth'); s.say(`Logged out. Come back soon, ${t}.`); };
  const del = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    s.deleteAccount();
    router.replace('/auth');
  };

  return (
    <ScrollView contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 20, paddingBottom: 140 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button" accessibilityLabel="Edit profile">
          <Image source={avatarSource(u?.avatar)} style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: s.acc }} contentFit="cover" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Headline size={24}>{u?.name ?? 'You'}</Headline>
          <Text style={{ fontFamily: fonts.label, fontSize: 10.5, letterSpacing: 1, color: s.acc, marginTop: 4 }}>{eraLabel(u?.g).toUpperCase()}</Text>
          <Body style={{ color: colors.mid, fontSize: 13.5 }}>Spins with {s.wheelName} {s.emoji}</Body>
        </View>
      </View>

      <Glass radius={18} style={{ padding: 14, marginTop: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>{streak ? `${streak}-night streak` : 'No streak yet'}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.mid }}>{streak ? `Spin tomorrow to keep it alive, ${t}.` : 'Spin tonight to start one.'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {Array.from({ length: 7 }, (_, k) => <View key={k} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: k < streak ? s.acc : 'rgba(255,255,255,0.15)' }} />)}
          </View>
        </View>
      </Glass>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {([['overview', 'Overview'], ['saved', 'Saved'], ['history', 'History']] as [Tab, string][]).map(([k, l]) => <Chip key={k} label={l} accent={s.acc} on={tab === k} onPress={() => setTab(k)} />)}
      </View>

      {tab === 'overview' && (
        <>
          <View style={{ marginTop: 20, height: 190, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.glassBorder }}>
            <Image source={photoSource((top1 ?? placeById('lusail')!).photos[0])} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
            <LinearGradient colors={['rgba(14,10,18,0.35)', 'rgba(14,10,18,0.92)']} style={{ position: 'absolute', width: '100%', height: '100%' }} />
            <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
              <Label style={{ color: s.acc }}>SPIN WRAPPED</Label>
              {top1 ? (
                <>
                  <Headline size={20}>{top1.short} is your whole personality fr.</Headline>
                  <View style={{ flexDirection: 'row', gap: 18 }}>
                    {[['TOP SPOT', top1.short], ['TOP VIBE', top1.moods[0]], ['FAV BITE', top1.food[0].tag]].map(([k, v]) => (
                      <View key={k}><Label style={{ fontSize: 8.5 }}>{k}</Label><Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white, marginTop: 2 }}>{v}</Text></View>
                    ))}
                  </View>
                  <Pressable onPress={() => Share.share({ message: `My Spin Wrapped: ${top1.short} is my whole personality. 🎡 spinit.app` })} accessibilityRole="button" style={{ position: 'absolute', right: 0, top: 0 }}><Label style={{ color: s.acc }}>SHARE ⇪</Label></Pressable>
                </>
              ) : (
                <Headline size={18}>Spin a few times and your Wrapped shows up here.</Headline>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {[[spins, 'SPINS'], [s.evenings.length, 'NIGHTS KEPT'], [used, 'BONUSES USED']].map(([n, l]) => (
              <Glass key={l} radius={18} style={{ flex: 1, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.headline, fontSize: 24, color: colors.white }}>{n}</Text>
                <Label style={{ marginTop: 4, fontSize: 9 }}>{l}</Label>
              </Glass>
            ))}
          </View>

          <Section title="BADGES" right={`${badges.filter((b) => b[3]).length}/${badges.length}`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {badges.map(([e, name, sub, on]) => (
                <Glass key={name} radius={16} style={{ width: '31%', padding: 12, alignItems: 'center', opacity: on ? 1 : 0.45 }}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.white, marginTop: 4, textAlign: 'center' }}>{name}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: colors.mid, textAlign: 'center' }}>{sub}</Text>
                </Glass>
              ))}
            </View>
          </Section>

          <Section title="BONUS WALLET">
            {s.deals.length === 0 ? <Body style={{ color: colors.mid }}>Spin to unlock a bonus at every spot you land on.</Body> : (
              <View style={{ gap: 8 }}>
                {s.deals.map((d) => {
                  const p = placeById(d.placeId);
                  if (!p) return null;
                  return (
                    <Pressable key={d.placeId} onPress={() => { tap(); s.patch({ qrFor: p.id }); router.push('/qr'); }} accessibilityRole="button" accessibilityLabel={`${p.deal.title}, ${d.used ? 'used' : 'unused'}`}>
                      <Glass radius={16} style={{ padding: 14, opacity: d.used ? 0.55 : 1 }}>
                        <Label style={{ color: s.acc }}>{p.deal.code}{d.used ? ' · USED' : ''}</Label>
                        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white, marginTop: 4 }}>{p.deal.title}</Text>
                        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.mid, marginTop: 2 }}>{p.short} · tap for QR</Text>
                      </Glass>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Section>

          <Section title="DOHA PASSPORT" right={`${[...visited].filter((id) => placeById(id)).length}/${PLACES.length}`}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 12, overflow: 'hidden' }}>
              <View style={{ width: `${(visited.size / PLACES.length) * 100}%`, height: '100%', backgroundColor: s.acc }} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {PLACES.map((p, i) => {
                const on = visited.has(p.id);
                return (
                  <Pressable key={p.id} onPress={() => router.push(`/place/${p.id}`)} accessibilityRole="button" accessibilityLabel={`${p.short}, ${on ? 'stamped' : 'not yet'}`} style={{ width: '31%' }}>
                    <View style={{ borderRadius: 14, borderWidth: 1.5, borderStyle: on ? 'solid' : 'dashed', borderColor: on ? s.acc : 'rgba(255,255,255,0.25)', padding: 6, transform: [{ rotate: on ? ['-6deg', '4deg', '-2deg'][i % 3] : '0deg' }] }}>
                      <Image source={coverPhoto(p)} style={{ width: '100%', aspectRatio: 1, borderRadius: 9, opacity: on ? 1 : 0.35 }} contentFit="cover" />
                      <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.white, marginTop: 4 }}>{p.short}</Text>
                      <Text style={{ fontFamily: fonts.label, fontSize: 8, color: on ? s.acc : colors.mid }}>{on ? 'STAMPED' : 'NOT YET'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Body style={{ color: colors.mid, fontSize: 13, marginTop: 12 }}>{visited.size >= PLACES.length ? `Full passport. You’re officially a Doha local, ${t}.` : `${PLACES.length - visited.size} more to go. Spin to collect the rest.`}</Body>
          </Section>

          <Section title="YOUR WHEEL">
            <Pressable onPress={() => router.push('/edit-wheel')} accessibilityRole="button"><Glass radius={16} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 26, marginRight: 12 }}>{s.emoji}</Text>
              <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>{s.wheelName} · {Object.values(s.wheel).filter(Boolean).length}/{PLACES.length} on</Text>
              <Text style={{ color: s.acc, fontFamily: fonts.bodySemi }}>Edit →</Text>
            </Glass></Pressable>
          </Section>

          <Section title="THEME">
            <View style={{ flexDirection: 'row', gap: 14 }}>
              {THEMES.map(([c, name]) => (
                <Pressable key={c} onPress={() => { tap(); s.setWheelStyle({ acc: c }); s.say(`${name} on. Ate.`); }} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: s.acc === c }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c, borderWidth: s.acc === c ? 3 : 0, borderColor: '#fff' }} />
              ))}
            </View>
          </Section>

          <Section title="THE SHABAB">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {FRIENDS.map(([name, initial, av, dot]) => (
                <View key={name} style={{ alignItems: 'center', gap: 4 }}>
                  <View><View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: av, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.headline, fontSize: 17, color: '#0E0A12' }}>{initial}</Text></View>
                    <View style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: dot, borderWidth: 2, borderColor: colors.bg }} /></View>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.mid }}>{name}</Text>
                </View>
              ))}
            </View>
            <Glass radius={16} style={{ padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Label style={{ color: s.acc }}>SPIN-{(u?.name ?? 'ATH').slice(0, 3).toUpperCase()}</Label>
                <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.mid, marginTop: 3 }}>{s.bonusSpins ? `${s.bonusSpins} bonus spin${s.bonusSpins > 1 ? 's' : ''} earned so far` : 'They join, you both get a bonus spin'}</Text>
              </View>
              <Pressable onPress={() => { tap(); Share.share({ message: `Join me on Spin It 🎡 code SPIN-${(u?.name ?? 'ATH').slice(0, 3).toUpperCase()}` }); s.invite(); s.say('Invite sent. +1 spin, W.'); }} accessibilityRole="button"><View style={{ backgroundColor: s.acc, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ fontFamily: fonts.headline, fontSize: 12, color: '#0E0A12' }}>Invite</Text></View></Pressable>
            </Glass>
          </Section>

          <Section title="SETTINGS">
            <Row label="Calm mode" sub="Tones down the trippy spin + confetti" value={s.calm} onChange={s.setCalm} acc={s.acc} />
            <Row label="Notifications" sub="Pings when the night’s about to start" value={s.notif} onChange={(v) => s.patch({ notif: v })} acc={s.acc} />
            <Row label="Location" sub="Show spots near you first" value={s.loc} onChange={(v) => s.patch({ loc: v })} acc={s.acc} />
            <Row label="3-spin limit" sub="Makes every spin count" value={s.limitOn} onChange={s.setLimit} acc={s.acc} />
            {[['Edit profile', '/edit-profile'], ['Help & feedback', '/help']].map(([l, href]) => (
              <Pressable key={l} onPress={() => { tap(); router.push(href as '/help'); }} accessibilityRole="button" style={{ paddingVertical: 12 }}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>{l} →</Text></Pressable>
            ))}
            <Pressable onPress={logout} accessibilityRole="button" style={{ paddingVertical: 12 }}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.offWhite }}>Log out</Text></Pressable>
            <Pressable onPress={del} accessibilityRole="button" style={{ paddingVertical: 12 }}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: '#FF5A7A' }}>{confirmDelete ? 'Tap again, fr?' : 'Delete account'}</Text></Pressable>
          </Section>
        </>
      )}

      {tab === 'saved' && (
        <View style={{ marginTop: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label={`Spots · ${spots.length}`} accent={s.acc} on={savedTab === 'places'} onPress={() => setSavedTab('places')} />
            <Chip label={`Nights · ${s.evenings.length}`} accent={s.acc} on={savedTab === 'evenings'} onPress={() => setSavedTab('evenings')} />
          </View>
          {savedTab === 'places' && spots.length === 0 && <Body style={{ color: colors.mid, paddingVertical: 30, textAlign: 'center' }}>🔖 Nothing saved. Yet.{'\n'}Bookmark the spots that hit. They land here.</Body>}
          {savedTab === 'places' && spots.map((p) => (
            <Pressable key={p.id} onPress={() => { tap(); router.push(`/place/${p.id}`); }} accessibilityRole="button">
              <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 }}>
                <Image source={coverPhoto(p)} style={{ width: 64, height: 64, borderRadius: 14 }} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.5, color: colors.white }}>{p.short}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.mid, marginTop: 3 }}>{p.vibe}</Text>
                </View>
                <Pressable onPress={() => s.toggleSaved(p.id)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${p.short}`}><Text style={{ fontSize: 18, color: colors.mid, padding: 6 }}>✕</Text></Pressable>
              </Glass>
            </Pressable>
          ))}
          {savedTab === 'evenings' && s.evenings.length === 0 && <Body style={{ color: colors.mid, paddingVertical: 30, textAlign: 'center' }}>🌃 No nights kept. Yet.{'\n'}Spin, like the plan, hit keep.</Body>}
          {savedTab === 'evenings' && s.evenings.map((e) => {
            const p = placeById(e.placeId);
            if (!p) return null;
            return (
              <Pressable key={e.id} onPress={() => { tap(); useStore.setState({ result: p.id, foodAlt: e.foodAlt, dessertAlt: e.dessertAlt }); router.push('/plan'); }} accessibilityRole="button">
                <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 }}>
                  <Image source={coverPhoto(p)} style={{ width: 64, height: 64, borderRadius: 14 }} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.5, color: colors.white }}>Night at {p.short}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.mid, marginTop: 3 }}>{(p.food[e.foodAlt] ?? p.food[0]).name} → {(p.dessert[e.dessertAlt] ?? p.dessert[0]).name}</Text>
                  </View>
                  <Pressable onPress={() => { useStore.setState((st) => ({ evenings: st.evenings.filter((x) => x.id !== e.id) })); s.say('Night deleted. It never happened.'); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Remove night"><Text style={{ fontSize: 18, color: colors.mid, padding: 6 }}>✕</Text></Pressable>
                </Glass>
              </Pressable>
            );
          })}
        </View>
      )}

      {tab === 'history' && (
        <View style={{ marginTop: 18, gap: 8 }}>
          {s.history.length === 0 && <Body style={{ color: colors.mid, paddingVertical: 30, textAlign: 'center' }}>No spins yet. The wheel is waiting.</Body>}
          {s.history.map((h, i) => {
            const p = placeById(h.placeId);
            if (!p) return null;
            return (
              <Glass key={`${h.at}-${i}`} radius={16} style={{ padding: 12 }}>
                <Pressable onPress={() => { tap(); useStore.setState({ result: p.id }); router.push('/plan'); }} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Image source={coverPhoto(p)} style={{ width: 52, height: 52, borderRadius: 12 }} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.5, color: colors.white }}>{p.short}</Text>
                    <Label style={{ marginTop: 4, fontSize: 9 }}>{new Date(h.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()} · {h.mode.toUpperCase()} FIRST</Label>
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }} accessibilityLabel="Rate this night">
                  {REACTIONS.map((r, k) => (
                    <Pressable key={r} onPress={() => { tap(); s.rate(i, k + 1); }} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Rate ${k + 1} of 5`} accessibilityState={{ selected: h.rating === k + 1 }} style={{ opacity: h.rating == null || h.rating === k + 1 ? 1 : 0.35, padding: 4 }}>
                      <Text style={{ fontSize: 20 }}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </Glass>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
