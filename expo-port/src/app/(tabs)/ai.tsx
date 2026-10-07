import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../../components/Backdrop';
import { Body, Glass, Headline, Label, tap } from '../../components/ui';
import { coverPhoto, photoSource } from '../../data/photos';
import { type Place } from '../../data/places';
import { complete } from '../../lib/ai';
import { placesIn, term } from '../../lib/extra';
import { useStore } from '../../store';
import { colors, fonts } from '../../theme';

interface Msg { role: 'user' | 'ai'; text: string; places?: Place[]; failed?: boolean; q?: string }
const SUGGESTIONS = ['Date night under QAR 150, make it cute', 'Somewhere chill with good karak', 'Plan a night for the shabab, cheap', 'Where do I take my parents?'];

export default function Ai() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { acc, user, history } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const t = term(user?.g);

  const ask = async (raw: string, base: Msg[] = msgs) => {
    const text = raw.trim();
    if (!text || busy) return;
    const hist: Msg[] = [...base, { role: 'user', text }];
    setMsgs(hist);
    setInput('');
    setBusy(true);
    let reply: string;
    let failed = false;
    try {
      const ratings = history.filter((h) => h.rating).map((h) => ({ placeId: h.placeId, rating: h.rating! }));
      reply = (await complete(hist, { gender: user?.g, ratings })) || 'Blanked for a sec. Ask again?';
    } catch {
      failed = true;
      reply = `Wifi said no 😭 Tap retry, ${t}.`;
    }
    setMsgs([...hist, { role: 'ai', text: reply, places: failed ? [] : placesIn(reply), failed, q: text }]);
    setBusy(false);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  const night = (p: Place) => {
    useStore.setState((s) => ({ deals: s.deals.some((d) => d.placeId === p.id) ? s.deals : [{ placeId: p.id, used: false, at: Date.now() }, ...s.deals] }));
    useStore.getState().setResult(p.id);
    router.push('/reveal');
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop source={photoSource('katara-1')} dim={0.85} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: top + 12, paddingHorizontal: 20 }}>
          <Label style={{ color: acc }}>ASK THE WHEEL</Label>
          <Headline size={28} style={{ marginTop: 6 }}>What’s the plan, {t}?</Headline>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, paddingBottom: 190, gap: 12 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {msgs.length === 0 && (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Body style={{ color: colors.mid }}>Tell me your mood, budget or who’s coming. I only recommend spots from the wheel.</Body>
              {SUGGESTIONS.map((q) => (
                <Pressable key={q} onPress={() => { tap(); ask(q); }} accessibilityRole="button">
                  <Glass radius={18}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white, padding: 14 }}>{q}</Text></Glass>
                </Pressable>
              ))}
            </View>
          )}
          {msgs.map((m, i) => {
            const me = m.role === 'user';
            return (
              <View key={i} style={{ alignItems: me ? 'flex-end' : 'flex-start', gap: 8 }}>
                <View style={{ maxWidth: '86%', padding: 14, backgroundColor: me ? acc : 'rgba(255,255,255,0.1)', borderWidth: 1.5, borderColor: me ? acc : 'rgba(255,255,255,0.22)', borderRadius: 20, borderBottomRightRadius: me ? 6 : 20, borderBottomLeftRadius: me ? 20 : 6 }}>
                  <Text selectable style={{ fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: me ? '#0E0A12' : colors.white }}>{m.text}</Text>
                </View>
                {m.failed && i === msgs.length - 1 && (
                  <Pressable onPress={() => { tap(); ask(m.q ?? '', msgs.slice(0, -2)); }} accessibilityRole="button"><Glass radius={999}><Text style={{ fontFamily: fonts.bodySemi, color: acc, paddingHorizontal: 14, paddingVertical: 8 }}>Retry</Text></Glass></Pressable>
                )}
                {(m.places ?? []).map((p) => (
                  <Pressable key={p.id} onPress={() => { tap(); router.push(`/place/${p.id}`); }} accessibilityRole="button" style={{ width: '86%' }}>
                    <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, gap: 10 }}>
                      <Image source={coverPhoto(p)} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.headline, fontSize: 14, letterSpacing: -0.4, color: colors.white }}>{p.short}</Text>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12, color: colors.mid }}>{p.vibe}</Text>
                      </View>
                      <Pressable onPress={() => night(p)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Run it at ${p.short}`}>
                        <View style={{ backgroundColor: acc, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ fontFamily: fonts.headline, fontSize: 11, color: '#0E0A12' }}>Run it</Text></View>
                      </Pressable>
                    </Glass>
                  </Pressable>
                ))}
              </View>
            );
          })}
          {busy && <Label>THINKING…</Label>}
        </ScrollView>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 100 }}>
          <Glass radius={26} intensity={50} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => ask(input)}
              placeholder="Ask anything…"
              placeholderTextColor={colors.dim}
              returnKeyType="send"
              accessibilityLabel="Message"
              style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white, paddingVertical: 14, paddingHorizontal: 18 }}
            />
            <Pressable onPress={() => ask(input)} disabled={busy || !input.trim()} accessibilityRole="button" accessibilityLabel="Send" style={{ margin: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: acc, alignItems: 'center', justifyContent: 'center', opacity: busy || !input.trim() ? 0.4 : 1 }}>
              <Text style={{ fontFamily: fonts.headline, fontSize: 16, color: '#0E0A12' }}>↑</Text>
            </Pressable>
          </Glass>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
