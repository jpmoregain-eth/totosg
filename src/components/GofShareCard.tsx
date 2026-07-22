// ─────────────────────────────────────────────────────────────────────────────
// GOF SHARE CARD — Hidden view captured by react-native-view-shot
// Layered on top of the mystical background image
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { GofNumbers } from '../lib/gofEngine';
import { GofConfig } from '../lib/gofConfig';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW;
const CARD_H = SW * (16 / 9);
const GOLD   = '#C9A84C';
const GOLD2  = '#F0D080';
const DARK   = '#0d0d1a';

interface Props {
  numbers: GofNumbers;
  config: GofConfig;
  lang: 'EN' | 'ZH';
  flavourText: string;
}

export default function GofShareCard({ numbers, config, lang, flavourText }: Props) {
  const L = lang === 'ZH';

  return (
    <View style={s.container}>
      {/* Background */}
      <Image
        source={require('../assets/GoF-sharecard-bg.png')}
        style={s.bg}
        resizeMode="cover"
      />

      {/* Content overlay */}
      <View style={s.overlay}>

        {/* Top — GoF icon + title */}
        <View style={s.topSection}>
          <Image source={config.icon} style={s.gofIcon} resizeMode="contain" />
          <Text style={s.appName}>SG Lottery 4D TOTO</Text>
          <Text style={s.subtitle}>{L ? '财神玄学幸运号码' : '财神 Mystical Lucky Numbers'}</Text>
          <View style={s.goldLine} />
        </View>

        {/* Middle — flavour text */}
        <View style={s.middleSection}>
          <Text style={s.flavourText}>{flavourText}</Text>
          <View style={s.goldLine} />
        </View>

        {/* Numbers */}
        <View style={s.numbersSection}>
          <View style={s.darkPanel}>
            {/* 4D */}
            <Text style={s.numLabel}>🎴 {L ? '4D 号码' : '4D Numbers'}</Text>
            <View style={s.fourdRow}>
              {numbers.fourd.map((n, i) => (
                <View key={i} style={s.fourdBall}>
                  <Text style={s.fourdText}>{n}</Text>
                </View>
              ))}
            </View>

            <View style={s.goldLineSmall} />

            {/* TOTO */}
            <Text style={s.numLabel}>🎱 {L ? 'TOTO 号码' : 'TOTO Numbers'}</Text>
            {numbers.toto.map((set, i) => (
              <View key={i} style={s.totoRow}>
                {set.map((n, j) => (
                  <View key={j} style={s.totoBall}>
                    <Text style={s.totoText}>{n}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Bottom — Play Store CTA */}
        <View style={s.bottomSection}>
          <View style={s.darkPanel}>
            <Text style={s.cta}>
              {L ? '下载 SG Lottery，获取您的幸运号码！' : 'Get your lucky numbers at SG Lottery!'}
            </Text>
            <Text style={s.storeLink}>🔗 play.google.com/store/apps/details?id=com.totosg</Text>
            <Text style={s.credit}>The JP Moregain Project</Text>
          </View>
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: CARD_W, height: CARD_H, position: 'relative' },
  bg:        { position: 'absolute', width: CARD_W, height: CARD_H },
  overlay:   { flex: 1, paddingHorizontal: 32, paddingVertical: 40, justifyContent: 'space-between' },

  // Top
  topSection:  { alignItems: 'center' },
  gofIcon:     { width: 100, height: 100, marginBottom: 10 },
  appName:     { fontSize: 22, fontWeight: '800', color: GOLD2, letterSpacing: 1, textAlign: 'center' },
  subtitle:    { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'center' },

  // Middle
  middleSection: { alignItems: 'center', paddingHorizontal: 8 },
  flavourText:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },

  goldLine:      { height: 1, backgroundColor: GOLD + '50', width: '100%', marginVertical: 14 },
  goldLineSmall: { height: 1, backgroundColor: GOLD + '30', width: '80%', alignSelf: 'center', marginVertical: 10 },

  // Numbers
  numbersSection: { alignItems: 'center', width: '100%' },
  darkPanel:      { backgroundColor: 'rgba(10,10,20,0.75)', borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: GOLD + '25' },
  numLabel:       { fontSize: 14, fontWeight: '700', color: GOLD, marginBottom: 10, textAlign: 'center' },

  fourdRow:    { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  fourdBall:   { backgroundColor: GOLD + '20', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: GOLD + '70' },
  fourdText:   { color: GOLD2, fontSize: 22, fontWeight: '800', letterSpacing: 3 },

  totoRow:     { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 6 },
  totoBall:    { width: 42, height: 42, borderRadius: 21, backgroundColor: GOLD + '25', borderWidth: 1.5, borderColor: GOLD + '70', justifyContent: 'center', alignItems: 'center' },
  totoText:    { color: GOLD2, fontSize: 13, fontWeight: '700' },

  // Bottom
  bottomSection: { alignItems: 'center', width: '100%' },
  cta:           { fontSize: 13, color: GOLD2, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  storeLink:     { fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 6 },
  credit:        { fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 },
});
