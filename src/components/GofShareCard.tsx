import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { GofNumbers, GofProfile } from '../lib/gofEngine';
import { GofConfig } from '../lib/gofConfig';

const { width: SW } = Dimensions.get('window');
const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const TINT  = '#FDF0F1';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';
const FAINT = '#9A9A9A';
const RULE  = '#E4DEDE';

const today = new Date();
const DATE_STR = today.toLocaleDateString('en-SG', {
  day: 'numeric', month: 'short', year: 'numeric'
}).toUpperCase();

interface Props {
  numbers: GofNumbers;
  config: GofConfig;
  lang: 'EN' | 'ZH';
  flavourText: string;
  profile?: GofProfile;
}

export default function GofShareCard({ numbers, config, lang, flavourText, profile }: Props) {
  const ZH = lang === 'ZH';

  // Season label from config event
  const seasonLabel = config.event
    ? config.event.replace(/_/g, ' ').toUpperCase()
    : 'CAISHEN';

  return (
    <View style={s.card}>

      {/* ── Red header block ── */}
      <View style={s.headerBlock}>
        <Image source={config.icon} style={s.gofIcon} resizeMode="contain" />
        <Text style={s.appName}>SG LOTTERY 4D TOTO</Text>
        <Text style={s.appSub}>财神 · MYSTICAL LUCKY NUMBERS</Text>
      </View>

      {/* ── Season + flavour text ── */}
      <View style={s.flavourBlock}>
        <Text style={s.seasonLabel}>SEASON · {seasonLabel}</Text>
        <Text style={s.flavourText}>{flavourText}</Text>
      </View>

      {/* ── Numbers block ── */}
      <View style={s.numbersBlock}>

        {/* 4D */}
        <View style={s.numHeader}>
          <Text style={s.numSectionLabel}>{ZH ? '4D · 三组号码' : '4D · THREE SETS'}</Text>
          <Text style={s.numDate}>{DATE_STR}</Text>
        </View>
        <View style={s.fourdRow}>
          {numbers.fourd.map((n, i) => (
            <View key={i} style={s.fourdCell}>
              <Text style={s.fourdNum}>{n}</Text>
            </View>
          ))}
        </View>

        <View style={s.divider} />

        {/* TOTO */}
        <Text style={s.numSectionLabel}>{ZH ? 'TOTO · 两组号码' : 'TOTO · TWO SETS'}</Text>
        {numbers.toto.map((set, si) => (
          <View key={si} style={s.totoRow}>
            {set.map((n, ni) => (
              <View key={ni} style={s.totoCell}>
                <Text style={s.totoNum}>{String(n).padStart(2, '0')}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Profile line */}
        {profile && (
          <Text style={s.profileLine}>
            {ZH
              ? `${profile.zodiacZH} · 卦${profile.kuaNumber} · ${profile.colourElementZH}`
              : `${profile.zodiac} · KUA ${profile.kuaNumber} · ${profile.colourElement}`}
          </Text>
        )}
      </View>

      {/* ── Red footer ── */}
      <View style={s.footerBlock}>
        <Text style={s.footerCta}>{ZH ? '在 SG Lottery 获取你的幸运号码！' : 'Get your lucky numbers at SG Lottery!'}</Text>
        <Text style={s.footerUrl}>play.google.com/store/apps/details?id=com.totosg</Text>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  card: { width: SW, backgroundColor: PAPER },

  // Red header
  headerBlock: { backgroundColor: RED, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  gofIcon:     { width: 80, height: 80, marginBottom: 10 },
  appName:     { fontFamily: 'ArchivoNarrow-Bold', fontSize: 22, color: PAPER, letterSpacing: 1, textAlign: 'center' },
  appSub:      { fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, marginTop: 4 },

  // Flavour
  flavourBlock:  { borderWidth: 1, borderColor: RULE, margin: 12, padding: 14 },
  seasonLabel:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
  flavourText:   { fontFamily: 'ArchivoNarrow-Regular', fontSize: 13, color: INK, textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },

  // Numbers
  numbersBlock:    { borderWidth: 1, borderColor: RULE, marginHorizontal: 12, marginBottom: 12, padding: 14 },
  numHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  numSectionLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2, marginBottom: 8 },
  numDate:         { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1 },

  fourdRow:  { flexDirection: 'row', gap: 6, marginBottom: 4 },
  fourdCell: { flex: 1, borderWidth: 1, borderColor: RED, backgroundColor: TINT, paddingVertical: 12, alignItems: 'center' },
  fourdNum:  { fontFamily: 'IBMPlexMono-Bold', fontSize: 22, color: INK, letterSpacing: 1 },

  divider: { height: 1, backgroundColor: RULE, marginVertical: 10 },

  totoRow:  { flexDirection: 'row', gap: 4, marginBottom: 4 },
  totoCell: { flex: 1, borderWidth: 1, borderColor: RED, paddingVertical: 8, alignItems: 'center' },
  totoNum:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 13, color: INK },

  profileLine: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, textAlign: 'center', letterSpacing: 1, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: RULE },

  // Red footer
  footerBlock: { backgroundColor: RED, padding: 16, alignItems: 'center' },
  footerCta:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 15, color: PAPER, textAlign: 'center', marginBottom: 4 },
  footerUrl:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textAlign: 'center' },
});
