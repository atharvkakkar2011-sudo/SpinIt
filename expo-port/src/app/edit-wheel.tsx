import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Glass, Headline, Label, RoundButton, tap } from '../components/ui';
import { coverPhoto } from '../data/photos';
import { PLACES } from '../data/places';
import { useStore } from '../store';
import { ACCENTS, WHEEL_EMOJIS, colors, fonts } from '../theme';

export default function EditWheel() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { wheel, toggleWheel, wheelName, emoji, acc, setWheelStyle } = useStore();
  const count = PLACES.filter((p) => wheel[p.id] !== false).length;

  const header = (
    <View>
      <Headline size={32} style={{ marginTop: 18 }}>Make it yours.</Headline>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <View style={{ width: 130, height: 130, borderRadius: 65, borderWidth: 4, borderColor: acc, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: acc, shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }}>
          <Text style={{ fontSize: 56 }}>{emoji}</Text>
        </View>
      </View>

      <Label style={{ marginBottom: 8 }}>NAME · {wheelName.length}/18</Label>
      <Glass radius={16}>
        <TextInput
          value={wheelName}
          onChangeText={(t) => setWheelStyle({ wheelName: t.slice(0, 18) })}
          maxLength={18}
          placeholder="Night Shift"
          placeholderTextColor={colors.dim}
          accessibilityLabel="Wheel name"
          style={{ fontFamily: fonts.bodySemi, fontSize: 17, color: colors.white, padding: 14 }}
        />
      </Glass>

      <Label style={{ marginTop: 20, marginBottom: 10 }}>GLOW</Label>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {ACCENTS.map((c) => (
          <Pressable key={c} onPress={() => { tap(); setWheelStyle({ acc: c }); }} accessibilityRole="button" accessibilityLabel={`Glow ${c}`} accessibilityState={{ selected: acc === c }}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, borderWidth: acc === c ? 3 : 0, borderColor: '#fff', shadowColor: c, shadowOpacity: acc === c ? 0.9 : 0, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }} />
        ))}
      </View>

      <Label style={{ marginTop: 20, marginBottom: 10 }}>FACE</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {WHEEL_EMOJIS.map((e) => (
          <Pressable key={e} onPress={() => { tap(); setWheelStyle({ emoji: e }); }} accessibilityRole="button" accessibilityLabel={`Emoji ${e}`} accessibilityState={{ selected: emoji === e }}>
            <Glass radius={14} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderColor: emoji === e ? acc : colors.glassBorder }}>
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </Glass>
          </Pressable>
        ))}
      </View>

      <Label style={{ marginTop: 24, marginBottom: 4 }}>ON THE WHEEL · {count}/{PLACES.length}</Label>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: top + 8 }}>
      <View style={{ paddingHorizontal: 16 }}><RoundButton glyph="‹" label="Back" onPress={() => router.back()} /></View>
      <FlatList
        data={PLACES}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 110 }}
        renderItem={({ item }) => {
          const on = wheel[item.id] !== false;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <Image source={coverPhoto(item)} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: on ? colors.white : colors.dim }}>{item.short}</Text>
                <Body numberOfLines={1} style={{ color: colors.dim, fontSize: 12.5 }}>{item.area}</Body>
              </View>
              <Switch value={on} onValueChange={() => { toggleWheel(item.id); }} trackColor={{ true: acc, false: colors.disabled }} thumbColor="#fff" accessibilityLabel={`${item.short} on wheel`} />
            </View>
          );
        }}
      />
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: bottom + 16 }}>
        <Button label="Looks good. Spin it." accent={acc} onPress={() => router.dismissTo('/spin')} />
      </View>
    </View>
  );
}
