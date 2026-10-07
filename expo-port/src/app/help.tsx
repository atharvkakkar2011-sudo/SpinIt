import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Sheet } from '../components/Sheet';
import { Button, Chip, Glass, Headline, Label } from '../components/ui';
import { term } from '../lib/extra';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const TAGS = ['Bug', 'Idea', 'Missing spot', 'Love it'];

export default function Help() {
  const router = useRouter();
  const { acc, say, user } = useStore();
  const [tag, setTag] = useState<string | null>(null);
  const [text, setText] = useState('');
  return (
    <Sheet>
      <Headline size={24}>Help & feedback</Headline>
      <Label style={{ marginTop: 20, marginBottom: 10 }}>WHAT’S THIS ABOUT?</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TAGS.map((t) => <Chip key={t} label={t} accent={acc} on={tag === t} onPress={() => setTag(tag === t ? null : t)} />)}
      </View>
      <Glass radius={16} style={{ marginTop: 16 }}>
        <TextInput value={text} onChangeText={setText} multiline placeholder="Tell us everything…" placeholderTextColor={colors.dim} accessibilityLabel="Feedback"
          style={{ minHeight: 110, textAlignVertical: 'top', fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.white, padding: 14 }} />
      </Glass>
      <Button label="Send" accent={acc} style={{ marginTop: 20 }} onPress={() => {
        if (!text.trim() && !tag) return say(`Say something first, ${term(user?.g)}.`);
        // TODO(backend): POST to a feedback endpoint. For now this is acknowledged locally only.
        say('Got it. Thanks for the feedback.'); router.back();
      }} />
    </Sheet>
  );
}
