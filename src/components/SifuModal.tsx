import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TestIds } from 'react-native-google-mobile-ads';
import { useRewardedAd } from '../lib/rewardedAds';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import { supabase } from '../lib/supabase';
import SifuShareCard from './SifuShareCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Design tokens ─────────────────────────────────────────────────────────────
const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const TINT  = '#FDF0F1';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';
const FAINT = '#9A9A9A';
const RULE  = '#E4DEDE';
const { width: SW, height: SH } = Dimensions.get('window');

const SIFU_AD_ID = __DEV__ ? TestIds.REWARDED : Platform.OS === 'ios'
  ? 'ca-app-pub-6984775309510247/6853207551'
  : 'ca-app-pub-6984775309510247/8566385106';

const EXPLAINER_SEEN_KEY = 'sifu_explainer_seen';

// ── TOTO ticket types ─────────────────────────────────────────────────────────
const TOTO_TICKETS = [
  { key: 'ordinary',   label: 'ORDINARY',    combos: 1,   cost: 1   },
  { key: 'system7',    label: 'SYSTEM 7',    combos: 7,   cost: 7   },
  { key: 'system8',    label: 'SYSTEM 8',    combos: 28,  cost: 28  },
  { key: 'system9',    label: 'SYSTEM 9',    combos: 84,  cost: 84  },
  { key: 'system10',   label: 'SYSTEM 10',   combos: 210, cost: 210 },
  { key: 'system11',   label: 'SYSTEM 11',   combos: 462, cost: 462 },
  { key: 'system12',   label: 'SYSTEM 12',   combos: 924, cost: 924 },
  { key: 'systemroll', label: 'SYSTEM ROLL', combos: 44,  cost: 44  },
];
const TOTAL_COMBOS = 13_983_816;

// ── 4D types ──────────────────────────────────────────────────────────────────
type FourdBetType = 'ordinary' | 'ibet' | 'perm' | 'roll';
interface FourdRow { id: number; bigAmt: number; smallAmt: number; betType: FourdBetType; perms: 4|6|12|24; qty: number; }
const PERMS_OPTIONS: (4|6|12|24)[] = [4, 6, 12, 24];
const FOURD_PAYOUTS = {
  big:   { first: 2000, second: 1000, third: 490, starter: 250, consolation: 60 },
  small: { first: 3000, second: 2000, third: 1000, starter: 0,  consolation: 0  },
};
const FOURD_TOTAL = 10_000;
const FOURD_WINNERS = { first: 1, second: 1, third: 1, starter: 10, consolation: 10 };

