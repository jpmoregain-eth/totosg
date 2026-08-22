import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import { supabase } from '../lib/supabase';

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const DARK    = '#0d0d1a';
const CARD    = '#1a1a2e';
const PURPLE  = '#7c6ff7';
const GOLD    = '#C9A84C';
const GOLD2   = '#F0D080';
const CARD_H  = SH * 0.82;

const SIFU_AD_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-6984775309510247/8566385106';

const EXPLAINER_SEEN_KEY = 'sifu_explainer_seen';

const rewarded = RewardedAd.createForAdRequest(SIFU_AD_ID, { requestNonPersonalizedAdsOnly: true });

// ── TOTO ticket types ─────────────────────────────────────────────────────────
const TOTO_TICKETS = [
  { key: 'ordinary',   label: 'Ordinary',    combos: 1,   cost: 1   },
  { key: 'system7',    label: 'System 7',    combos: 7,   cost: 7   },
  { key: 'system8',    label: 'System 8',    combos: 28,  cost: 28  },
  { key: 'system9',    label: 'System 9',    combos: 84,  cost: 84  },
  { key: 'system10',   label: 'System 10',   combos: 210, cost: 210 },
  { key: 'system11',   label: 'System 11',   combos: 462, cost: 462 },
  { key: 'system12',   label: 'System 12',   combos: 924, cost: 924 },
  { key: 'systemroll', label: 'System Roll', combos: 44,  cost: 44  },
];

const TOTAL_COMBOS = 13_983_816;

// ── Scoring ───────────────────────────────────────────────────────────────────
function calcTotoScore(tickets: Record<string, number>, jackpot: number) {
  let totalCombos = 0;
  let totalCost   = 0;
  let maxCombosPerEntry = 0;

  for (const t of TOTO_TICKETS) {
    const qty = tickets[t.key] ?? 0;
    if (qty > 0) {
      totalCombos      += t.combos * qty;
      totalCost        += t.cost * qty;
      if (t.combos > maxCombosPerEntry) maxCombosPerEntry = t.combos;
    }
  }

  if (totalCost === 0) return { score: 0, value: 0, coverage: 0, efficiency: 0, totalCost: 0, totalCombos: 0 };

  const value      = Math.min(100, (jackpot / TOTAL_COMBOS) * 100 * 7);
  const coverage   = Math.min(100, (Math.log(totalCombos + 1) / Math.log(TOTAL_COMBOS)) * 100 * 5.5);
  const efficiency = Math.min(100, Math.floor(20 + (maxCombosPerEntry / 924) * 80));
  const score      = Math.min(100, Math.round((value * 0.5) + (coverage * 0.3) + (efficiency * 0.2)));

  return { score, value: Math.round(value), coverage: Math.round(coverage), efficiency: Math.round(efficiency), totalCost, totalCombos };
}

function getScoreLabel(score: number) {
  if (score <= 20) return { emoji: '💀', label: 'Weak',          labelZH: '胜算太低' };
  if (score <= 40) return { emoji: '😬', label: 'Below Average', labelZH: '胜算不高' };
  if (score <= 55) return { emoji: '😐', label: 'Fair',          labelZH: '一般般'  };
  if (score <= 70) return { emoji: '👍', label: 'Good',          labelZH: '不错的投注' };
  if (score <= 85) return { emoji: '🔥', label: 'Strong',        labelZH: '高手级别' };
  return              { emoji: '🏆', label: 'Elite',          labelZH: '认真要中奖啊？' };
}

// ── 4D types ──────────────────────────────────────────────────────────────────
type FourdBetType = 'ordinary' | 'ibet' | 'system' | 'roll';

interface FourdRow {
  id: number;
  bigAmt: number;
  smallAmt: number;
  betType: FourdBetType;
  perms: 4 | 6 | 12 | 24;
  qty: number;
}

const PERMS_OPTIONS: (4 | 6 | 12 | 24)[] = [4, 6, 12, 24];

// 4D fixed payouts per $1 stake
const FOURD_PAYOUTS = {
  big:   { first: 2000, second: 1000, third: 490, starter: 250, consolation: 60 },
  small: { first: 3000, second: 2000, third: 1000, starter: 0, consolation: 0 },
};

// 10,000 possible numbers, 23 winning numbers per draw
const FOURD_TOTAL = 10_000;
const FOURD_WINNERS = { first: 1, second: 1, third: 1, starter: 10, consolation: 10 };

