import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRewardedAd } from '../lib/rewardedAds';
import MingShareCard from './MingShareCard';
import { dealReading, buildReading, CARDS, type MingDeal } from '../lib/tarot/mingEngine';
import { saveMingReading } from '../lib/tarot/mingHistory';
import {
  MING_AD_ID, MING_QUESTIONS, CARD_BACK, CARD_IMAGES, POSITION_ZH, ELEMENT_ZH,
  NUMBER_DISCLAIMER_EN, NUMBER_DISCLAIMER_ZH, type MingQuestion,
} from '../lib/tarot/mingConfig';

// ── Design tokens (match SifuModal / GofModal) ───────────────────────────────
const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const TINT  = '#FDF0F1';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';
const FAINT = '#9A9A9A';
const RULE  = '#E4DEDE';
const GOLD  = '#C9A84C';
const { width: SW, height: SH } = Dimensions.get('window');

type Screen = 'adprompt' | 'questions' | 'draw' | 'result';

interface Props {
  visible: boolean;
  onClose: () => void;
  lang: 'EN' | 'ZH';
  mingUnlocked: boolean;
  onUnlock: () => void;
}

// ── 3D flip card (Y-axis) ─────────────────────────────────────────────────────
function FlipCard({ cardId, reversed, flipped, width, onPress }: {
  cardId: number; reversed: boolean; flipped: boolean; width: number; onPress: () => void;
}) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withTiming(flipped ? 180 : 0, { duration: 650, easing: Easing.inOut(Easing.cubic) });
  }, [flipped, rot]);

  const backStyle  = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rot.value}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rot.value - 180}deg` }],
  }));

  const height = width * 1.5;
  return (
    <TouchableOpacity activeOpacity={0.85} disabled={flipped} onPress={onPress} style={{ width, height }}>
      <ReAnimated.View style={[s.face, s.cardShadow, backStyle]}>
        <Image source={CARD_BACK} style={s.faceImg} resizeMode="cover" />
      </ReAnimated.View>
      <ReAnimated.View style={[s.face, s.cardShadow, frontStyle]}>
        <Image
          source={CARD_IMAGES[cardId]}
          style={[s.faceImg, reversed && { transform: [{ rotate: '180deg' }] }]}
          resizeMode="cover"
        />
      </ReAnimated.View>
    </TouchableOpacity>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MingModal({ visible, onClose, lang, mingUnlocked, onUnlock }: Props) {
  const ZH = lang === 'ZH';
  const locale = ZH ? 'zh' : 'en';
  const insets = useSafeAreaInsets();

  const [screen, setScreen]     = useState<Screen>('questions');
  const [question, setQuestion] = useState<MingQuestion | null>(null);
  const [deal, setDeal]         = useState<MingDeal | null>(null);
  const [flipped, setFlipped]   = useState<boolean[]>([]);
  const [saved, setSaved]       = useState(false);
  const [sharing, setSharing]   = useState(false);
  const [error, setError]       = useState(false);
  const shareCardRef = useRef<React.ElementRef<typeof ViewShot>>(null);

  // Ad is only requested while the modal is open and not yet unlocked this session.
  const { show: showAd } = useRewardedAd(MING_AD_ID, visible && !mingUnlocked);

  const slideAnim   = useRef(new Animated.Value(SH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setScreen('questions');
      setQuestion(null); setDeal(null); setFlipped([]); setSaved(false); setError(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reading text follows the language toggle; cards/numbers stay fixed.
  const reading = useMemo(() => (deal ? buildReading(deal, locale) : null), [deal, locale]);

  const allFlipped = flipped.length > 0 && flipped.every(Boolean);

  // Locked users get the ad prompt once every card is face-up (after the flip animation settles).
  useEffect(() => {
    if (screen !== 'draw' || !allFlipped || mingUnlocked) return;
    const t = setTimeout(() => setScreen('adprompt'), 1000);
    return () => clearTimeout(t);
  }, [screen, allFlipped, mingUnlocked]);

  const goToReading = () => setScreen(mingUnlocked ? 'result' : 'adprompt');

  const handleWatchAd = () => {
    const unlock = () => { onUnlock(); setScreen('result'); };
    // No ad ready (or it expired) — unlock anyway, same as Sifu/Caishen.
    if (!showAd({ onReward: unlock, onClosed: unlock })) unlock();
  };

  const handlePickQuestion = (q: MingQuestion) => {
    try {
      const d = dealReading(q.id, q.cards);
      setQuestion(q); setDeal(d); setFlipped(q.cards ? Array(q.cards).fill(false) : []);
      setSaved(false); setError(false); setScreen('draw');
    } catch {
      setError(true);
    }
  };

  const flipCard = (i: number) => setFlipped(prev => prev.map((f, idx) => (idx === i ? true : f)));

  const restart = () => {
    setQuestion(null); setDeal(null); setFlipped([]); setSaved(false); setScreen('questions');
  };

  const handleSave = async () => {
    if (!reading || saved) return;
    try { await saveMingReading(reading); setSaved(true); } catch { /* ignore */ }
  };

  const handleShare = async () => {
    if (!shareCardRef.current?.capture) return;
    setSharing(true);
    try {
      const uri = await shareCardRef.current.capture();
      await RNShare.open({
        url: `file://${uri}`,
        type: 'image/jpeg',
        message: ZH ? '我在 SG Lottery 抽了一张命运塔罗！🔮' : 'I drew my Ming tarot on SG Lottery! 🔮',
        failOnCancel: false,
      });
    } catch { /* user cancelled or share failed */ }
    setSharing(false);
  };

  const qText = (q: MingQuestion) => (ZH ? q.textZH : q.textEN);
  const posLabel = (p: string) => (ZH ? POSITION_ZH[p] ?? p : p);

  // ── Screen: question list ───────────────────────────────────────────────────
  const ScreenQuestions = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      <Text style={s.fieldLabel}>{ZH ? '你想问什么？' : 'WHAT WOULD YOU LIKE TO ASK?'}</Text>
      {MING_QUESTIONS.map(q => (
        <TouchableOpacity key={q.id} style={s.questionRow} onPress={() => handlePickQuestion(q)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={s.questionText}>{qText(q)}</Text>
            <Text style={s.questionMeta}>
              {ZH ? `${q.cards} 张牌` : `${q.cards} ${q.cards === 1 ? 'CARD' : 'CARDS'}`}
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      ))}
      {error && (
        <Text style={s.errorText}>
          {ZH ? '无法安全洗牌，请稍后再试。' : 'Could not shuffle securely. Please try again.'}
        </Text>
      )}
      <Text style={s.disclaimer}>
        {ZH ? '仅供娱乐与自我反思，并非预测。' : 'For entertainment and reflection only. Not a prediction.'}
      </Text>
    </ScrollView>
  );

  // ── Screen: draw (tap each facedown card to flip) ───────────────────────────
  const cardCount = deal?.draws.length ?? 0;
  const perRow = cardCount > 3 ? 3 : Math.max(cardCount, 1);
  const cardW = Math.min(150, (SW - 32 - (perRow - 1) * 10) / perRow);
  const ScreenDraw = deal && question ? (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      <Text style={s.drawQuestion}>{qText(question)}</Text>
      <Text style={s.fieldLabel}>
        {allFlipped
          ? (ZH ? '牌已全部翻开' : 'ALL CARDS REVEALED')
          : (ZH ? '点击牌面逐张翻开' : 'TAP EACH CARD TO REVEAL')}
      </Text>
      <View style={s.cardGrid}>
        {deal.draws.map((d, i) => (
          <View key={i} style={s.cardSlot}>
            <FlipCard
              cardId={d.cardId}
              reversed={d.orientation === 'reversed'}
              flipped={!!flipped[i]}
              width={cardW}
              onPress={() => flipCard(i)}
            />
            <Text style={s.slotLabel}>{posLabel(d.position).toUpperCase()}</Text>
            <Text style={[s.slotName, { opacity: flipped[i] ? 1 : 0 }]}>
              {reading ? reading.sections[i].card : ''}
              {flipped[i] ? (d.orientation === 'reversed' ? (ZH ? ' · 逆位' : ' · REVERSED') : '') : ''}
            </Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={[s.redBtnFull, !allFlipped && s.redBtnDisabled]}
        disabled={!allFlipped}
        onPress={goToReading}
      >
        <Text style={s.redBtnText}>{ZH ? '查看解读' : 'VIEW READING'}</Text>
      </TouchableOpacity>
    </ScrollView>
  ) : null;

  // ── Screen: reading result + numbers ────────────────────────────────────────
  const ScreenResult = reading && question ? (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      <Text style={s.drawQuestion}>{qText(question)}</Text>

      {/* Mini spread */}
      <View style={s.miniRow}>
        {reading.draws.map((d, i) => (
          <Image
            key={i}
            source={CARD_IMAGES[d.cardId]}
            style={[s.miniCard, d.orientation === 'reversed' && { transform: [{ rotate: '180deg' }] }]}
          />
        ))}
      </View>

      {/* Summary */}
      <Text style={s.sectionLabel}>{ZH ? '总览' : 'SUMMARY'}</Text>
      <Text style={s.bodyText}>{reading.summary}</Text>

      {/* Per-card reading */}
      <View style={s.divider} />
      <Text style={s.sectionLabel}>{ZH ? '逐牌解读' : 'CARD BY CARD'}</Text>
      {reading.sections.map((sec, i) => {
        const d = reading.draws[i];
        const card = CARDS[d.cardId];
        return (
          <View key={i} style={s.readCard}>
            <View style={s.readHead}>
              <Text style={s.readPos}>{posLabel(sec.position).toUpperCase()}</Text>
              <Text style={s.readElem}>
                {ZH ? ELEMENT_ZH[card.element] : card.element.toUpperCase()}
              </Text>
            </View>
            <Text style={s.readCardName}>
              {sec.card}{d.orientation === 'reversed' ? (ZH ? ' · 逆位' : ' · REVERSED') : ''}
              {!ZH ? `  (${card.fusion})` : ''}
            </Text>
            <Text style={s.bodyText}>{sec.text}</Text>
          </View>
        );
      })}

      {/* Element relationships */}
      {!!reading.elementInsight && (
        <>
          <View style={s.divider} />
          <Text style={s.sectionLabel}>{ZH ? '五行关系' : 'ELEMENT RELATIONSHIPS'}</Text>
          <Text style={s.bodyText}>{reading.elementInsight}</Text>
        </>
      )}

      {/* Special combinations */}
      {reading.combinationInsights.length > 0 && (
        <>
          <View style={s.divider} />
          <Text style={s.sectionLabel}>{ZH ? '特殊组合' : 'SPECIAL COMBINATIONS'}</Text>
          {reading.combinationInsights.map((c, i) => <Text key={i} style={s.bodyText}>{c}</Text>)}
        </>
      )}

      {/* Practical guidance */}
      <View style={s.divider} />
      <Text style={s.sectionLabel}>{ZH ? '实用指引' : 'PRACTICAL GUIDANCE'}</Text>
      <Text style={s.verdictText}>{reading.guidance}</Text>

      {/* Number panel */}
      {reading.numbers && (
        <View style={s.numberPanel}>
          <Text style={s.sectionLabel}>{ZH ? '娱乐号码' : 'ENTERTAINMENT NUMBERS'}</Text>
          <Text style={s.numGroupLabel}>4D</Text>
          <View style={s.numRow}>
            {reading.numbers.fourD.map(n => (
              <View key={n} style={s.fourdChip}><Text style={s.fourdText}>{n}</Text></View>
            ))}
          </View>
          <Text style={s.numGroupLabel}>TOTO</Text>
          {reading.numbers.toto.map((set, i) => (
            <View key={i} style={s.numRow}>
              {set.map(n => (
                <View key={n} style={s.totoBall}><Text style={s.totoText}>{n}</Text></View>
              ))}
            </View>
          ))}
          <Text style={s.disclaimerStrong}>{ZH ? NUMBER_DISCLAIMER_ZH : NUMBER_DISCLAIMER_EN}</Text>
          <Text style={s.disclaimer}>{reading.numbers.symbolism.note}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.outlineBtn} onPress={handleSave} disabled={saved}>
          <Text style={s.outlineBtnText}>{saved ? (ZH ? '已保存 ✓' : 'SAVED ✓') : (ZH ? '保存' : 'SAVE')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.redBtn, { flex: 1, marginBottom: 0 }]} onPress={handleShare} disabled={sharing}>
          {sharing ? <ActivityIndicator color={PAPER} /> : <Text style={s.redBtnText}>{ZH ? '分享' : 'SHARE'}</Text>}
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={s.linkBtn} onPress={restart}>
        <Text style={s.linkBtnText}>{ZH ? '再问一个问题' : 'ASK ANOTHER QUESTION'}</Text>
      </TouchableOpacity>
      <Text style={s.disclaimer}>
        {ZH ? '仅供娱乐与自我反思，并非预测。' : 'For entertainment and reflection only. Not a prediction.'}
      </Text>

      {/* Hidden share card for capture */}
      <ViewShot ref={shareCardRef} style={s.hiddenCard} options={{ format: 'jpg', quality: 0.95 }}>
        <MingShareCard reading={reading} question={qText(question)} lang={lang} />
      </ViewShot>
    </ScrollView>
  ) : null;

  // ── Ad prompt — absolute View overlay (NOT a nested Modal: iOS touch-freeze) ─
  const AdPrompt = (
    <View style={screen === 'adprompt' ? s.adPromptContainer : s.adPromptHidden}>
      <View style={s.adPromptOverlay}>
        <View style={s.adPromptBox}>
          <Text style={s.adPromptTitle}>{ZH ? '解读已备好' : 'YOUR READING IS READY'}</Text>
          <Text style={s.adPromptBody}>
            {ZH ? '塔罗解读是免费的。一则短广告让它保持免费。' : 'The reading is free. One short ad keeps it that way.'}
          </Text>
          <TouchableOpacity style={s.adPromptBtn} onPress={handleWatchAd}>
            <Text style={s.adPromptBtnText}>{ZH ? '观看广告' : 'WATCH AD'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.adPromptBack} onPress={() => setScreen('draw')}>
            <Text style={s.adPromptBackText}>{ZH ? '返回' : 'BACK'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }], height: SH * 0.90 - insets.bottom, paddingBottom: insets.bottom }]}>
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetTitle}>{ZH ? '命 · 塔罗' : 'MING TAROT'}</Text>
              <Text style={s.sheetSub}>{ZH ? '中西合璧 · 命运塔罗' : 'EAST × WEST · FORTUNE TAROT'}</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>{ZH ? '关闭' : 'CLOSE'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.screenContainer}>
            {screen === 'questions' && ScreenQuestions}
            {(screen === 'draw' || screen === 'adprompt') && ScreenDraw}
            {screen === 'result'    && ScreenResult}
          </View>
        </Animated.View>
      </Animated.View>
      {AdPrompt}
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: PAPER, borderTopWidth: 3, borderColor: RED },

  sheetHeader:  { backgroundColor: RED, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 20, color: PAPER, letterSpacing: 0.5 },
  sheetSub:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, marginTop: 3 },
  closeBtn:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 9, paddingVertical: 5 },
  closeBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 1 },

  screenContainer: { flex: 1 },
  screenPad:       { padding: 16, paddingBottom: 32 },

  fieldLabel:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 8 },
  sectionLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 8 },
  divider:      { height: 1, backgroundColor: RULE, marginVertical: 14 },

  // Questions
  questionRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: RULE },
  questionText: { fontFamily: 'ArchivoNarrow-Bold', fontSize: 16, color: INK, lineHeight: 21 },
  questionMeta: { fontFamily: 'IBMPlexMono-Regular', fontSize: 10, color: FAINT, letterSpacing: 1, marginTop: 3 },
  chevron:      { fontFamily: 'IBMPlexMono-Bold', fontSize: 22, color: RED, paddingLeft: 12 },
  errorText:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: RED, marginTop: 12 },

  // Draw
  drawQuestion: { fontFamily: 'ArchivoNarrow-Bold', fontSize: 18, color: INK, lineHeight: 23, marginBottom: 12 },
  cardGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginVertical: 12 },
  cardSlot:     { alignItems: 'center', marginBottom: 8 },
  face:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden', borderRadius: 6, overflow: 'hidden', borderWidth: 1.5, borderColor: GOLD },
  cardShadow:   { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  faceImg:      { width: '100%', height: '100%' },
  slotLabel:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 1.5, marginTop: 8 },
  slotName:     { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: INK, marginTop: 2, textAlign: 'center' },

  // Result
  miniRow:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  miniCard:     { width: 54, height: 81, borderRadius: 3, borderWidth: 1, borderColor: GOLD },
  bodyText:     { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: INK, lineHeight: 19, marginBottom: 8 },
  readCard:     { borderWidth: 1, borderColor: RED, backgroundColor: TINT, padding: 12, marginBottom: 10 },
  readHead:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  readPos:      { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2 },
  readElem:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 1 },
  readCardName: { fontFamily: 'ArchivoNarrow-Bold', fontSize: 16, color: INK, marginBottom: 6 },
  verdictText:  { fontFamily: 'ArchivoNarrow-Bold', fontSize: 16, color: INK, lineHeight: 22 },

  // Numbers
  numberPanel:  { marginTop: 18, padding: 14, borderWidth: 1, borderColor: RED, borderStyle: 'dashed' },
  numGroupLabel:{ fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: MUTE, letterSpacing: 2, marginTop: 6, marginBottom: 6 },
  numRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  fourdChip:    { backgroundColor: RED, paddingHorizontal: 14, paddingVertical: 8 },
  fourdText:    { fontFamily: 'IBMPlexMono-Bold', fontSize: 20, color: PAPER, letterSpacing: 4 },
  totoBall:     { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: RED, alignItems: 'center', justifyContent: 'center' },
  totoText:     { fontFamily: 'IBMPlexMono-Bold', fontSize: 14, color: RED },
  disclaimerStrong: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: INK, marginTop: 8 },

  // Buttons
  redBtn:         { backgroundColor: RED, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  redBtnFull:     { backgroundColor: RED, paddingVertical: 14, alignItems: 'center', marginTop: 8, alignSelf: 'stretch' },
  redBtnDisabled: { opacity: 0.4 },
  redBtnText:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 2 },
  outlineBtn:     { flex: 1, borderWidth: 1, borderColor: INK, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: INK, letterSpacing: 2 },
  actionRow:      { flexDirection: 'row', marginTop: 18 },
  linkBtn:        { alignItems: 'center', paddingVertical: 14 },
  linkBtnText:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: RED, letterSpacing: 2 },

  disclaimer: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, lineHeight: 14, marginTop: 8 },
  hiddenCard: { position: 'absolute', left: -9999, top: -9999 },

  // Ad prompt — absolute-positioned View, same as GoF / Sifu
  adPromptContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  adPromptHidden:    { display: 'none' },
  adPromptOverlay:   { flex: 1, backgroundColor: 'rgba(26,26,26,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  adPromptBox:       { backgroundColor: PAPER, borderTopWidth: 3, borderColor: RED, padding: 24, width: '100%' },
  adPromptTitle:     { fontFamily: 'IBMPlexMono-Bold', fontSize: 13, color: INK, letterSpacing: 2, marginBottom: 10 },
  adPromptBody:      { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: MUTE, lineHeight: 18, marginBottom: 20 },
  adPromptBtn:       { backgroundColor: RED, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  adPromptBtnText:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: PAPER, letterSpacing: 2 },
  adPromptBack:      { alignItems: 'center', paddingVertical: 10 },
  adPromptBackText:  { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: MUTE, letterSpacing: 1 },
});