// ── Scoring ───────────────────────────────────────────────────────────────────
function calcTotoScore(tickets: Record<string,number>, jackpot: number) {
  let totalCombos = 0, totalCost = 0, maxCombosPerEntry = 0;
  for (const t of TOTO_TICKETS) {
    const qty = tickets[t.key] ?? 0;
    if (qty > 0) {
      totalCombos += t.combos * qty;
      totalCost   += t.cost * qty;
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

function calcFourdExpectedReturn(row: FourdRow): number {
  const numsCovered = row.betType === 'ordinary' ? 1 : row.betType === 'roll' ? 10 : row.perms;
  const bigStake    = row.betType === 'ibet' ? row.bigAmt / row.perms   : row.bigAmt;
  const smallStake  = row.betType === 'ibet' ? row.smallAmt / row.perms : row.smallAmt;
  let totalReturn = 0;
  for (let i = 0; i < row.qty; i++) {
    for (const [tier, winners] of Object.entries(FOURD_WINNERS)) {
      const prob = (winners * numsCovered) / FOURD_TOTAL;
      totalReturn += prob * (bigStake * ((FOURD_PAYOUTS.big as any)[tier] ?? 0) + smallStake * ((FOURD_PAYOUTS.small as any)[tier] ?? 0));
    }
  }
  return totalReturn;
}

function calcFourdScore(rows: FourdRow[]) {
  if (!rows.length) return { score: 0, value: 0, coverage: 0, efficiency: 0, totalCost: 0, totalNums: 0 };
  let totalCost = 0, totalNums = 0, totalBig = 0, totalSmall = 0, maxNumsPerDollar = 0;
  for (const row of rows) {
    const numsCovered = row.betType === 'ordinary' ? 1 : row.betType === 'roll' ? 10 : row.perms;
    totalCost  += (row.bigAmt + row.smallAmt) * row.qty;
    totalNums  += numsCovered * row.qty;
    totalBig   += row.bigAmt * row.qty;
    totalSmall += row.smallAmt * row.qty;
    if ((row.bigAmt + row.smallAmt) > 0) {
      const npd = row.betType === 'ibet' ? numsCovered / (row.bigAmt + row.smallAmt) : 1;
      if (npd > maxNumsPerDollar) maxNumsPerDollar = npd;
    }
  }
  if (totalCost === 0) return { score: 0, value: 0, coverage: 0, efficiency: 0, totalCost: 0, totalNums: 0 };
  const bigRatio   = totalBig / (totalBig + totalSmall || 1);
  const value      = Math.round(55 * bigRatio + 45 * (1 - bigRatio));
  const coverage   = Math.min(100, Math.round((Math.log(totalNums + 1) / Math.log(FOURD_TOTAL)) * 100 * 5));
  const efficiency = Math.min(100, Math.round(20 + (maxNumsPerDollar / 24) * 80));
  const score      = Math.min(100, Math.round((value * 0.5) + (coverage * 0.3) + (efficiency * 0.2)));
  return { score, value, coverage, efficiency, totalCost, totalNums };
}

function getScoreLabel(score: number): { label: string; labelZH: string } {
  if (score <= 20) return { label: 'WEAK',         labelZH: '胜算太低' };
  if (score <= 40) return { label: 'BELOW AVERAGE',labelZH: '胜算不高' };
  if (score <= 55) return { label: 'FAIR',          labelZH: '一般般'  };
  if (score <= 70) return { label: 'GOOD',          labelZH: '不错的投注' };
  if (score <= 85) return { label: 'STRONG',        labelZH: '高手级别' };
  return              { label: 'ELITE',         labelZH: '认真要中奖啊？' };
}

function getVerdict(score: number, game: 'TOTO'|'4D', jackpot: number, ZH: boolean): string {
  if (game === 'TOTO') {
    const snowball = jackpot >= 5_000_000;
    if (score <= 20) return ZH ? '师父说：钱留着买好料，不要浪费。' : "Sifu says: Save your money, uncle.";
    if (score <= 40) return ZH ? '胜算不高，但万一呢？' : "Long shot. But hey, someone has to win.";
    if (score <= 55) return ZH ? (snowball ? '奖池够大，今晚值得一试！' : '普通一注，jackpot大一点师父会更开心。') : (snowball ? 'Big jackpot. Your score improves with the pool.' : "Middling. Structure is fine, efficiency is not.");
    if (score <= 70) return ZH ? '师父点头认可。' : "Sifu approves this bet.";
    if (score <= 85) return ZH ? '高手出手！今晚运气跟着你。' : "Strong. Full coverage, efficient per dollar.";
    return ZH ? '哇，认真的啊！师父祝你旗开得胜！' : "Elite. Maximum efficiency. Sifu is impressed.";
  } else {
    if (score <= 20) return ZH ? '师父说：这注不值得，省省吧。' : "This bet isn't worth it, uncle.";
    if (score <= 40) return ZH ? '胜算不高。试试iBet！' : "Long shot. Consider iBet to cover more numbers.";
    if (score <= 55) return ZH ? '一般。iBet可以提高效率分。' : "Middling. Structure is fine, efficiency is not.";
    if (score <= 70) return ZH ? '不错！Big bet覆盖更多奖项。' : "Good call. Big bet covers more prize tiers.";
    if (score <= 85) return ZH ? 'iBet全排列，师父点头。' : "Strong. Full permutation coverage, efficient per dollar.";
    return ZH ? '师父大力赞！' : "Elite. Maximum efficiency. Sifu is impressed.";
  }
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
  const insets = useSafeAreaInsets();
  type Screen = 'input' | 'adprompt' | 'results';
  const [screen,    setScreen]   = useState<Screen>('input');
  const [game,      setGame]     = useState<'TOTO'|'4D'>('TOTO');
  const [tickets,   setTickets]  = useState<Record<string,number>>({});
  const [jackpot,   setJackpot]  = useState(0);
  const [jackpotLabel, setJackpotLabel] = useState('...');
  const [result, setResult]   = useState<ReturnType<typeof calcTotoScore> | null>(null);
  // Ad is only requested once the modal is actually open.
  const { show: showAd } = useRewardedAd(SIFU_AD_ID, visible);
  const [sharing, setSharing] = useState(false);
  // 4D state
  const [fourdRows, setFourdRows] = useState<FourdRow[]>([{ id: 1, bigAmt: 1, smallAmt: 0, betType: 'ordinary', perms: 24, qty: 1 }]);
  const [fourdResult, setFourdResult] = useState<ReturnType<typeof calcFourdScore> | null>(null);
  const nextRowId = useRef(2);
  const shareCardRef = useRef<ViewShot>(null);

  const slideAnim   = useRef(new Animated.Value(SH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setScreen('input'); setResult(null); setFourdResult(null);
      setTickets({}); 
      setFourdRows([{ id: 1, bigAmt: 1, smallAmt: 0, betType: 'ordinary', perms: 24, qty: 1 }]);
      fetchJackpot();
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

  const fetchJackpot = async () => {
    const { data } = await supabase.from('toto_jackpot').select('jackpot_amount,next_draw_date').eq('id', 1).single();
    if (data) {
      setJackpot(data.jackpot_amount);
      setJackpotLabel('$' + Number(data.jackpot_amount).toLocaleString('en-SG'));
    }
  };


  const setQty = (key: string, qty: number) => setTickets(prev => ({ ...prev, [key]: Math.max(0, qty) }));
  const totalTotoSelected = Object.values(tickets).reduce((a, b) => a + b, 0);
  const fourdHasInput = fourdRows.some(r => (r.bigAmt + r.smallAmt) > 0 && r.qty > 0);

  const addFourdRow = () => setFourdRows(prev => [...prev, { id: nextRowId.current++, bigAmt: 1, smallAmt: 0, betType: 'ordinary', perms: 24, qty: 1 }]);
  const removeFourdRow = (id: number) => setFourdRows(prev => prev.filter(r => r.id !== id));
  const updateFourdRow = (id: number, patch: Partial<FourdRow>) => setFourdRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const showResults = () => {
    if (game === 'TOTO') { setResult(calcTotoScore(tickets, jackpot)); setFourdResult(null); }
    else { setFourdResult(calcFourdScore(fourdRows)); setResult(null); }
    setScreen('results');
  };

  const handleConsult = () => {
    if (sifuUnlocked) showResults();
    else setScreen('adprompt');
  };

  const handleWatchAd = () => {
    const unlock = () => { onUnlock(); showResults(); };
    // No ad ready (or it expired) — unlock anyway.
    if (!showAd({ onReward: unlock, onClosed: unlock })) unlock();
  };

  const handleClose = () => onClose();

  const handleShare = async () => {
    if (!shareCardRef.current) return;
    setSharing(true);
    try {
      const uri = await shareCardRef.current.capture();
      await RNShare.open({
        url: `file://${uri}`,
        type: 'image/jpeg',
        message: ZH ? '师父给我审计了！来 SG Lottery 也试试！🎰' : 'Sifu audited my bet! Try SG Lottery too! 🎰',
        failOnCancel: false,
      });
    } catch (_) {}
    setSharing(false);
  };

  // ── Toto totals ──
  const totoTotalCost   = TOTO_TICKETS.reduce((s, t) => s + t.cost * (tickets[t.key] ?? 0), 0);
  const totoTotalCombos = TOTO_TICKETS.reduce((s, t) => s + t.combos * (tickets[t.key] ?? 0), 0);

  // ── 4D totals ──
  const fourdTotalCost = fourdRows.reduce((s, r) => s + (r.bigAmt + r.smallAmt) * r.qty, 0);
  const fourdTotalNums = fourdRows.reduce((s, r) => {
    const n = r.betType === 'ordinary' ? 1 : r.betType === 'roll' ? 10 : r.perms;
    return s + n * r.qty;
  }, 0);

  // ── Screen: Input ─────────────────────────────────────────────────────────
  const ScreenInput = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>

      {/* TOTO input */}
      {game === 'TOTO' ? (
        <>
          <View style={s.jackpotRow}>
            <Text style={s.jackpotLabel}>{ZH ? '下期头奖' : 'NEXT JACKPOT'}</Text>
            <Text style={s.jackpotAmt}>{jackpotLabel}</Text>
          </View>
          <Text style={s.fieldLabel}>{ZH ? '你买了什么？' : 'WHAT ARE YOU BUYING?'}</Text>
          {TOTO_TICKETS.map(t => (
            <View key={t.key} style={s.ticketRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.ticketName}>{t.label}</Text>
                <Text style={s.ticketMeta}>${t.cost} · {t.combos} {t.combos === 1 ? 'COMBO' : 'COMBOS'}</Text>
              </View>
              <View style={s.stepperInline}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setQty(t.key, (tickets[t.key] ?? 0) - 1)}>
                  <Text style={s.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.stepVal}>{tickets[t.key] ?? 0}</Text>
                <TouchableOpacity style={s.stepBtn} onPress={() => setQty(t.key, (tickets[t.key] ?? 0) + 1)}>
                  <Text style={s.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={s.totalRow}>
            <View>
              <Text style={s.totalLabel}>{ZH ? '总投注' : 'TOTAL OUTLAY'}</Text>
              <Text style={s.totalMeta}>{totoTotalCombos.toLocaleString()} {ZH ? '组合' : 'OF'} {TOTAL_COMBOS.toLocaleString()} {ZH ? '' : 'COMBINATIONS'}</Text>
            </View>
            <Text style={s.totalAmt}>${totoTotalCost.toLocaleString()}</Text>
          </View>
        </>
      ) : (
        <>
          {/* 4D input */}
          {fourdRows.map((row, idx) => {
            const numsCovered = row.betType === 'ordinary' ? 1 : row.betType === 'roll' ? 10 : row.perms;
            const rowCost = (row.bigAmt + row.smallAmt) * row.qty;
            return (
              <View key={row.id} style={s.fourdCard}>
                <View style={s.fourdCardHeader}>
                  <Text style={s.fourdCardTitle}>#{idx + 1}</Text>
                  {fourdRows.length > 1 && (
                    <TouchableOpacity onPress={() => removeFourdRow(row.id)}>
                      <Text style={s.fourdRemove}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* Big / Small / Qty */}
                <View style={s.fourdAmtRow}>
                  {[
                    { lbl: ZH ? '大 $' : 'BIG $', val: row.bigAmt, key: 'bigAmt' },
                    { lbl: ZH ? '小 $' : 'SMALL $', val: row.smallAmt, key: 'smallAmt' },
                    { lbl: ZH ? '张数' : 'QTY', val: row.qty, key: 'qty' },
                  ].map(f => (
                    <View key={f.key} style={s.fourdAmtGroup}>
                      <Text style={s.fourdAmtLabel}>{f.lbl}</Text>
                      <View style={s.stepperInline}>
                        <TouchableOpacity style={s.stepBtn} onPress={() => updateFourdRow(row.id, { [f.key]: Math.max(f.key === 'qty' ? 1 : 0, f.val - 1) } as any)}>
                          <Text style={s.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={s.stepVal}>{f.val}</Text>
                        <TouchableOpacity style={s.stepBtn} onPress={() => updateFourdRow(row.id, { [f.key]: f.val + 1 } as any)}>
                          <Text style={s.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
                {/* Bet type */}
                <View style={s.betTypeRow}>
                  {(['ordinary','ibet','perm','roll'] as FourdBetType[]).map(bt => (
                    <TouchableOpacity key={bt} style={[s.betTypeBtn, row.betType === bt && s.betTypeBtnActive]} onPress={() => updateFourdRow(row.id, { betType: bt })}>
                      <Text style={[s.betTypeBtnText, row.betType === bt && s.betTypeBtnTextActive]}>
                        {bt === 'ordinary' ? 'ORD' : bt === 'ibet' ? 'IBET' : bt === 'perm' ? 'PERM' : 'ROLL'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Perms */}
                {(row.betType === 'ibet' || row.betType === 'perm') && (
                  <View style={s.permsRow}>
                    <Text style={s.fourdAmtLabel}>{ZH ? '排列' : 'PERMS'}</Text>
                    <View style={s.permsOptions}>
                      {PERMS_OPTIONS.map(p => (
                        <TouchableOpacity key={p} style={[s.permBtn, row.perms === p && s.permBtnActive]} onPress={() => updateFourdRow(row.id, { perms: p })}>
                          <Text style={[s.permBtnText, row.perms === p && s.permBtnTextActive]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {/* Summary line */}
                <Text style={s.fourdSummary}>COVERS {numsCovered} NUMBERS · ${rowCost} OUTLAY</Text>
              </View>
            );
          })}

          {/* Add number */}
          <TouchableOpacity style={s.addRowBtn} onPress={addFourdRow}>
            <Text style={s.addRowBtnText}>+ {ZH ? '加多一个号码' : 'ADD NUMBER'}</Text>
          </TouchableOpacity>

          {/* Total */}
          <View style={s.totalRow}>
            <View>
              <Text style={s.totalLabel}>{ZH ? '总投注' : 'TOTAL OUTLAY'}</Text>
              <Text style={s.totalMeta}>{fourdTotalNums.toLocaleString()} {ZH ? '个号码' : 'OF 10,000 NUMBERS'}</Text>
            </View>
            <Text style={s.totalAmt}>${fourdTotalCost.toLocaleString()}</Text>
          </View>
        </>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[s.redBtnFull, (game === 'TOTO' ? totalTotoSelected === 0 : !fourdHasInput) && s.redBtnDisabled]}
        onPress={handleConsult}
        disabled={game === 'TOTO' ? totalTotoSelected === 0 : !fourdHasInput}
      >
        <Text style={s.redBtnText}>{ZH ? '问师父' : 'CONSULT SIFU'}</Text>
      </TouchableOpacity>

      {/* Disclaimer */}
      <Text style={s.disclaimer}>
        SCORE = VALUE 50% + COVERAGE 30% + EFFICIENCY 20%. A high score means a better-structured bet, never a likelier win.
      </Text>
    </ScrollView>
  );

  // ── Screen: Ad Prompt — shown as floating modal overlay like GoF ─────────
  const AdPromptModal = (
    <View style={screen === 'adprompt' ? s.adPromptContainer : s.adPromptHidden}>
      <View style={s.adPromptOverlay}>
        <View style={s.adPromptBox}>
          <Text style={s.adPromptTitle}>{ZH ? '师父准备好了！' : 'SIFU IS READY'}</Text>
          <Text style={s.adPromptBody}>
            {ZH ? '审计是免费的。一则短广告让它保持免费。' : 'The audit is free. One short ad keeps it that way.'}
          </Text>
          <TouchableOpacity style={s.adPromptBtn} onPress={handleWatchAd}>
            <Text style={s.adPromptBtnText}>{ZH ? '观看广告' : 'WATCH AD'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.adPromptBack} onPress={() => setScreen('input')}>
            <Text style={s.adPromptBackText}>{ZH ? '返回编辑' : 'EDIT'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ── Screen: Results ───────────────────────────────────────────────────────
  const ScreenResults = (() => {
    const activeResult = game === 'TOTO' ? result : fourdResult;
    if (!activeResult) return null;
    const { score, value, coverage, efficiency, totalCost } = activeResult;
    const totalCombos = (activeResult as any).totalCombos ?? 0;
    const totalNums   = (activeResult as any).totalNums ?? 0;
    const { label, labelZH } = getScoreLabel(score);
    const verdict = getVerdict(score, game, jackpot, ZH);
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
        {/* Score block */}
        <View style={s.scoreBlock}>
          <View style={s.scoreLeft}>
            <Text style={s.scoreBig}>{score}</Text>
          </View>
          <View style={s.scoreMiddle}>
            <Text style={s.scoreLabel}>{ZH ? labelZH : label}</Text>
            <Text style={s.scoreOf}>{ZH ? '满分100' : 'OUT OF 100'}</Text>
          </View>
          <View style={s.scoreRight}>
            <Text style={s.scoreGame}>{game}</Text>
            <Text style={s.scoreCost}>${totalCost.toLocaleString()}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Breakdown bars */}
        {[
          { label: `VALUE 50%`,      val: value,      weight: 0.5 },
          { label: `COVERAGE 30%`,   val: coverage,   weight: 0.3 },
          { label: `EFFICIENCY 20%`, val: efficiency, weight: 0.2 },
        ].map(b => (
          <View key={b.label} style={s.barSection}>
            <View style={s.barHeader}>
              <Text style={s.barLabel}>{b.label}</Text>
              <Text style={s.barVal}>{Math.round(b.val * b.weight)}</Text>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.min(100, Math.round(b.val * b.weight * 2))}%` }]} />
            </View>
          </View>
        ))}

        <View style={s.divider} />

        {/* Covered */}
        <View style={s.coveredRow}>
          <Text style={s.coveredLabel}>{game === 'TOTO' ? (ZH ? '组合覆盖' : 'COMBINATIONS COVERED') : (ZH ? '号码覆盖' : 'NUMBERS COVERED')}</Text>
          <Text style={s.coveredVal}>{game === 'TOTO' ? totalCombos.toLocaleString() : totalNums.toLocaleString()}</Text>
        </View>

        <View style={s.divider} />

        {/* Verdict */}
        <View style={s.verdictBlock}>
          <Text style={s.verdictTitle}>{ZH ? '师父判断' : 'VERDICT'}</Text>
          <Text style={s.verdictText}>{verdict}</Text>
        </View>

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.outlineBtn} onPress={() => { setResult(null); setFourdResult(null); setScreen('input'); }}>
            <Text style={s.outlineBtnText}>{ZH ? '编辑' : 'EDIT'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.redBtn, { flex: 1, marginBottom: 0 }]} onPress={handleShare} disabled={sharing}>
            {sharing ? <ActivityIndicator color={PAPER} /> : <Text style={s.redBtnText}>{ZH ? '分享' : 'SHARE'}</Text>}
          </TouchableOpacity>
        </View>

        {/* Hidden share card for capture */}
        <ViewShot ref={shareCardRef} style={s.hiddenCard} options={{ format: 'jpg', quality: 0.95 }}>
          <SifuShareCard
            score={score}
            value={value}
            coverage={coverage}
            efficiency={efficiency}
            totalCost={totalCost}
            totalCombos={game === 'TOTO' ? totalCombos : undefined}
            totalNums={game === '4D' ? (activeResult as any).totalNums : undefined}
            game={game}
            verdict={verdict}
            jackpot={game === 'TOTO' ? jackpot : undefined}
            lang={lang}
          />
        </ViewShot>
      </ScrollView>
    );
  })();

  // ── Modal shell ───────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }], height: SH * 0.90 - insets.bottom, paddingBottom: insets.bottom }]}>

          {/* Red header */}
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetTitle}>{ZH ? '师父审计' : 'SIFU AUDIT'}</Text>
              <Text style={s.sheetSub}>{ZH ? '师父 · 投注质量审查' : 'SIFU · BET QUALITY REVIEW'}</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
              <Text style={s.closeBtnText}>{ZH ? '关闭' : 'CLOSE'}</Text>
            </TouchableOpacity>
          </View>

          {/* TOTO / 4D toggle — only on input screen */}
          {screen === 'input' && (
            <View style={s.gameToggle}>
              {(['TOTO', '4D'] as const).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.gameBtn, game === g && s.gameBtnActive]}
                  onPress={() => { setGame(g); setResult(null); setFourdResult(null); }}
                >
                  <Text style={[s.gameBtnText, game === g && s.gameBtnTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Screen content */}
          <View style={s.screenContainer}>
            {screen === 'input'   && ScreenInput}
            {screen === 'results' && ScreenResults}
          </View>
        </Animated.View>
      </Animated.View>

      {/* Ad prompt — floating modal same as GoF */}
      {AdPromptModal}
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: PAPER, height: SH * 0.90, borderTopWidth: 3, borderColor: RED },

  sheetHeader:  { backgroundColor: RED, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 20, color: PAPER, letterSpacing: 0.5 },
  sheetSub:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, marginTop: 3 },
  closeBtn:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 9, paddingVertical: 5 },
  closeBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 1 },

  // Game toggle
  gameToggle:        { flexDirection: 'row', borderBottomWidth: 1, borderColor: RED, backgroundColor: RED },
  gameBtn:           { flex: 1, paddingVertical: 11, alignItems: 'center' },
  gameBtnActive:     { backgroundColor: PAPER },
  gameBtnText:       { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  gameBtnTextActive: { color: RED },

  screenContainer: { flex: 1 },
  screenPad:       { padding: 16, paddingBottom: 32 },

  fieldLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 8 },

  // Jackpot
  jackpotRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: RULE, marginBottom: 8 },
  jackpotLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2 },
  jackpotAmt:   { fontFamily: 'IBMPlexMono-Bold', fontSize: 18, color: INK },

  // TOTO ticket rows
  ticketRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: RULE },
  ticketName:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: INK, letterSpacing: 1 },
  ticketMeta:  { fontFamily: 'IBMPlexMono-Regular', fontSize: 10, color: FAINT, letterSpacing: 0.5, marginTop: 2 },
  ticketRight: { marginLeft: 'auto' },

  // Inline stepper
  stepperInline: { flexDirection: 'row', borderWidth: 1, borderColor: RED, alignSelf: 'flex-end' },
  stepBtn:       { width: 32, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  stepBtnText:   { fontFamily: 'IBMPlexMono-Bold', fontSize: 16, color: RED, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  stepVal:       { minWidth: 32, fontFamily: 'IBMPlexMono-SemiBold', fontSize: 13, color: INK, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 4 },

  // Total row
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderColor: RULE, marginTop: 4, marginBottom: 12 },
  totalLabel:{ fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: MUTE, letterSpacing: 2 },
  totalMeta: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 0.5, marginTop: 2 },
  totalAmt:  { fontFamily: 'IBMPlexMono-Bold', fontSize: 22, color: INK },

  // Buttons
  redBtn:         { backgroundColor: RED, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  redBtnFull:     { backgroundColor: RED, paddingVertical: 14, alignItems: 'center', marginBottom: 8, alignSelf: 'stretch' },
  redBtnDisabled: { opacity: 0.4 },
  redBtnText:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 2 },
  outlineBtn:     { flex: 1, borderWidth: 1, borderColor: INK, paddingVertical: 14, alignItems: 'center' },
  outlineBtnFull: { borderWidth: 1, borderColor: INK, paddingVertical: 14, alignItems: 'center', width: '100%' },
  outlineBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: INK, letterSpacing: 2 },
  actionRow:      { flexDirection: 'row', gap: 0, marginTop: 8 },

  // Disclaimer
  disclaimer: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, lineHeight: 14, marginTop: 8 },

  // 4D card
  fourdCard:       { borderWidth: 1, borderColor: RED, backgroundColor: TINT, padding: 12, marginBottom: 10 },
  fourdCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  fourdCardTitle:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: INK },
  fourdRemove:     { fontFamily: 'IBMPlexMono-Regular', fontSize: 14, color: FAINT },
  fourdAmtRow:     { flexDirection: 'row', gap: 6, marginBottom: 10 },
  fourdAmtGroup:   { flex: 1 },
  fourdAmtLabel:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1, marginBottom: 4 },
  fourdSummary:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: MUTE, letterSpacing: 0.5, marginTop: 8 },

  // Bet type
  betTypeRow:          { flexDirection: 'row', gap: 4, marginBottom: 8 },
  betTypeBtn:          { flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: RULE, alignItems: 'center', backgroundColor: PAPER },
  betTypeBtnActive:    { backgroundColor: RED, borderColor: RED },
  betTypeBtnText:      { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: MUTE },
  betTypeBtnTextActive:{ color: PAPER },

  // Perms
  permsRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  permsOptions: { flexDirection: 'row', gap: 4, flex: 1 },
  permBtn:      { flex: 1, paddingVertical: 7, borderWidth: 1, borderColor: RULE, alignItems: 'center', backgroundColor: PAPER },
  permBtnActive:{ backgroundColor: RED, borderColor: RED },
  permBtnText:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: MUTE },
  permBtnTextActive: { color: PAPER },

  // Add row
  addRowBtn:     { borderWidth: 1, borderColor: RED, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  addRowBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: RED, letterSpacing: 2 },

  // Ad prompt — floating modal matching GoF style
  adPromptContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  adPromptHidden:    { display: 'none' },
  adPromptOverlay:  { flex: 1, backgroundColor: 'rgba(26,26,26,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  adPromptBox:      { backgroundColor: PAPER, borderTopWidth: 3, borderColor: RED, padding: 24, width: '100%' },
  adPromptTitle:    { fontFamily: 'IBMPlexMono-Bold', fontSize: 13, color: INK, letterSpacing: 2, marginBottom: 10 },
  adPromptBody:     { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: MUTE, lineHeight: 18, marginBottom: 20 },
  adPromptBtn:      { backgroundColor: RED, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  adPromptBtnText:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: PAPER, letterSpacing: 2 },
  adPromptBack:     { alignItems: 'center', paddingVertical: 10 },
  adPromptBackText: { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: MUTE, letterSpacing: 1 },

  // Results
  scoreBlock:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  scoreLeft:   { marginRight: 12 },
  scoreBig:    { fontFamily: 'ArchivoNarrow-Bold', fontSize: 64, color: INK, lineHeight: 68 },
  scoreMiddle: { flex: 1 },
  scoreLabel:  { fontFamily: 'IBMPlexMono-Bold', fontSize: 14, color: RED, letterSpacing: 1 },
  scoreOf:     { fontFamily: 'IBMPlexMono-Regular', fontSize: 10, color: FAINT, letterSpacing: 1, marginTop: 2 },
  scoreRight:  { alignItems: 'flex-end' },
  scoreGame:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: FAINT, letterSpacing: 2 },
  scoreCost:   { fontFamily: 'IBMPlexMono-Bold', fontSize: 18, color: INK },

  divider: { height: 1, backgroundColor: RULE, marginVertical: 12 },

  barSection: { marginBottom: 10 },
  barHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 1 },
  barVal:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: INK },
  barTrack:   { height: 8, backgroundColor: RULE, borderWidth: 1, borderColor: RED, overflow: 'hidden' },
  barFill:    { height: 8, backgroundColor: RED },

  coveredRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  coveredLabel:{ fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2 },
  coveredVal:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 13, color: INK },

  verdictBlock: { paddingVertical: 12 },
  verdictTitle: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 8 },
  verdictText:  { fontFamily: 'ArchivoNarrow-Bold', fontSize: 16, color: INK, lineHeight: 22 },
  hiddenCard:   { position: 'absolute', left: -9999, top: -9999 },
});