function calcFourdExpectedReturn(row: FourdRow): number {
  const { bigAmt, smallAmt, betType, perms, qty } = row;
  let totalReturn = 0;

  // Numbers covered per ticket
  const numsCovered = (betType === 'ordinary') ? 1
    : (betType === 'roll') ? 10
    : perms; // ibet or system

  // Cost and stake per number
  const bigStake   = betType === 'ibet' ? bigAmt / perms   : bigAmt;
  const smallStake = betType === 'ibet' ? smallAmt / perms : smallAmt;

  for (let i = 0; i < qty; i++) {
    for (const [tier, winners] of Object.entries(FOURD_WINNERS)) {
      const prob = (winners * numsCovered) / FOURD_TOTAL;
      const bigPayout   = (FOURD_PAYOUTS.big as any)[tier]   ?? 0;
      const smallPayout = (FOURD_PAYOUTS.small as any)[tier] ?? 0;
      totalReturn += prob * (bigStake * bigPayout + smallStake * smallPayout);
    }
  }
  return totalReturn;
}

function calcFourdScore(rows: FourdRow[]) {
  if (rows.length === 0) return { score: 0, value: 0, coverage: 0, efficiency: 0, totalCost: 0, totalNums: 0 };

  let totalCost    = 0;
  let totalNums    = 0;
  let totalBig     = 0;
  let totalSmall   = 0;
  let totalReturn  = 0;
  let maxNumsPerDollar = 0;

  for (const row of rows) {
    const numsCovered = row.betType === 'ordinary' ? 1
      : row.betType === 'roll' ? 10
      : row.perms;

    const rowCost  = (row.bigAmt + row.smallAmt) * row.qty;
    const rowNums  = numsCovered * row.qty;
    const rowBig   = row.bigAmt * row.qty;
    const rowSmall = row.smallAmt * row.qty;

    totalCost   += rowCost;
    totalNums   += rowNums;
    totalBig    += rowBig;
    totalSmall  += rowSmall;
    totalReturn += calcFourdExpectedReturn(row);

    // Efficiency: nums per dollar (iBet wins here)
    if (rowCost > 0) {
      const numsPerDollar = row.betType === 'ibet' ? numsCovered / (row.bigAmt + row.smallAmt) : 1;
      if (numsPerDollar > maxNumsPerDollar) maxNumsPerDollar = numsPerDollar;
    }
  }

  if (totalCost === 0) return { score: 0, value: 0, coverage: 0, efficiency: 0, totalCost: 0, totalNums: 0 };

  // Value (50%) — weighted Big vs Small ratio
  const bigRatio   = totalBig / (totalBig + totalSmall || 1);
  const value      = Math.round(55 * bigRatio + 45 * (1 - bigRatio));

  // Coverage (30%) — log scale against 10,000
  const coverage   = Math.min(100, Math.round((Math.log(totalNums + 1) / Math.log(FOURD_TOTAL)) * 100 * 5));

  // Efficiency (20%) — iBet 24 perms = 100, ordinary/roll/system = 30
  const efficiency = Math.min(100, Math.round(20 + (maxNumsPerDollar / 24) * 80));

  const score = Math.min(100, Math.round((value * 0.5) + (coverage * 0.3) + (efficiency * 0.2)));

  return { score, value, coverage, efficiency, totalCost, totalNums, expectedReturn: Math.round(totalReturn * 100) / 100 };
}

function getFourdVerdict(score: number, ZH: boolean): string {
  if (score <= 20) return ZH ? '师父说：这注不值得，省省吧。😅' : "Sifu says: This bet isn't worth it, uncle. 😅";
  if (score <= 40) return ZH ? '胜算不高。试试iBet，覆盖更多号码！' : "Long shot. Consider iBet to cover more numbers!";
  if (score <= 55) return ZH ? '普通投注。iBet可以提高你的效率分。' : "Decent. Switching to iBet would boost your efficiency score.";
  if (score <= 70) return ZH ? '不错！Big bet覆盖更多奖项层次，干得好。👍' : "Good call! Big bet covers more prize tiers. 👍";
  if (score <= 85) return ZH ? '高手级别！iBet全排列，师父点头。🔥' : "Smart play! iBet with full permutations — Sifu nods. 🔥";
  return ZH ? '哇！师父大力赞！效率最高的投注法！🏆' : "Elite bet! Maximum efficiency — Sifu is impressed! 🏆";
}

