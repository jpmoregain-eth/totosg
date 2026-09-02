import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, Modal, StyleSheet, ScrollView,
  TouchableOpacity, Animated, Dimensions,
  Share, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import { GofConfig } from '../lib/gofConfig';
import { GofInputs, GofProfile, GofNumbers, computeProfile, generateNumbers, SoulColour, Gender } from '../lib/gofEngine';
import GofShareCard from './GofShareCard';
import { useRewardedAd } from '../lib/rewardedAds';

// ── Design tokens ─────────────────────────────────────────────────────────────
const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const TINT  = '#FDF0F1';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';
const FAINT = '#9A9A9A';
const RULE  = '#E4DEDE';
const DARK  = '#0d0d1a';
const GOLD  = '#C9A84C';

const { width: SW, height: SH } = Dimensions.get('window');

const GOF_REWARDED_ID = __DEV__ ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-6984775309510247/3044234765';

const COLOURS: { key: SoulColour; hex: string; labelEN: string; labelZH: string }[] = [
  { key: 'red',    hex: '#ED2939', labelEN: 'RED',    labelZH: '红' },
  { key: 'yellow', hex: '#C9A84C', labelEN: 'YELLOW', labelZH: '黄' },
  { key: 'green',  hex: '#2D6A4F', labelEN: 'GREEN',  labelZH: '绿' },
  { key: 'white',  hex: '#E8E8E8', labelEN: 'WHITE',  labelZH: '白' },
  { key: 'blue',   hex: '#1B4F8A', labelEN: 'BLUE',   labelZH: '蓝' },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  fabX: number; fabY: number; fabSize: number;
  lang: 'EN' | 'ZH';
  config: GofConfig;
  gofUnlocked: boolean;
  onUnlock: () => void;
}

