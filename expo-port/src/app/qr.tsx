import { useRouter } from 'expo-router';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Sheet } from '../components/Sheet';
import { Body, Button, Headline, Label } from '../components/ui';
import { placeById } from '../data/places';
import { term } from '../lib/extra';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const TTL = 3 * 3600e3;

export default function QrSheet() {
  const router = useRouter();
  const { deals, qrFor, toggleDeal, say, acc, user } = useStore();
  const deal = deals.find((d) => d.placeId === qrFor);
  const place = placeById(qrFor ?? '');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const exp = deal ? deal.at + TTL : 0;
  const left = Math.max(0, exp - now);
  const matrix = useMemo(() => {
    if (!deal || !place) return null;
    // Unsigned placeholder token. Production: server-signed token (BACKEND.md §Deals / QR).
    const qr = QRCode.create(`spinit:${place.deal.code}:${exp}`, { errorCorrectionLevel: 'M' });
    return { size: qr.modules.size, data: Array.from(qr.modules.data as ArrayLike<number>) };
  }, [deal, place, exp]);

  if (!deal || !place || !matrix) return null;
  const used = deal.used;
  const hh = Math.floor(left / 3600e3);
  const mm = Math.floor((left % 3600e3) / 60e3);
  const ss = Math.floor((left % 60e3) / 1000);
  const live = left > 0 && !used;
  const cell = 200 / (matrix.size + 2);

  return (
    <Sheet>
      <View style={{ alignItems: 'center' }}>
        <Label style={{ color: acc }}>BONUS · {place.deal.code}</Label>
        <Headline size={22} style={{ marginTop: 6, textAlign: 'center' }}>{place.deal.title}</Headline>
        <Body style={{ color: colors.mid, marginTop: 4 }}>{place.short} · one use</Body>

        <View style={{ marginTop: 20, padding: 12, borderRadius: 20, backgroundColor: '#fff', opacity: live ? 1 : 0.35 }} accessibilityLabel={`QR code for ${place.deal.code}`}>
          <Svg width={200} height={200}>
            <Rect width={200} height={200} fill="#fff" />
            {matrix.data.map((v, i) => v ? <Rect key={i} x={(i % matrix.size + 1) * cell} y={(Math.floor(i / matrix.size) + 1) * cell} width={cell + 0.4} height={cell + 0.4} fill="#0E0A12" /> : null)}
          </Svg>
          {used && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.headline, fontSize: 34, color: '#FF3D8B', transform: [{ rotate: '-14deg' }] }}>USED</Text></View>}
        </View>

        <View style={{ marginTop: 16, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: live ? 'rgba(255,255,255,0.1)' : 'rgba(255,90,122,0.15)' }}>
          <Text style={{ fontFamily: fonts.label, fontSize: 12, color: live ? '#fff' : '#FF7A92' }}>
            {used ? 'Redeemed' : left ? `Expires in ${hh}h ${String(mm).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s` : 'Expired'}
          </Text>
        </View>
      </View>
      <Button label={used ? 'Undo, not used yet' : 'Staff scanned it ✓'} accent={acc} style={{ marginTop: 22 }}
        onPress={() => {
          if (!left && !used) return say('This one expired. Spin for a new one.');
          toggleDeal(place.id);
          say(used ? 'Bonus is back on' : `Redeemed. Eat up, ${term(user?.g)}.`);
          if (!used) router.back();
        }} />
    </Sheet>
  );
}