function getVerdict(score: number, jackpot: number, ZH: boolean): string {
  const snowball = jackpot >= 5_000_000;
  if (score <= 20) return ZH ? '师父说：钱留着买好料，不要浪费。😅' : "Sifu says: Save your money, uncle. 😅";
  if (score <= 40) return ZH ? '胜算不高，但万一呢？🤞' : "Long shot tonight. But hey, someone's gotta win! 🎯";
  if (score <= 55) return ZH
    ? (snowball ? '奖池够大，今晚值得一试！⚡' : '普通一注，jackpot大一点师父会更开心。')
    : (snowball ? '⚡ Big jackpot! Your score improves with the pool.' : "Decent bet. A bigger jackpot would push your score higher.");
  if (score <= 70) return ZH ? '师父点头认可，继续加油！👍' : "Sifu approves this bet. Go get it! 👍";
  if (score <= 85) return ZH ? '高手出手！今晚运气跟着你。🔥' : "High roller playing smart. Tonight could be your night. 🔥";
  return ZH ? '哇，认真的啊！师父祝你旗开得胜！🏆' : "Wah, you serious about striking ah?! Sifu blesses this bet! 🏆";
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  lang: 'EN' | 'ZH';
  sifuUnlocked: boolean;
  onUnlock: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SifuModal({ visible, onClose, lang, sifuUnlocked, onUnlock }: Props) {
  const ZH = lang === 'ZH';

  type Screen = 'explainer' | 'input' | 'adprompt' | 'results' | 'share';
  const [screen, setScreen]   = useState<Screen>('input');
  const [game, setGame]       = useState<'TOTO' | '4D'>('TOTO');
  const [tickets, setTickets] = useState<Record<string, number>>({});
  const [jackpot, setJackpot] = useState(0);
  const [jackpotLabel, setJackpotLabel] = useState('...');
  const [result, setResult]   = useState<ReturnType<typeof calcTotoScore> | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);
  // 4D state
  const [fourdRows, setFourdRows] = useState<FourdRow[]>([{ id: 1, bigAmt: 1, smallAmt: 0, betType: 'ordinary', perms: 24, qty: 1 }]);
  const [fourdResult, setFourdResult] = useState<ReturnType<typeof calcFourdScore> | null>(null);
  const nextRowId = useRef(2);

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shareRef    = useRef<ViewShot>(null);

  // ── Animate in/out ──
  useEffect(() => {
    if (visible) {
      checkExplainer();
      fetchJackpot();
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0); opacityAnim.setValue(0);
    }
  }, [visible]);

  const checkExplainer = async () => {
    const seen = await AsyncStorage.getItem(EXPLAINER_SEEN_KEY);
    setScreen(seen ? 'input' : 'explainer');
  };

  const fetchJackpot = async () => {
    const { data } = await supabase
      .from('toto_jackpot')
      .select('jackpot_amount, next_draw_date')
      .eq('id', 1)
      .single();
    if (data) {
      setJackpot(data.jackpot_amount);
      setJackpotLabel(`$${data.jackpot_amount.toLocaleString()} · ${data.next_draw_date}`);
    }
  };

  // ── Rewarded ad ──
  useEffect(() => {
    const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => setAdLoaded(true));
    const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      onUnlock(); showResults();
    });
    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => { setAdLoaded(false); rewarded.load(); });
    const unsubError  = rewarded.addAdEventListener(AdEventType.ERROR,  () => setAdLoaded(false));
    rewarded.load();
    return () => { unsubLoaded(); unsubEarned(); unsubClosed(); unsubError(); };
  }, [tickets, jackpot]);

  const setQty = (key: string, qty: number) => setTickets(prev => ({ ...prev, [key]: Math.max(0, qty) }));
  const totalSelected = Object.values(tickets).reduce((a, b) => a + b, 0);
  const fourdHasInput = fourdRows.some(r => (r.bigAmt + r.smallAmt) > 0 && r.qty > 0);

  // 4D row helpers
  const addFourdRow = () => {
    setFourdRows(prev => [...prev, { id: nextRowId.current++, bigAmt: 1, smallAmt: 0, betType: 'ordinary', perms: 24, qty: 1 }]);
  };
  const removeFourdRow = (id: number) => setFourdRows(prev => prev.filter(r => r.id !== id));
  const updateFourdRow = (id: number, patch: Partial<FourdRow>) => {
    setFourdRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const showResults = () => {
    if (game === 'TOTO') {
      setResult(calcTotoScore(tickets, jackpot));
      setFourdResult(null);
    } else {
      setFourdResult(calcFourdScore(fourdRows));
      setResult(null);
    }
    setScreen('results');
  };

  const handleConsult = () => {
    if (sifuUnlocked) showResults();
    else setScreen('adprompt');
  };

  const handleWatchAd = () => {
    if (adLoaded) rewarded.show();
    else { onUnlock(); showResults(); } // graceful fallback
  };

  const handleShare = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const uri = await shareRef.current.capture();
      await RNShare.open({
        url: `file://${uri}`,
        type: 'image/jpeg',
        message: ZH ? '师父给我评分啦！下载 SG Lottery 也来试试！🎰' : 'Check out my Sifu Score from SG Lottery! 🎰',
        failOnCancel: false,
      });
    } catch (_) {}
    setSharing(false);
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setTickets({}); setResult(null);
      setFourdRows([{ id: 1, bigAmt: 1, smallAmt: 0, betType: 'ordinary', perms: 24, qty: 1 }]);
      setFourdResult(null);
      setScreen('input');
      onClose();
    });
  };

  // ── Gold divider ──
  const GoldDivider = () => <View style={s.goldDivider} />;

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = (
    <View style={s.header}>
      <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
        <Text style={s.closeBtnText}>✕</Text>
      </TouchableOpacity>
      {screen !== 'explainer' && (
        <TouchableOpacity style={s.helpBtn} onPress={() => setScreen('explainer')}>
          <Text style={s.helpBtnText}>?</Text>
        </TouchableOpacity>
      )}
      <Image source={require('../assets/sifu.png')} style={s.headerIcon} resizeMode="contain" />
      <Text style={s.headerTitle}>师父 {ZH ? '投注顾问' : '· Sifu Advisor'}</Text>
      <GoldDivider />
    </View>
  );

  // ── Game toggle ───────────────────────────────────────────────────────────
  const GameToggle = (
    <View style={s.gameToggle}>
      {(['TOTO', '4D'] as const).map(g => (
        <TouchableOpacity
          key={g}
          style={[s.gameBtn, game === g && s.gameBtnActive]}
          onPress={() => { setGame(g); setTickets({}); setResult(null); }}
        >
          <Text style={[s.gameBtnText, game === g && s.gameBtnTextActive]}>{g}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Screen: Explainer ─────────────────────────────────────────────────────
  const ScreenExplainer = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
      <Text style={s.screenTitle}>{ZH ? '师父的评分系统' : "Sifu's Scoring System"}</Text>
      <Text style={s.body}>
        {ZH
          ? '让师父分析你的投注，为你的策略评分。\n\n0 / 100 — 胜算不高\n100 / 100 — 最聪明的玩法\n\n记住：就算100分也不保证中奖。但至少，你是在聪明地玩。🙏'
          : "Let Sifu analyse your bets and score your strategy.\n\n0 / 100 — Playing against the odds\n100 / 100 — Playing as smart as it gets\n\nRemember: even a 100/100 doesn't guarantee a win. But it means you're playing smart. 🙏"}
      </Text>
      <GoldDivider />
      <Text style={s.body}>
        {ZH
          ? '📊 评分由三个部分组成：\n\n• 价值 (50%) — 奖池大小影响\n• 覆盖率 (30%) — 你覆盖了多少号码\n• 效率 (20%) — 每元钱的价值'
          : '📊 Score is made of 3 components:\n\n• Value (50%) — driven by jackpot size\n• Coverage (30%) — how many combos you cover\n• Efficiency (20%) — best value per dollar'}
      </Text>
      <TouchableOpacity style={s.goldBtn} onPress={() => {
        AsyncStorage.setItem(EXPLAINER_SEEN_KEY, '1');
        setScreen('input');
      }}>
        <Text style={s.goldBtnText}>{ZH ? '开始分析 👊' : "Let's Go 👊"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Screen: Input ─────────────────────────────────────────────────────────
  const ScreenInput = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
      {GameToggle}

      {game === 'TOTO' ? (
        <>
          {/* Live jackpot */}
          <View style={s.jackpotBox}>
            <Text style={s.jackpotLbl}>🏆 {ZH ? '下期头奖' : 'Next Draw Jackpot'}</Text>
            <Text style={s.jackpotAmt}>{jackpotLabel}</Text>
          </View>

          <Text style={s.fieldLabel}>{ZH ? '你买了什么？' : 'What are you buying?'}</Text>

          {TOTO_TICKETS.map(t => (
            <View key={t.key} style={s.ticketRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.ticketLabel}>{t.label}</Text>
                <Text style={s.ticketCost}>${t.cost} · {t.combos} combo{t.combos > 1 ? 's' : ''}</Text>
              </View>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(t.key, (tickets[t.key] ?? 0) - 1)}>
                  <Text style={s.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.qtyVal}>{tickets[t.key] ?? 0}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(t.key, (tickets[t.key] ?? 0) + 1)}>
                  <Text style={s.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      ) : (
        // 4D input
        <>
          <Text style={s.fieldLabel}>{ZH ? '你的4D投注' : 'Your 4D Bets'}</Text>
          {fourdRows.map((row, idx) => (
            <View key={row.id} style={s.fourdCard}>
              <View style={s.fourdCardHeader}>
                <Text style={s.fourdCardTitle}>#{idx + 1}</Text>
                {fourdRows.length > 1 && (
                  <TouchableOpacity onPress={() => removeFourdRow(row.id)}>
                    <Text style={s.fourdRemove}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Big / Small amounts */}
              <View style={s.fourdAmtRow}>
                <View style={s.fourdAmtGroup}>
                  <Text style={s.fourdAmtLabel}>{ZH ? '大 (Big) $' : 'Big $'}</Text>
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateFourdRow(row.id, { bigAmt: Math.max(0, row.bigAmt - 1) })}>
                      <Text style={s.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.qtyVal}>{row.bigAmt}</Text>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateFourdRow(row.id, { bigAmt: row.bigAmt + 1 })}>
                      <Text style={s.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.fourdAmtGroup}>
                  <Text style={s.fourdAmtLabel}>{ZH ? '小 (Small) $' : 'Small $'}</Text>
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateFourdRow(row.id, { smallAmt: Math.max(0, row.smallAmt - 1) })}>
                      <Text style={s.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.qtyVal}>{row.smallAmt}</Text>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateFourdRow(row.id, { smallAmt: row.smallAmt + 1 })}>
                      <Text style={s.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.fourdAmtGroup}>
                  <Text style={s.fourdAmtLabel}>{ZH ? '张数' : 'Qty'}</Text>
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateFourdRow(row.id, { qty: Math.max(1, row.qty - 1) })}>
                      <Text style={s.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={s.qtyVal}>{row.qty}</Text>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateFourdRow(row.id, { qty: row.qty + 1 })}>
                      <Text style={s.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Bet type */}
              <Text style={s.fourdAmtLabel}>{ZH ? '投注类型' : 'Bet Type'}</Text>
              <View style={s.betTypeRow}>
                {(['ordinary', 'ibet', 'system', 'roll'] as FourdBetType[]).map(bt => (
                  <TouchableOpacity
                    key={bt}
                    style={[s.betTypeBtn, row.betType === bt && s.betTypeBtnActive]}
                    onPress={() => updateFourdRow(row.id, { betType: bt })}
                  >
                    <Text style={[s.betTypeBtnText, row.betType === bt && s.betTypeBtnTextActive]}>
                      {bt === 'ordinary' ? (ZH ? '直买' : 'Ord') :
                       bt === 'ibet'    ? 'iBet' :
                       bt === 'system'  ? (ZH ? '系统' : 'Sys') : 'Roll'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Perms — shown for ibet and system only */}
              {(row.betType === 'ibet' || row.betType === 'system') && (
                <View style={s.permsRow}>
                  <Text style={s.fourdAmtLabel}>{ZH ? '排列数' : 'Perms'}</Text>
                  <View style={s.permsOptions}>
                    {PERMS_OPTIONS.map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[s.permBtn, row.perms === p && s.permBtnActive]}
                        onPress={() => updateFourdRow(row.id, { perms: p })}
                      >
                        <Text style={[s.permBtnText, row.perms === p && s.permBtnTextActive]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={s.addRowBtn} onPress={addFourdRow}>
            <Text style={s.addRowBtnText}>+ {ZH ? '加多一个号码' : 'Add number'}</Text>
          </TouchableOpacity>
        </>
      )}

      {game === 'TOTO' ? (
        <TouchableOpacity
          style={[s.goldBtn, totalSelected === 0 && s.goldBtnDisabled]}
          onPress={handleConsult}
          disabled={totalSelected === 0}
        >
          <Text style={s.goldBtnText}>{ZH ? '问师父 🙏' : 'Consult Sifu 🙏'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[s.goldBtn, !fourdHasInput && s.goldBtnDisabled]}
          onPress={handleConsult}
          disabled={!fourdHasInput}
        >
          <Text style={s.goldBtnText}>{ZH ? '问师父 🙏' : 'Consult Sifu 🙏'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  // ── Screen: Ad Prompt ─────────────────────────────────────────────────────
  const ScreenAdPrompt = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
      <Text style={s.screenTitle}>{ZH ? '师父开口啦！' : "Sifu is ready to speak!"}</Text>
      <Text style={s.body}>
        {ZH
          ? '师父的智慧是免费的 — 看一段短广告来支持开发者，让这个应用永远免费！🙏'
          : "Sifu's wisdom is free — watch a short ad to support the dev and keep this app free forever! 🙏"}
      </Text>
      <GoldDivider />
      <TouchableOpacity style={s.goldBtn} onPress={handleWatchAd}>
        <Text style={s.goldBtnText}>{ZH ? '看广告 🎬' : 'Watch Ad 🎬'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Screen: Results ───────────────────────────────────────────────────────
  const ScreenResults = (() => {
    const activeResult = game === 'TOTO' ? result : fourdResult;
    if (!activeResult) return null;
    const { score, value, coverage, efficiency, totalCost } = activeResult;
    const totalNums    = (activeResult as any).totalNums ?? 0;
    const totalCombos  = (activeResult as any).totalCombos ?? 0;
    const { emoji, label, labelZH } = getScoreLabel(score);
    const verdict = game === 'TOTO'
      ? getVerdict(score, jackpot, ZH)
      : getFourdVerdict(score, ZH);
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
        <Text style={s.screenTitle}>{ZH ? '师父说...' : 'Sifu Says...'}</Text>

        {/* Score */}
        <View style={s.scoreBig}>
          <Text style={s.scoreEmoji}>{emoji}</Text>
          <Text style={s.scoreNum}>{score}<Text style={s.scoreOf}> / 100</Text></Text>
          <Text style={s.scoreLabel}>{ZH ? labelZH : label}</Text>
        </View>

        {/* Summary */}
        <View style={s.summaryRow}>
          <Text style={s.summaryItem}>{ZH ? '总投注' : 'Total'}: <Text style={s.summaryVal}>${totalCost.toLocaleString()}</Text></Text>
          {game === 'TOTO'
            ? <Text style={s.summaryItem}>{ZH ? '组合数' : 'Combos'}: <Text style={s.summaryVal}>{totalCombos.toLocaleString()}</Text></Text>
            : <Text style={s.summaryItem}>{ZH ? '覆盖号码' : 'Numbers'}: <Text style={s.summaryVal}>{totalNums.toLocaleString()}</Text></Text>
          }
        </View>

        <GoldDivider />

        {/* Breakdown bars */}
        <Text style={s.fieldLabel}>{ZH ? '评分明细' : 'Score Breakdown'}</Text>
        {[
          { label: ZH ? '价值 (50%)' : 'Value (50%)',       val: value,      weight: 0.5 },
          { label: ZH ? '覆盖率 (30%)' : 'Coverage (30%)',  val: coverage,   weight: 0.3 },
          { label: ZH ? '效率 (20%)' : 'Efficiency (20%)',  val: efficiency, weight: 0.2 },
        ].map(b => (
          <View key={b.label} style={s.barRow}>
            <Text style={s.barLabel}>{b.label}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.round(b.val * b.weight * 2)}%` }]} />
            </View>
            <Text style={s.barVal}>{Math.round(b.val * b.weight)}</Text>
          </View>
        ))}

        <GoldDivider />

        {/* Verdict */}
        <View style={s.verdictBox}>
          <Text style={s.verdictText}>💬 {verdict}</Text>
        </View>

        <TouchableOpacity style={s.goldBtn} onPress={() => setScreen('share')} disabled={sharing}>
          {sharing
            ? <ActivityIndicator color={DARK} />
            : <Text style={s.goldBtnText}>{ZH ? '分享 📤' : 'Share 📤'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.outlineBtn} onPress={() => {
          setTickets({}); setResult(null);
          setFourdRows([{ id: 1, bigAmt: 1, smallAmt: 0, betType: 'ordinary', perms: 24, qty: 1 }]);
          setFourdResult(null);
          setScreen('input');
        }}>
          <Text style={s.outlineBtnText}>{ZH ? '再试一次' : 'Try Again'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  })();

  // ── Screen: Share ─────────────────────────────────────────────────────────
  const ScreenShare = (() => {
    const activeResult = game === 'TOTO' ? result : fourdResult;
    if (!activeResult) return null;
    const { score, totalCost } = activeResult;
    const { emoji, label, labelZH } = getScoreLabel(score);
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenContent}>
        <Text style={s.screenTitle}>{ZH ? '分享你的师父评分！' : 'Share your Sifu Score!'}</Text>

        <ViewShot ref={shareRef} style={s.shareCard} options={{ format: 'jpg', quality: 0.95 }}>
          <Image source={require('../assets/GoF-sharecard-bg.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <Image source={require('../assets/sifu.png')} style={s.shareIcon} resizeMode="contain" />
          <Text style={s.shareTitle}>👴 {ZH ? '师父的判断' : "Sifu's Verdict"}</Text>
          <Text style={s.shareScoreNum}>{score}<Text style={s.shareScoreOf}> / 100</Text></Text>
          <Text style={s.shareScoreLabel}>{emoji} {ZH ? labelZH : label}</Text>
          <Text style={s.shareDetail}>{game} · {ZH ? '总投注' : 'Total'}: ${totalCost.toLocaleString()}</Text>
          {game === 'TOTO' && <Text style={s.shareDetail}>{ZH ? '奖池' : 'Jackpot'}: {jackpotLabel}</Text>}
          <Text style={s.shareTagline}>{ZH ? '财富属于聪明的人 🎯' : 'Fortune favours the smart! 🎯'}</Text>
          <Text style={s.shareAppName}>SG Lottery 4D TOTO</Text>
        </ViewShot>

        <TouchableOpacity style={[s.goldBtn, { marginTop: 16 }]} onPress={handleShare} disabled={sharing}>
          {sharing
            ? <ActivityIndicator color={DARK} />
            : <Text style={s.goldBtnText}>{ZH ? '分享到社交媒体 📤' : 'Share to Social Media 📤'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.outlineBtn} onPress={() => setScreen('results')}>
          <Text style={s.outlineBtnText}>{ZH ? '返回' : 'Back'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  })();

  // ── Modal shell ───────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[
          s.card,
          { transform: [{ scale: scaleAnim }] },
        ]}>
          {Header}
          <View style={s.screenContainer}>
            {screen === 'explainer' && ScreenExplainer}
            {screen === 'input'     && ScreenInput}
            {screen === 'adprompt' && ScreenAdPrompt}
            {screen === 'results'   && ScreenResults}
            {screen === 'share'     && ScreenShare}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card:        { backgroundColor: DARK, borderRadius: 28, width: '100%', height: CARD_H, overflow: 'hidden', borderWidth: 1, borderColor: GOLD + '40' },
  header:      { alignItems: 'center', paddingTop: 16, paddingBottom: 8, backgroundColor: DARK },
  closeBtn:    { position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText:{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  helpBtn:     { position: 'absolute', top: 12, right: 50, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  helpBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  headerIcon:  { width: 72, height: 72, marginBottom: 4 },
  headerTitle: { color: GOLD, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  goldDivider: { height: 1, backgroundColor: GOLD + '30', width: '100%', marginVertical: 10 },
  screenContainer: { flex: 1 },
  screenContent:   { padding: 20, paddingTop: 4, paddingBottom: 24 },
  screenTitle:     { fontSize: 18, fontWeight: '700', color: GOLD2, textAlign: 'center', marginBottom: 8 },
  body:            { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 22, textAlign: 'center', marginBottom: 12 },
  fieldLabel:      { fontSize: 12, color: GOLD, fontWeight: '600', marginBottom: 8, marginTop: 4 },

  // Game toggle
  gameToggle:       { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 3, marginBottom: 16 },
  gameBtn:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  gameBtnActive:    { backgroundColor: GOLD },
  gameBtnText:      { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 13 },
  gameBtnTextActive:{ color: '#fff', fontWeight: '700' },

  // Jackpot
  jackpotBox: { backgroundColor: GOLD + '18', borderRadius: 12, padding: 12, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: GOLD + '50' },
  jackpotLbl: { color: GOLD, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  jackpotAmt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Ticket rows
  ticketRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  ticketLabel:{ color: '#fff', fontSize: 13, fontWeight: '500' },
  ticketCost: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn:     { backgroundColor: PURPLE, borderRadius: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  qtyVal:     { color: '#fff', fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'center' },

  // 4D input
  fourdCard:       { backgroundColor: CARD, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  fourdCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fourdCardTitle:  { color: GOLD, fontSize: 13, fontWeight: '700' },
  fourdRemove:     { color: 'rgba(255,255,255,0.3)', fontSize: 14, paddingHorizontal: 4 },
  fourdAmtRow:     { flexDirection: 'row', gap: 8, marginBottom: 10 },
  fourdAmtGroup:   { flex: 1, alignItems: 'center' },
  fourdAmtLabel:   { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600', marginBottom: 6 },
  betTypeRow:      { flexDirection: 'row', gap: 6, marginBottom: 8, marginTop: 2 },
  betTypeBtn:      { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: DARK },
  betTypeBtnActive:{ borderColor: GOLD, backgroundColor: GOLD + '20' },
  betTypeBtnText:  { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  betTypeBtnTextActive: { color: GOLD, fontWeight: '700' },
  permsRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  permsOptions:    { flexDirection: 'row', gap: 6, marginLeft: 8 },
  permBtn:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: DARK },
  permBtnActive:   { borderColor: PURPLE, backgroundColor: PURPLE + '25' },
  permBtnText:     { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' },
  permBtnTextActive:{ color: PURPLE, fontWeight: '700' },
  addRowBtn:       { borderWidth: 1, borderColor: GOLD + '40', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  addRowBtnText:   { color: GOLD, fontSize: 13, fontWeight: '600' },

  // Results
  scoreBig:   { alignItems: 'center', backgroundColor: GOLD + '15', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: GOLD + '40' },
  scoreEmoji: { fontSize: 32, marginBottom: 4 },
  scoreNum:   { color: GOLD2, fontSize: 50, fontWeight: '800' },
  scoreOf:    { fontSize: 20, color: GOLD, fontWeight: '600' },
  scoreLabel: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  summaryItem:{ color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  summaryVal: { color: '#fff', fontWeight: '700' },
  barRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  barLabel:   { color: 'rgba(255,255,255,0.55)', fontSize: 11, width: 115 },
  barTrack:   { flex: 1, height: 7, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill:    { height: 7, backgroundColor: GOLD, borderRadius: 4 },
  barVal:     { color: GOLD, fontSize: 11, fontWeight: '700', width: 22, textAlign: 'right' },
  verdictBox: { backgroundColor: PURPLE + '25', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: PURPLE + '60' },
  verdictText:{ color: '#fff', fontSize: 13, lineHeight: 20, textAlign: 'center' },

  // Share card
  shareCard:       { borderRadius: 20, overflow: 'hidden', padding: 24, alignItems: 'center', minHeight: 280, backgroundColor: DARK },
  shareIcon:       { width: 64, height: 64, marginBottom: 8 },
  shareTitle:      { color: GOLD, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  shareScoreNum:   { color: '#fff', fontSize: 44, fontWeight: '800' },
  shareScoreOf:    { fontSize: 18, color: GOLD },
  shareScoreLabel: { color: GOLD2, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  shareDetail:     { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 3 },
  shareTagline:    { color: GOLD, fontSize: 12, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  shareAppName:    { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 6 },

  // Buttons
  goldBtn:        { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 12 },
  goldBtnDisabled:{ opacity: 0.4 },
  goldBtnText:    { color: DARK, fontSize: 15, fontWeight: '800' },
  outlineBtn:     { borderWidth: 1, borderColor: GOLD + '50', borderRadius: 14, paddingVertical: 12, width: '100%', alignItems: 'center', marginTop: 8 },
  outlineBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
});