export default function GofModal({ visible, onClose, fabX, fabY, fabSize, lang, config, gofUnlocked, onUnlock }: Props) {
  const ZH = lang === 'ZH';
  const insets = useSafeAreaInsets();

  const [screen,   setScreen]   = useState<'input' | 'chart'>('input');
  const [day,      setDay]      = useState(1);
  const [month,    setMonth]    = useState(1);
  const [year,     setYear]     = useState(1990);
  const [gender,   setGender]   = useState<Gender>('male');
  const [colour,   setColour]   = useState<SoulColour>('red');
  const [profile,  setProfile]  = useState<GofProfile | null>(null);
  const [numbers,  setNumbers]  = useState<GofNumbers | null>(null);
  const [sharing,  setSharing]  = useState(false);
  const [numbersRevealed, setNumbersRevealed] = useState(false);
  const [showAdPrompt, setShowAdPrompt] = useState(false);

  // Ad only requested while modal is open
  const { show: showAd } = useRewardedAd(GOF_REWARDED_ID, visible);

  const slideAnim   = useRef(new Animated.Value(SH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<ViewShot>(null);

  // ── Animate in/out ──
  useEffect(() => {
    if (visible) {
      setScreen('input');
      setProfile(null);
      setNumbers(null);
      setNumbersRevealed(false);
      setShowAdPrompt(false);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim,   { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim,   { toValue: SH, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);


  const reveal = () => {
    if (!profile) return;
    const inputs: GofInputs = { day, month, year, gender, colour };
    setNumbers(generateNumbers(inputs, profile));
    setNumbersRevealed(true);
    onUnlock();
  };

  const handleCast = () => {
    const inputs: GofInputs = { day, month, year, gender, colour };
    const prof = computeProfile(inputs);
    setProfile(prof);
    setScreen('chart');
  };

  const handleCastCTA = () => {
    if (gofUnlocked) { reveal(); return; }
    setShowAdPrompt(true);
  };

  const handleWatchAd = () => {
    setShowAdPrompt(false);
    if (!showAd({ onReward: reveal })) reveal();
  };

  const handleShare = async () => {
    if (!numbers || !shareCardRef.current) return;
    setSharing(true);
    try {
      const uri = await shareCardRef.current.capture();
      await RNShare.open({
        url: `file://${uri}`,
        type: 'image/jpeg',
        message: ZH ? '财神赐我幸运号码！下载 SG Lottery 也来试试！🎰' : '财神 blessed me with lucky numbers! Try SG Lottery too! 🎰',
        failOnCancel: false,
      });
    } catch (e) {
      const fourdStr = numbers.fourd.join(' | ');
      const totoStr  = numbers.toto.map((s: number[]) => s.join('-')).join(' / ');
      await Share.share({ message: `My GoF lucky numbers 🎰\n4D: ${fourdStr}\nTOTO: ${totoStr}\nGet yours: play.google.com/store/apps/details?id=com.totosg` });
    }
    setSharing(false);
  };

  const handleClose = () => onClose();

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

  // ── Stepper ──────────────────────────────────────────────────────────────────
  const Stepper = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) => (
    <View style={s.stepperGroup}>
      <Text style={s.stepperLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <TouchableOpacity style={s.stepperBtn} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={s.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepperVal}>{String(value).padStart(2, '0')}</Text>
        <TouchableOpacity style={s.stepperBtn} onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={s.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Screen: Input ─────────────────────────────────────────────────────────────
  const ScreenInput = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      {/* Intro */}
      <Text style={s.introText}>
        {ZH
          ? '输入出生日期、能量与灵魂颜色。号码由生肖、五行、卦数、洛书缺数及当前时辰推算。'
          : 'Enter birth date, energy and soul colour. Numbers are derived from zodiac, five elements, Kua number, Lo Shu gaps and the current Chinese hour.'}
      </Text>

      {/* Date of birth */}
      <Text style={s.fieldLabel}>{ZH ? '出生日期' : 'DATE OF BIRTH'}</Text>
      <View style={s.stepperGroupRow}>
        <Stepper label={ZH ? '日' : 'DAY'}   value={day}   min={1} max={31}   onChange={setDay} />
        <Stepper label={ZH ? '月' : 'MONTH'} value={month} min={1} max={12}   onChange={setMonth} />
        <Stepper label={ZH ? '年' : 'YEAR'}  value={year}  min={1920} max={2010} onChange={setYear} />
      </View>

      {/* Cosmic energy */}
      <Text style={s.fieldLabel}>{ZH ? '宇宙能量' : 'COSMIC ENERGY'}</Text>
      <Text style={s.fieldHint}>{ZH ? '用于计算卦数。' : 'USED FOR THE KUA NUMBER.'}</Text>
      <View style={s.genderRow}>
        <TouchableOpacity
          style={[s.genderBtn, gender === 'male' && s.genderBtnActive]}
          onPress={() => setGender('male')}
        >
          <Text style={[s.genderBtnText, gender === 'male' && s.genderBtnTextActive]}>
            {ZH ? '阳 · 男' : 'YANG · MALE'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.genderBtn, gender === 'female' && s.genderBtnActive]}
          onPress={() => setGender('female')}
        >
          <Text style={[s.genderBtnText, gender === 'female' && s.genderBtnTextActive]}>
            {ZH ? '阴 · 女' : 'YIN · FEMALE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Soul colour */}
      <Text style={s.fieldLabel}>{ZH ? '灵魂颜色' : 'COLOUR YOU IDENTIFY WITH'}</Text>
      <View style={s.colourRow}>
        {COLOURS.map(c => (
          <TouchableOpacity
            key={c.key}
            style={[s.colourBtn, colour === c.key && s.colourBtnActive]}
            onPress={() => setColour(c.key)}
          >
            <View style={[s.colourSwatch, { backgroundColor: c.hex }]} />
            <Text style={s.colourLabel}>{ZH ? c.labelZH : c.labelEN}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity style={s.redBtn} onPress={handleCast}>
        <Text style={s.redBtnText}>{ZH ? '铸造今日号码' : 'CAST TODAY\'S NUMBERS'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Screen: Chart ─────────────────────────────────────────────────────────────
  const ScreenChart = profile ? (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      {/* Seed banner */}
      <View style={s.seedBanner}>
        <Text style={s.seedText}>
          {ZH
            ? `生成于 ${dateStr} · 相同输入在午夜前返回相同号码。`
            : `SEEDED ${dateStr} · SAME INPUTS RETURN THESE NUMBERS UNTIL MIDNIGHT.`}
        </Text>
      </View>

      {/* Your chart */}
      <Text style={s.fieldLabel}>{ZH ? '你的命盘' : 'YOUR CHART'}</Text>
      <View style={s.chartTable}>
        {[
          { label: ZH ? '生肖' : 'ZODIAC',        value: ZH ? profile.zodiacZH      : profile.zodiac      },
          { label: ZH ? '年份五行' : 'YEAR ELEMENT', value: ZH ? profile.elementZH     : profile.element     },
          { label: ZH ? '卦数' : 'KUA NUMBER',     value: `${profile.kuaNumber} · ${ZH ? profile.kuaElementZH : profile.kuaElement}` },
          { label: ZH ? '洛书缺数' : 'LO SHU GAPS', value: profile.loShuMissing?.length ? profile.loShuMissing.join(' ') : '—' },
          { label: ZH ? '灵魂元素' : 'SOUL ELEMENT', value: ZH ? profile.colourElementZH : profile.colourElement },
          { label: ZH ? '当前时辰' : 'HOUR NOW',    value: ZH ? profile.chineseHourZH  : profile.chineseHour  },
        ].map((row, i) => (
          <View key={i} style={[s.chartRow, i === 0 && s.chartRowFirst]}>
            <Text style={s.chartRowLabel}>{row.label}</Text>
            <Text style={s.chartRowValue}>{row.value || '—'}</Text>
          </View>
        ))}
      </View>

      {/* Numbers — revealed after ad */}
      {!numbersRevealed ? (
        <>
          <Text style={s.adMsg}>{ZH ? config.s2AdMsgZH : config.s2AdMsgEN}</Text>
          <TouchableOpacity style={s.redBtn} onPress={handleCastCTA}>
            <Text style={s.redBtnText}>{ZH ? config.s2CtaZH : config.s2CtaEN}</Text>
          </TouchableOpacity>
        </>
      ) : numbers ? (
        <>
          {/* 4D · Three sets */}
          <Text style={s.numSectionLabel}>
            {ZH ? '4D · 三组号码' : '4D · THREE SETS'}
            <Text style={s.numSectionSub}>{ZH ? '         按元素加权' : '         WEIGHTED BY ELEMENT'}</Text>
          </Text>
          {numbers.fourd.map((n: string, i: number) => (
            <View key={i} style={s.fourdCard}>
              <Text style={s.fourdCardIndex}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={s.fourdCardDivider} />
              <Text style={s.fourdCardNum}>{n}</Text>
            </View>
          ))}

          {/* TOTO · Two sets */}
          <Text style={[s.numSectionLabel, { marginTop: 16 }]}>
            {ZH ? 'TOTO · 两组号码' : 'TOTO · TWO SETS'}
          </Text>
          {numbers.toto.map((set: number[], si: number) => (
            <View key={si} style={s.totoRow}>
              {set.map((n: number, ni: number) => (
                <View key={ni} style={s.totoCell}>
                  <Text style={s.totoCellNum}>{String(n).padStart(2, '0')}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* Honesty disclaimer */}
          <Text style={s.disclaimer}>
            {ZH
              ? '形而上学，不是数学。这些号码与其他号码中奖机会相同。玩得开心。'
              : 'Metaphysics, not mathematics. These numbers carry exactly the same odds as any others. Play what makes the draw fun.'}
          </Text>

          {/* EDIT / SHARE */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.outlineBtn} onPress={() => { setScreen('input'); setNumbersRevealed(false); }}>
              <Text style={s.outlineBtnText}>{ZH ? '编辑' : 'EDIT'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.redBtnHalf} onPress={handleShare} disabled={sharing}>
              {sharing
                ? <ActivityIndicator color={PAPER} />
                : <Text style={s.redBtnText}>{ZH ? '分享' : 'SHARE'}</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </ScrollView>
  ) : null;

  // ── Modal shell ───────────────────────────────────────────────────────────────
  return (
    <>
      <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={handleClose}>
        <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }], height: SH * 0.90 - insets.bottom, paddingBottom: insets.bottom }]}>

            {/* Red header */}
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>{ZH ? '财神' : 'GOD OF FORTUNE'}</Text>
                <Text style={s.sheetSub}>{ZH ? '财神 · 数字占卜' : 'CAISHEN · NUMBER DIVINATION'}</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
                <Text style={s.closeBtnText}>{ZH ? '关闭' : 'CLOSE'}</Text>
              </TouchableOpacity>
            </View>

            {/* Screen content */}
            <View style={s.screenContainer}>
              {screen === 'input' && ScreenInput}
              {screen === 'chart' && ScreenChart}
            </View>
          </Animated.View>
        </Animated.View>

        {/* Hidden share card */}
        {numbers && (
          <ViewShot ref={shareCardRef} style={s.hiddenCard} options={{ format: 'jpg', quality: 0.95 }}>
            <GofShareCard
              numbers={numbers}
              config={config}
              lang={lang}
              flavourText={ZH ? config.s3FlavourZH : config.s3FlavourEN}
              profile={profile ?? undefined}
            />
          </ViewShot>
        )}

        {/* Ad prompt — no skip, mandatory */}
        <Modal visible={showAdPrompt} transparent animationType="fade">
          <View style={s.adPromptOverlay}>
            <View style={s.adPromptBox}>
              <Text style={s.adPromptTitle}>{ZH ? '财神需要供奉！' : 'MAKE YOUR OFFERING'}</Text>
              <Text style={s.adPromptBody}>
                {ZH ? config.s2AdMsgZH : config.s2AdMsgEN}
              </Text>
              <TouchableOpacity style={s.adPromptBtn} onPress={handleWatchAd}>
                <Text style={s.adPromptBtnText}>{ZH ? '上香 🧧' : 'WATCH AD 🧧'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: PAPER, height: SH * 0.90, borderTopWidth: 3, borderColor: RED },

  // Header
  sheetHeader:  { backgroundColor: RED, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 20, color: PAPER, letterSpacing: 0.5 },
  sheetSub:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, marginTop: 3 },
  closeBtn:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 9, paddingVertical: 5 },
  closeBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 1 },

  screenContainer: { flex: 1 },
  screenPad:       { padding: 16, paddingBottom: 32 },

  // Intro
  introText: { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: MUTE, lineHeight: 18, marginBottom: 16 },

  // Field labels
  fieldLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: INK, letterSpacing: 2, marginBottom: 8, marginTop: 4 },
  fieldHint:  { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1, marginBottom: 8, marginTop: -4 },

  // Steppers
  stepperGroupRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stepperGroup:    { flex: 1, alignItems: 'center' },
  stepperLabel:    { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: FAINT, letterSpacing: 1, marginBottom: 6 },
  stepperRow:      { flexDirection: 'row', borderWidth: 1, borderColor: RED, width: '100%' },
  stepperBtn:      { paddingHorizontal: 8, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: RULE },
  stepperBtnText:  { fontFamily: 'IBMPlexMono-Bold', fontSize: 14, color: RED },
  stepperVal:      { flex: 1, fontFamily: 'IBMPlexMono-SemiBold', fontSize: 13, color: INK, textAlign: 'center', paddingVertical: 9 },

  // Gender
  genderRow:          { flexDirection: 'row', gap: 0, marginBottom: 16 },
  genderBtn:          { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: RULE, alignItems: 'center' },
  genderBtnActive:    { backgroundColor: RED, borderColor: RED },
  genderBtnText:      { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: MUTE, letterSpacing: 1 },
  genderBtnTextActive:{ color: PAPER },

  // Colours
  colourRow:      { flexDirection: 'row', gap: 4, marginBottom: 16 },
  colourBtn:      { flex: 1, alignItems: 'center', paddingVertical: 8, borderWidth: 1, borderColor: RULE },
  colourBtnActive:{ borderColor: RED, borderWidth: 2 },
  colourSwatch:   { width: 28, height: 28, marginBottom: 4 },
  colourLabel:    { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: MUTE, letterSpacing: 0.5 },

  // Buttons
  redBtn:      { backgroundColor: RED, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  redBtnHalf:  { flex: 1, backgroundColor: RED, paddingVertical: 14, alignItems: 'center' },
  redBtnText:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 2 },
  outlineBtn:  { flex: 1, borderWidth: 1, borderColor: INK, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText:{ fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: INK, letterSpacing: 2 },
  actionRow:   { flexDirection: 'row', gap: 0, marginTop: 16 },

  // Seed banner
  seedBanner: { backgroundColor: TINT, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: RULE },
  seedText:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: MUTE, letterSpacing: 0.5, lineHeight: 15 },

  // Chart table
  chartTable:    { borderTopWidth: 1, borderColor: RULE, marginBottom: 16 },
  chartRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: RULE },
  chartRowFirst: {},
  chartRowLabel: { fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: FAINT, letterSpacing: 1 },
  chartRowValue: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 13, color: INK },

  // Ad message
  adMsg: { fontFamily: 'IBMPlexMono-Regular', fontSize: 10, color: MUTE, textAlign: 'center', marginBottom: 12, lineHeight: 16 },

  // Numbers
  numSectionLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: RED, letterSpacing: 2, marginBottom: 10 },
  numSectionSub:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1 },

  // 4D cards
  fourdCard:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: RED, backgroundColor: TINT, marginBottom: 6, paddingVertical: 0 },
  fourdCardIndex:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 11, color: MUTE, paddingHorizontal: 12, paddingVertical: 16 },
  fourdCardDivider: { width: 1, backgroundColor: RED, alignSelf: 'stretch' },
  fourdCardNum:     { flex: 1, fontFamily: 'IBMPlexMono-Bold', fontSize: 36, color: INK, textAlign: 'center', paddingVertical: 10, letterSpacing: 2 },

  // TOTO grid
  totoRow:    { flexDirection: 'row', gap: 5, marginBottom: 5 },
  totoCell:   { flex: 1, borderWidth: 1, borderColor: RED, paddingVertical: 10, alignItems: 'center' },
  totoCellNum:{ fontFamily: 'IBMPlexMono-SemiBold', fontSize: 14, color: INK },

  // Disclaimer
  disclaimer: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, lineHeight: 15, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: RULE },

  hiddenCard: { position: 'absolute', left: -9999, top: -9999 },

  // Ad prompt (mandatory, no skip)
  adPromptOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  adPromptBox:     { backgroundColor: PAPER, borderTopWidth: 3, borderColor: RED, padding: 24, width: '100%' },
  adPromptTitle:   { fontFamily: 'IBMPlexMono-Bold', fontSize: 13, color: INK, letterSpacing: 2, marginBottom: 10 },
  adPromptBody:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: MUTE, lineHeight: 18, marginBottom: 20 },
  adPromptBtn:     { backgroundColor: RED, paddingVertical: 14, alignItems: 'center' },
  adPromptBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: PAPER, letterSpacing: 2 },
});
