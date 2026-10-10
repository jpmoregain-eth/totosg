import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import type { Reading } from '../lib/tarot/mingEngine';
import { CARD_IMAGES, NUMBER_DISCLAIMER_EN, NUMBER_DISCLAIMER_ZH } from '../lib/tarot/mingConfig';

// TODO(design): placeholder share card — final design TBD. Keep props stable so the
// real design can be dropped in without touching MingModal.

const { width: SW } = Dimensions.get('window');
const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';
const NAVY  = '#0B1230';
const GOLD  = '#C9A84C';

interface Props {
  reading: Reading;
  question: string;
  lang: 'EN' | 'ZH';
}

export default function MingShareCard({ reading, question, lang }: Props) {
  const ZH = lang === 'ZH';
  const cardW = Math.min(90, (SW - 64) / reading.draws.length - 8);
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>命 MING</Text>
        <Text style={s.sub}>SG LOTTERY</Text>
      </View>
      <View style={s.body}>
        <Text style={s.question}>{question}</Text>
        <View style={s.cardsRow}>
          {reading.draws.map((d, i) => (
            <Image
              key={i}
              source={CARD_IMAGES[d.cardId]}
              style={[
                { width: cardW, height: cardW * 1.5 },
                s.cardImg,
                d.orientation === 'reversed' && { transform: [{ rotate: '180deg' }] },
              ]}
              resizeMode="cover"
            />
          ))}
        </View>
        <Text style={s.summary}>{reading.summary}</Text>
        <Text style={s.disclaimer}>{ZH ? NUMBER_DISCLAIMER_ZH : NUMBER_DISCLAIMER_EN}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:     { width: SW - 32, backgroundColor: PAPER, borderTopWidth: 4, borderColor: RED },
  header:   { backgroundColor: RED, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:    { fontFamily: 'ArchivoNarrow-Bold', fontSize: 22, color: PAPER },
  sub:      { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: 2 },
  body:     { padding: 16, alignItems: 'center' },
  question: { fontFamily: 'ArchivoNarrow-Bold', fontSize: 16, color: INK, textAlign: 'center', marginBottom: 14 },
  cardsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', backgroundColor: NAVY, padding: 12, alignSelf: 'stretch' },
  cardImg:  { borderWidth: 1, borderColor: GOLD },
  summary:  { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: MUTE, lineHeight: 17, textAlign: 'center', marginTop: 14 },
  disclaimer: { fontFamily: 'IBMPlexMono-Regular', fontSize: 8, color: MUTE, marginTop: 12 },
});
