import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Sheet } from '../components/Sheet';
import { Button, Chip, Field, Headline, Label, tap } from '../components/ui';
import { avatarSource } from '../data/photos';
import { AVATARS, type Gender } from '../lib/extra';
import { useStore } from '../store';

export default function EditProfile() {
  const router = useRouter();
  const { user, setUser, say, acc } = useStore();
  const [name, setName] = useState(user?.name ?? '');
  const [g, setG] = useState<Gender>(user?.g ?? 'vibes');
  const [av, setAv] = useState(user?.avatar ?? 'sp-avatar');
  if (!user) return null;
  return (
    <Sheet>
      <Headline size={24}>Edit profile</Headline>
      <Label style={{ marginTop: 20, marginBottom: 10 }}>AVATAR</Label>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {AVATARS.map((a) => (
          <Pressable key={a} onPress={() => { tap(); setAv(a); }} accessibilityRole="button" accessibilityLabel={`Avatar ${a}`} accessibilityState={{ selected: av === a }}>
            <Image source={avatarSource(a)} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: av === a ? 3 : 0, borderColor: acc }} contentFit="cover" />
          </Pressable>
        ))}
      </View>
      <Label style={{ marginTop: 20, marginBottom: 10 }}>NAME</Label>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
      <Label style={{ marginTop: 20, marginBottom: 10 }}>WE CALL YOU</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['habibi', 'Habibi'], ['habibti', 'Habibti'], ['vibes', 'Just vibes']] as [Gender, string][]).map(([k, l]) => (
          <Chip key={k} label={l} accent={acc} on={g === k} onPress={() => setG(k)} />
        ))}
      </View>
      <Button label="Save" accent={acc} style={{ marginTop: 24 }} onPress={() => { setUser({ ...user, name: name.trim() || user.name, g, avatar: av }); say('Profile updated. Looking good.'); router.back(); }} />
    </Sheet>
  );
}
