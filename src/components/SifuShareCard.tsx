import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';

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
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
}).toUpperCase();

function getScoreLabel(score: number) {
  if (score <= 20) return 'WEAK';
  if (score <= 40) return 'BELOW AVG';
  if (score <= 55) return 'FAIR';
  if (score <= 70) return 'GOOD';
  if (score <= 85) return 'STRONG';
  return 'ELITE';
}

interface Props {
  score: number;
  value: number;
  coverage: number;
  efficiency: number;
  totalCost: number;
  totalCombos?: number;
  totalNums?: number;
  game: 'TOTO' | '4D';
  verdict: string;
  jackpot?: number;
  lang: 'EN' | 'ZH';
}

export default function SifuShareCard({
  score, value, coverage, efficiency, totalCost,
  totalCombos, totalNums, game, verdict, jackpot, lang,
}: Props) {
  const ZH = lang === 'ZH';
  const label = getScoreLabel(score);

  return (
    <View style={s.card}>

      {/* ── Red header ── */}
      <View style={s.headerBlock}>
        <Image source={require('../assets/sifu.png')} style={s.sifuIcon} resizeMode="contain" />
        <Text style={s.headerTitle}>{ZH ? '师父的判断' : "SIFU'S VERDICT"}</Text>
        <Text style={s.headerSub}>師父 · BET QUALITY REVIEW</Text>
      </View>

      {/* ── Score block ── */}
      <View style={s.scoreBlock}>
        <View style={s.scoreLeft}>
          <Text style={s.scoreBig}>{score}</Text>
          <Text style={s.scoreOf}>/100</Text>
        </View>
        <View style={s.scoreRight}>
          <View style={s.labelChip}>
            <Text style={s.labelChipText}>{label}</Text>
          </View>
          <Text style={s.scoreGame}>{game} · ${totalCost.toLocaleString()}</Text>
          <Text style={s.scoreCovered}>
            {game === 'TOTO'
              ? `${(totalCombos ?? 0).toLocaleString()} / 13,983,816 COMBOS`
              : `${(totalNums ?? 0).toLocaleString()} / 10,000 NUMBERS`}
          </Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* ── Bars ── */}
      <View style={s.barsBlock}>
        {[
          { label: 'VALUE 50%',      val: value,      weight: 0.5 },
          { label: 'COVERAGE 30%',   val: coverage,   weight: 0.3 },
          { label: 'EFFICIENCY 20%', val: efficiency, weight: 0.2 },
        ].map(b => (
          <View key={b.label} style={s.barRow}>
            <View style={s.barHeader}>
              <Text style={s.barLabel}>{b.label}</Text>
              <Text style={s.barVal}>{Math.round(b.val * b.weight)}</Text>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.min(100, Math.round(b.val * b.weight * 2))}%` }]} />
            </View>
          </View>
        ))}
      </View>

      {/* ── TOTO jackpot + draw date ── */}
      {game === 'TOTO' && jackpot && (
        <>
          <View style={s.divider} />
          <View style={s.jackpotBlock}>
            <View style={s.jackpotCell}>
              <Text style={s.jackpotLabel}>{ZH ? '下期头奖' : 'NEXT JACKPOT'}</Text>
              <Text style={s.jackpotAmt}>${Number(jackpot).toLocaleString('en-SG')}</Text>
            </View>
            <View style={s.jackpotDivider} />
            <View style={s.jackpotCell}>
              <Text style={s.jackpotLabel}>{ZH ? '开彩日' : 'DRAW'}</Text>
              <Text style={s.jackpotAmt}>{DATE_STR}</Text>
            </View>
          </View>
        </>
      )}

      <View style={s.divider} />

      {/* ── Verdict ── */}
      <View style={s.verdictBlock}>
        <Text style={s.verdictTitle}>{ZH ? '师父说' : 'SIFU SAYS'}</Text>
        <Text style={s.verdictText}>{verdict}</Text>
        {game === '4D' && <Text style={s.verdictDate}>{DATE_STR}</Text>}
      </View>

      {/* ── Red footer ── */}
      <View style={s.footerBlock}>
        <Text style={s.footerCta}>{ZH ? '在 SG Lottery 审计你的投注！' : 'Get your bet audited at SG Lottery!'}</Text>
        <Text style={s.footerUrl}>play.google.com/store/apps/details?id=com.totosg</Text>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  card: { width: SW, backgroundColor: PAPER },

  // Red header
  headerBlock: { backgroundColor: RED, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  sifuIcon:    { width: 80, height: 80, marginBottom: 8 },
  headerTitle: { fontFamily: 'ArchivoNarrow-Bold', fontSize: 22, color: PAPER, letterSpacing: 0.5, textAlign: 'center' },
  headerSub:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginTop: 3 },

  // Score block
  scoreBlock: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  scoreLeft:  { flexDirection: 'row', alignItems: 'flex-end' },
  scoreBig:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 60, color: INK, lineHeight: 64 },
  scoreOf:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 16, color: MUTE, marginBottom: 8, marginLeft: 2 },
  scoreRight: { flex: 1 },
  labelChip:  { backgroundColor: RED, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 6 },
  labelChipText: { fontFamily: 'IBMPlexMono-Bold', fontSize: 11, color: PAPER, letterSpacing: 1 },
  scoreGame:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: INK, letterSpacing: 0.5 },
  scoreCovered: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 0.5, marginTop: 2 },

  divider: { height: 1, backgroundColor: RULE, marginHorizontal: 16 },

  // Bars
  barsBlock: { padding: 16 },
  barRow:    { marginBottom: 10 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 1 },
  barVal:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: INK },
  barTrack:  { height: 8, backgroundColor: RULE, borderWidth: 1, borderColor: RED, overflow: 'hidden' },
  barFill:   { height: 8, backgroundColor: RED },

  // Jackpot block
  jackpotBlock:   { flexDirection: 'row', padding: 16 },
  jackpotCell:    { flex: 1 },
  jackpotDivider: { width: 1, backgroundColor: RULE, marginHorizontal: 12 },
  jackpotLabel:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: FAINT, letterSpacing: 2, marginBottom: 4 },
  jackpotAmt:     { fontFamily: 'IBMPlexMono-Bold', fontSize: 14, color: INK },

  // Verdict
  verdictBlock: { padding: 16, alignItems: 'center' },
  verdictTitle: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2, marginBottom: 8 },
  verdictText:  { fontFamily: 'ArchivoNarrow-Regular', fontSize: 15, color: INK, textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  verdictDate:  { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1, marginTop: 8 },

  // Footer
  footerBlock: { backgroundColor: RED, padding: 16, alignItems: 'center' },
  footerCta:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 15, color: PAPER, textAlign: 'center', marginBottom: 4 },
  footerUrl:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textAlign: 'center' },
});
