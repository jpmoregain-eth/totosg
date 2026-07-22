import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, Modal, StyleSheet, ScrollView,
  TouchableOpacity, Animated, Dimensions,
  Share, Linking, ActivityIndicator,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { GofConfig } from '../lib/gofConfig';
import { GofInputs, GofProfile, GofNumbers, computeProfile, generateNumbers, SoulColour, Gender } from '../lib/gofEngine';
import GofShareCard from './GofShareCard';

const { width: SW, height: SH } = Dimensions.get('window');
const DARK    = '#0d0d1a';
const CARD    = '#1a1a2e';
const PURPLE  = '#7c6ff7';
const GOLD    = '#C9A84C';
const GOLD2   = '#F0D080';

const CARD_H  = SH * 0.82;

const GOF_REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-6984775309510247/3044234765';
const rewarded = RewardedAd.createForAdRequest(GOF_REWARDED_ID, { requestNonPersonalizedAdsOnly: true });

const COLOURS: { key: SoulColour; hex: string; label: string; labelZH: string }[] = [
  { key: 'red',    hex: '#E24B4A', label: 'Red',    labelZH: '红' },
  { key: 'yellow', hex: '#F5C518', label: 'Yellow', labelZH: '黄' },
  { key: 'green',  hex: '#4CAF50', label: 'Green',  labelZH: '绿' },
  { key: 'white',  hex: '#CCCCCC', label: 'White',  labelZH: '白' },
  { key: 'blue',   hex: '#185FA5', label: 'Blue',   labelZH: '蓝' },
];

function NumPicker({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string;
}) {
  return (
    <View style={s.numGroup}>
      <Text style={s.numLabel}>{label}</Text>
      <View style={s.numPicker}>
        <TouchableOpacity style={s.numBtn} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={s.numBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.numVal}>{String(value).padStart(2, '0')}</Text>
        <TouchableOpacity style={s.numBtn} onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={s.numBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProfileRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={s.profileRow}>
      <Text style={s.profileIcon}>{icon}</Text>
      <Text style={s.profileLabel}>{label}</Text>
    </View>
  );
}

function GoldDivider() {
  return <View style={s.goldDivider} />;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  fabX: number; fabY: number; fabSize: number;
  lang: 'EN' | 'ZH';
  config: GofConfig;
}

export default function GofModal({ visible, onClose, fabX, fabY, fabSize, lang, config }: Props) {
  const [screen,   setScreen]   = useState(1);
  const [day,      setDay]      = useState(1);
  const [month,    setMonth]    = useState(1);
  const [year,     setYear]     = useState(1990);
  const [gender,   setGender]   = useState<Gender>('male');
  const [colour,   setColour]   = useState<SoulColour>('red');
  const [profile,  setProfile]  = useState<GofProfile | null>(null);
  const [numbers,  setNumbers]  = useState<GofNumbers | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const fabCX = fabX + fabSize / 2;
  const fabCY = fabY + fabSize / 2;
  const dX = fabCX - SW / 2;
  const dY = fabCY - SH / 2;
  const tX = scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [dX, 0] });
  const tY = scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [dY, 0] });

  useEffect(() => {
    if (visible) {
      setScreen(1); setProfile(null); setNumbers(null);
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0); opacityAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => setAdLoaded(true));
    const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      if (profile) {
        const inputs: GofInputs = { day, month, year, gender, colour };
        setNumbers(generateNumbers(inputs, profile));
        setScreen(3);
      }
    });
    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => { setAdLoaded(false); rewarded.load(); });
    const unsubError  = rewarded.addAdEventListener(AdEventType.ERROR,  () => setAdLoaded(false));
    rewarded.load();
    return () => { unsubLoaded(); unsubEarned(); unsubClosed(); unsubError(); };
  }, [profile, day, month, year, gender, colour]);

  const handleNext = () => {
    setLoading(true);
    const inputs: GofInputs = { day, month, year, gender, colour };
    const prof = computeProfile(inputs);
    setProfile(prof);
    setLoading(false);
    setScreen(2);
  };

  const handleWatchAd = () => {
    if (adLoaded) { rewarded.show(); }
    else {
      // No ad available — still reveal numbers
      if (profile) {
        const inputs: GofInputs = { day, month, year, gender, colour };
        setNumbers(generateNumbers(inputs, profile));
        setScreen(3);
      }
    }
  };

  const handleShare = async () => {
    if (!numbers || !shareCardRef.current) return;
    setSharing(true);
    try {
      const uri = await shareCardRef.current.capture();
      await RNShare.open({
        url: `file://${uri}`,
        type: 'image/jpeg',
        message: L ? '财神赐我幸运号码！下载 SG Lottery 也来试试！🎰' : '财神 blessed me with lucky numbers! Try SG Lottery too! 🎰',
        failOnCancel: false,
      });
    } catch (e) {
      const fourdStr = numbers.fourd.join(' | ');
      const totoStr  = numbers.toto.map(s => s.join('-')).join(' / ');
      await Share.share({ message: `My GoF lucky numbers 🎰\n4D: ${fourdStr}\nTOTO: ${totoStr}\nGet yours: play.google.com/store/apps/details?id=com.totosg` });
    }
    setSharing(false);
  };

  const handleRate = () => Linking.openURL('https://play.google.com/store/apps/details?id=com.totosg');

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const L = lang === 'ZH';

  // ── Header (shared across all screens) ────────────────────────────────────
  const Header = (
    <View style={s.header}>
      <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
        <Text style={s.closeBtnText}>✕</Text>
      </TouchableOpacity>
      <Image source={config.icon} style={s.headerIcon} resizeMode="contain" />
      <GoldDivider />
    </View>
  );

  // ── Screen 1 ───────────────────────────────────────────────────────────────
  const Screen1 = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
      <Text style={s.screenTitle}>{L ? config.s1TitleZH : config.s1TitleEN}</Text>
      <Text style={s.screenSubtitle}>{L ? config.s1SubtitleZH : config.s1SubtitleEN}</Text>
      <GoldDivider />

      {/* Birth date */}
      <Text style={s.fieldLabel}>🌟 {L ? '出生日期' : 'Date of Birth'}</Text>
      <View style={s.numRow}>
        <NumPicker value={day}   min={1}    max={31}   onChange={setDay}   label={L ? '日' : 'Day'} />
        <NumPicker value={month} min={1}    max={12}   onChange={setMonth} label={L ? '月' : 'Month'} />
        <NumPicker value={year}  min={1920} max={2010} onChange={setYear}  label={L ? '年' : 'Year'} />
      </View>

      {/* Gender */}
      <Text style={s.fieldLabel}>☯️ {L ? '您的天地能量' : 'Your Cosmic Energy'}</Text>
      <View style={s.genderRow}>
        {(['male', 'female'] as Gender[]).map(g => (
          <TouchableOpacity key={g} style={[s.genderBtn, gender === g && s.genderBtnActive]} onPress={() => setGender(g)}>
            <Text style={[s.genderBtnText, gender === g && s.genderBtnTextActive]}>
              {g === 'male' ? (L ? '阳 Yang ☯' : 'Yang ☯') : (L ? '阴 Yin ☯' : 'Yin ☯')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Colour */}
      <Text style={s.fieldLabel}>🎨 {L ? '最认同的颜色' : 'Colour You Identify With'}</Text>
      <View style={s.colourRow}>
        {COLOURS.map(c => (
          <TouchableOpacity key={c.key} style={[s.colourBtn, colour === c.key && { borderColor: c.hex, borderWidth: 2.5 }]} onPress={() => setColour(c.key)}>
            <View style={[s.colourDot, { backgroundColor: c.hex }]} />
            <Text style={s.colourLabel}>{L ? c.labelZH : c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={s.goldBtn} onPress={handleNext} disabled={loading}>
        {loading ? <ActivityIndicator color={DARK} /> :
          <Text style={s.goldBtnText}>{L ? '查看我的天命 ✨' : 'Read My Destiny ✨'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Screen 2 ───────────────────────────────────────────────────────────────
  const Screen2 = profile ? (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
      <Text style={s.screenTitle}>{L ? config.s2TitleZH : config.s2TitleEN}</Text>
      <GoldDivider />

      <View style={s.profileCard}>
        <ProfileRow icon="🐉" label={L ? profile.zodiacZH : profile.zodiac} />
        <ProfileRow icon="✨" label={`${L ? '五行：' : 'Element: '}${L ? profile.elementZH : profile.element}`} />
        <ProfileRow icon="☯️" label={`${L ? '九宫数：' : 'Kua: '}${profile.kuaNumber} — ${L ? profile.kuaElementZH : profile.kuaElement}`} />
        <ProfileRow icon="🕐" label={L ? profile.chineseHourZH : profile.chineseHour} />
        <ProfileRow icon="🎨" label={`${L ? '灵魂色彩：' : 'Soul: '}${L ? profile.colourElementZH : profile.colourElement}`} />
        {profile.loShuMissing.length > 0 && (
          <ProfileRow icon="🔮" label={`${L ? '洛书缺：' : 'Lo Shu: '}${profile.loShuMissing.join(' · ')}`} />
        )}
      </View>

      <Text style={s.adMsg}>{L ? config.s2AdMsgZH : config.s2AdMsgEN}</Text>

      <TouchableOpacity style={s.goldBtn} onPress={handleWatchAd}>
        <Text style={s.goldBtnText}>{L ? config.s2CtaZH : config.s2CtaEN}</Text>
      </TouchableOpacity>
    </ScrollView>
  ) : null;

  // ── Screen 3 ───────────────────────────────────────────────────────────────
  const Screen3 = numbers ? (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
      <Text style={s.screenTitle}>{L ? config.s3TitleZH : config.s3TitleEN}</Text>
      <Text style={s.flavourText}>{L ? config.s3FlavourZH : config.s3FlavourEN}</Text>
      <GoldDivider />

      {/* 4D */}
      <Text style={s.numSectionLabel}>🎴 {L ? '4D 号码' : '4D Numbers'}</Text>
      <View style={s.fourdRow}>
        {numbers.fourd.map((n, i) => (
          <View key={i} style={s.fourdBall}>
            <Text style={s.fourdBallText}>{n}</Text>
          </View>
        ))}
      </View>

      <GoldDivider />

      {/* TOTO */}
      <Text style={s.numSectionLabel}>🎱 {L ? 'TOTO 号码' : 'TOTO Numbers'}</Text>
      {numbers.toto.map((set, i) => (
        <View key={i} style={s.totoRow}>
          {set.map((n, j) => (
            <View key={j} style={s.totoBall}>
              <Text style={s.totoBallText}>{n}</Text>
            </View>
          ))}
        </View>
      ))}

      <TouchableOpacity style={s.goldBtn} onPress={handleShare} disabled={sharing}>
        {sharing ? <ActivityIndicator color={DARK} /> :
          <Text style={s.goldBtnText}>{L ? config.s3ShareZH : config.s3ShareEN}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={s.outlineBtn} onPress={handleRate}>
        <Text style={s.outlineBtnText}>{L ? config.s3RateZH : config.s3RateEN}</Text>
      </TouchableOpacity>
    </ScrollView>
  ) : null;

  return (
    <>
      <Modal visible={visible} transparent statusBarTranslucent onRequestClose={handleClose}>
        <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[
            s.card,
            { transform: [{ scale: scaleAnim }, { translateX: tX }, { translateY: tY }] },
          ]}>
            {Header}
            <View style={s.screenContainer}>
              {screen === 1 && Screen1}
              {screen === 2 && Screen2}
              {screen === 3 && Screen3}
            </View>
          </Animated.View>
        </Animated.View>

        {/* Hidden share card inside Modal so Android renders it */}
        {numbers && (
          <ViewShot ref={shareCardRef} style={s.hiddenCard} options={{ format: 'jpg', quality: 0.95 }}>
            <GofShareCard
              numbers={numbers}
              config={config}
              lang={lang}
              flavourText={L ? config.s3FlavourZH : config.s3FlavourEN}
            />
          </ViewShot>
        )}
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: DARK,
    borderRadius: 28,
    width: '100%',
    height: CARD_H,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GOLD + '40',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: DARK,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  headerIcon:   { width: 80, height: 80, marginBottom: 8 },
  steps: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  step:  { width: 32, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepActive: { backgroundColor: GOLD },
  goldDivider: { height: 1, backgroundColor: GOLD + '30', width: '100%', marginVertical: 10 },

  // ── Screen container ────────────────────────────────────────────────────────
  screenContainer: { flex: 1 },
  screenContent: { padding: 20, paddingTop: 4, paddingBottom: 24 },

  screenTitle:    { fontSize: 18, fontWeight: '700', color: GOLD2, textAlign: 'center', marginBottom: 4 },
  screenSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 8, lineHeight: 18 },

  // ── Fields ──────────────────────────────────────────────────────────────────
  fieldLabel: { fontSize: 12, color: GOLD, fontWeight: '600', marginBottom: 8, marginTop: 4 },

  numRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  numGroup: { flex: 1, alignItems: 'center' },
  numLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  numPicker:{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: GOLD + '30' },
  numBtn:   { paddingHorizontal: 8, paddingVertical: 8 },
  numBtnText:{ fontSize: 16, color: GOLD, fontWeight: '600' },
  numVal:   { fontSize: 13, fontWeight: '700', color: '#fff', minWidth: 26, textAlign: 'center' },

  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genderBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: CARD },
  genderBtnActive: { borderColor: GOLD, backgroundColor: GOLD + '20' },
  genderBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  genderBtnTextActive: { color: GOLD, fontWeight: '700' },

  colourRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  colourBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, marginHorizontal: 3, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: CARD },
  colourDot: { width: 22, height: 22, borderRadius: 11, marginBottom: 4 },
  colourLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },

  // ── Profile card ────────────────────────────────────────────────────────────
  profileCard: { backgroundColor: CARD, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: GOLD + '25' },
  profileRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  profileIcon: { fontSize: 16, marginRight: 10, width: 24 },
  profileLabel:{ flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 },

  adMsg: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 12, lineHeight: 18, fontStyle: 'italic' },

  // ── Numbers ─────────────────────────────────────────────────────────────────
  flavourText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  numSectionLabel: { fontSize: 13, fontWeight: '600', color: GOLD, textAlign: 'center', marginBottom: 10 },

  fourdRow:    { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  fourdBall:   { backgroundColor: GOLD + '25', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: GOLD + '60' },
  fourdBallText:{ color: GOLD2, fontSize: 20, fontWeight: '700', letterSpacing: 2 },

  totoRow:     { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 },
  totoBall:    { width: 38, height: 38, borderRadius: 19, backgroundColor: GOLD + '25', borderWidth: 1.5, borderColor: GOLD + '70', justifyContent: 'center', alignItems: 'center' },
  totoBallText:{ color: GOLD2, fontSize: 12, fontWeight: '700' },

  // ── Buttons ─────────────────────────────────────────────────────────────────
  goldBtn:     { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 12 },
  goldBtnText: { color: DARK, fontSize: 15, fontWeight: '800' },
  outlineBtn:  { borderWidth: 1, borderColor: GOLD + '50', borderRadius: 14, paddingVertical: 12, width: '100%', alignItems: 'center', marginTop: 8 },
  outlineBtnText:{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
  hiddenCard:    { position: 'absolute', left: -9999, top: -9999 },
});
