import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useLang } from '../lib/LangContext';

// ── Design tokens ─────────────────────────────────────────────────────────────
const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';
const FAINT = '#9A9A9A';
const RULE  = '#E4DEDE';
const TINT  = '#FDF0F1';

// ── AdMob ─────────────────────────────────────────────────────────────────────
const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-6984775309510247/6047752765';
const rewarded = RewardedAd.createForAdRequest(REWARDED_ID, { requestNonPersonalizedAdsOnly: true });

// ── Generator constants ───────────────────────────────────────────────────────
const STRATEGIES = ['Frequency', 'Mean Reversion', 'Positional Bias', 'Sum Range', 'Odd/Even', 'Wheeling'];
const TEMPS      = ['Hottest', 'Coldest', 'Balanced'];
const WINDOWS    = [25, 50, 100, 200];
const SLIP_OPTS  = [2, 3, 4, 5, 6];

const STRATEGY_LABEL = {
  'Frequency':      { en: 'FREQUENCY',       zh: '频率',    temp: 'Balanced' },
  'Mean Reversion': { en: 'MEAN REVERSION',  zh: '均值回归', temp: 'Coldest'  },
  'Positional Bias':{ en: 'POSITIONAL BIAS', zh: '位置偏好', temp: 'Hottest'  },
  'Sum Range':      { en: 'SUM RANGE',       zh: '总和范围', temp: 'Balanced' },
  'Odd/Even':       { en: 'ODD / EVEN',      zh: '奇偶',    temp: 'Balanced' },
  'Wheeling':       { en: 'WHEELING',        zh: '轮式',    temp: 'Coldest'  },
};

const TEMP_LABEL = { Hottest: 'HOTTEST', Coldest: 'COLDEST', Balanced: 'BALANCED' };

const METHOD_NOTE = {
  'Frequency':       { en: 'Filtered to the historical frequency band.', zh: '按历史频率筛选。' },
  'Mean Reversion':  { en: 'Numbers absent from the last 10 draws.', zh: '最近10期未出现的号码。' },
  'Positional Bias': { en: 'Each digit weighted by positional frequency.', zh: '每位数字按位置频率加权。' },
  'Sum Range':       { en: 'Filtered to the historical sum band.', zh: '按历史总和范围筛选。' },
  'Odd/Even':        { en: 'Balanced odd/even ratio applied.', zh: '平衡奇偶比例。' },
  'Wheeling':        { en: 'Random subset of a hot pool.', zh: '热号码池随机子集。' },
};

// ── 4D prize tables ───────────────────────────────────────────────────────────
const PRIZES_BIG   = { '1st': 2000, '2nd': 1000, '3rd': 490, 'Starter': 250, 'Consolation': 60 };
const PRIZES_SMALL = { '1st': 3000, '2nd': 2000, '3rd': 800, 'Starter': 0,   'Consolation': 0  };

// ── Singlish quips ────────────────────────────────────────────────────────────
const QUIPS_LOSS_EN = [
  "Aiyoh — the numbers don't lie lah.",
  "Wah lau, Singapore Pools 1, you 0.",
  "Next time confirm strike one. Maybe.",
  "Uncle, the house always wins leh.",
  "Sian ah. But at least you tried.",
];
const QUIPS_WIN_EN = [
  "Eh, not bad leh! Lucky you tracked it.",
  "Wah, got strike! Should have bet more.",
  "See lah, the numbers can work one.",
  "Steady lah. Fortune favours the bold.",
];
const QUIPS_LOSS_ZH = [
  "哎哟 — 数字不会说谎嘛。",
  "哇咧，新加坡博彩1，你0。",
  "下次一定中。也许啦。",
  "叔叔，庄家总是赢的。",
  "算了，至少你试过了。",
];
const QUIPS_WIN_ZH = [
  "哇，还不赖嘛！幸好你记录下来了。",
  "哇，中了！早知道买多一点。",
  "看吧，号码也是可以的。",
  "稳了啦。财富眷顾勇敢的人。",
];

// ── Generator helpers ─────────────────────────────────────────────────────────
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr)    { return [...arr].sort(() => Math.random() - 0.5); }
function pad(n)          { return String(Math.abs(Math.round(n))).padStart(4, '0').slice(0, 4); }

function balancedCols(n) {
  if (n <= 3) return n;
  for (let d = 3; d >= 2; d--) { if (n % d === 0) return d; }
  return 3;
}

function generate4D(draws, strategy, temp) {
  const freq = {};
  draws.forEach(d => {
    [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => {
      if (n) freq[parseInt(n)] = (freq[parseInt(n)] || 0) + 1;
    });
  });
  const sorted = Object.entries(freq).sort((a, b) =>
    temp === 'Coldest' ? a[1] - b[1] : b[1] - a[1]
  );

  if (strategy === 'Positional Bias') {
    const positions = [[], [], [], []];
    draws.forEach(d => {
      [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => {
        if (n) String(n).padStart(4,'0').split('').forEach((digit, i) => positions[i].push(parseInt(digit)));
      });
    });
    return Array.from({ length: 3 }, () => {
      const digits = positions.map(pos => {
        if (!pos.length) return Math.floor(Math.random() * 10);
        const dFreq = {};
        pos.forEach(d => { dFreq[d] = (dFreq[d] || 0) + 1; });
        const sd = Object.entries(dFreq).sort((a, b) => b[1] - a[1] + (Math.random()-0.5)*0.1);
        return parseInt(sd[Math.floor(Math.random() * Math.min(4, sd.length))][0]);
      });
      return digits.join('').padStart(4, '0');
    });
  }
  if (strategy === 'Mean Reversion') {
    const recent = new Set();
    draws.slice(0, 10).forEach(d => {
      [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => { if (n) recent.add(parseInt(n)); });
    });
    const overdue = Object.keys(freq).map(Number).filter(n => !recent.has(n));
    return shuffle(overdue).slice(0, 3).map(n => pad(n));
  }
  if (strategy === 'Sum Range') {
    const pool = sorted.slice(0, 200);
    for (let i = 0; i < 200; i++) {
      const candidates = shuffle(pool).slice(0, 3).map(x => parseInt(x[0]));
      const sum = candidates.reduce((a, b) => a + b, 0);
      if (sum >= 3000 && sum <= 7000) return candidates.map(n => pad(n));
    }
    return shuffle(pool).slice(0, 3).map(x => pad(parseInt(x[0])));
  }
  if (strategy === 'Odd/Even') {
    for (let i = 0; i < 200; i++) {
      const candidates = shuffle(sorted.slice(0, 200)).slice(0, 3).map(x => parseInt(x[0]));
      const odds = candidates.filter(n => n % 2 !== 0).length;
      if (odds === 1 || odds === 2) return candidates.map(n => pad(n));
    }
    return shuffle(sorted.slice(0, 3)).map(x => pad(parseInt(x[0])));
  }
  // Frequency / Wheeling / default
  const pool = temp === 'Coldest' ? sorted.filter(x => x[1] > 0) : sorted;
  return shuffle(pool.slice(0, 100)).slice(0, 3).map(x => pad(parseInt(x[0])));
}

// ── Backtest helpers ──────────────────────────────────────────────────────────
function calcNumPerms(num) {
  const freq = {};
  num.split('').forEach(d => (freq[d] = (freq[d] || 0) + 1));
  let denom = 1;
  Object.values(freq).forEach(f => { for (let i = 2; i <= f; i++) denom *= i; });
  return 24 / denom;
}

function getAllPerms(num) {
  const results = new Set();
  const permute = (arr, cur) => {
    if (!arr.length) { results.add(cur); return; }
    arr.forEach((d, i) => { const r = [...arr]; r.splice(i, 1); permute(r, cur + d); });
  };
  permute(num.split(''), '');
  return [...results];
}

function getStartDate(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

function fmtMoney(n) {
  return '$' + Math.abs(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Ad Support Prompt ─────────────────────────────────────────────────────────
function SupportPrompt({ visible, onWatchAd, onSkip, lang }) {
  const ZH = lang === 'ZH';
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={p.overlay}>
        <View style={p.box}>
          <Text style={p.title}>{ZH ? '支持开发者！' : 'SUPPORT THE DEV'}</Text>
          <Text style={p.body}>
            {ZH
              ? '看一则短广告来支持开发者并生成您的幸运号码！'
              : 'Watch a short ad to support the developer and generate your lucky numbers.'}
          </Text>
          <TouchableOpacity style={p.btn} onPress={onWatchAd}>
            <Text style={p.btnText}>{ZH ? '观看广告' : 'WATCH AD'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={p.skipBtn} onPress={onSkip}>
            <Text style={p.skipBtnText}>{ZH ? '跳过' : 'Skip'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FourdLabScreen() {
  const { lang } = useLang();
  const ZH = lang === 'ZH';

  const [mode, setMode]       = useState('generate'); // 'generate' | 'backtest'

  // ── Generator state ──
  const [allDraws, setAllDraws]   = useState({});
  const [slipCount, setSlipCount] = useState(3);
  const [sets, setSets]           = useState([]);
  const [genLoading, setGenLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adLoaded, setAdLoaded]   = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const doGenerateRef = useRef(null);

  // ── Backtest state ──
  const [bet, setBet]           = useState('');
  const [bigAmt, setBigAmt]     = useState(1);
  const [smallAmt, setSmallAmt] = useState(0);
  const [betMode, setBetMode]   = useState('perm'); // 'perm' | 'ibet'
  const [frame, setFrame]       = useState(4);
  const [btLoading, setBtLoading] = useState(false);
  const [btResult, setBtResult] = useState(null);

  const numPerms = bet.length === 4 ? calcNumPerms(bet) : null;

  // ── Load draws + ad ──
  useEffect(() => {
    const fetchData = async () => {
      const results = {};
      for (const w of WINDOWS) {
        const { data } = await supabase
          .from('fourd_draws')
          .select('prize_1st,prize_2nd,prize_3rd')
          .order('draw_date', { ascending: false })
          .limit(w);
        if (data) results[w] = data;
      }
      setAllDraws(results);
      setGenLoading(false);
    };
    fetchData();

    const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => setAdLoaded(true));
    const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {});
    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false); rewarded.load(); doGenerateRef.current?.();
    });
    const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      setAdLoaded(false); doGenerateRef.current?.();
    });
    rewarded.load();
    return () => { unsubLoaded(); unsubEarned(); unsubClosed(); unsubError(); };
  }, []);

  // ── Generate ──
  const doGenerate = useCallback(() => {
    const stratPool = shuffle(STRATEGIES);
    const newSets = Array.from({ length: slipCount }, (_, i) => {
      const strategy = stratPool[i % stratPool.length];
      const temp     = STRATEGY_LABEL[strategy]?.temp || pickRandom(TEMPS);
      const window   = pickRandom(WINDOWS);
      const draws    = allDraws[window] || [];
      const numbers  = generate4D(draws, strategy, temp);
      const note     = METHOD_NOTE[strategy];
      return { strategy, temp, window, numbers, note };
    });
    setSets(newSets);
    setGenerating(false);
    setShowPrompt(false);
  }, [allDraws, slipCount]);

  useEffect(() => { doGenerateRef.current = doGenerate; }, [doGenerate]);

  const handleGenerate = () => { setGenerating(true); setShowPrompt(true); };
  const handleWatchAd  = () => { if (adLoaded) rewarded.show(); else doGenerate(); };

  // ── Backtest ──
  const handleKeypad = (digit) => {
    if (bet.length < 4) { setBet(prev => prev + digit); setBtResult(null); }
  };
  const handleDel = () => { setBet(prev => prev.slice(0, -1)); setBtResult(null); };

  const runBacktest = async () => {
    if (bet.length !== 4) return;
    setBtLoading(true); setBtResult(null);
    try {
      const nPerms   = numPerms || 1;
      const perms    = betMode === 'ibet' ? getAllPerms(bet) : getAllPerms(bet);
      const costPerDraw = betMode === 'perm' ? (bigAmt + smallAmt) * nPerms : (bigAmt + smallAmt);

      const { data: draws } = await supabase
        .from('fourd_draws')
        .select('draw_no, draw_date, prize_1st, prize_2nd, prize_3rd')
        .gte('draw_date', getStartDate(frame))
        .order('draw_date', { ascending: false });

      if (!draws?.length) { setBtResult({ draws: 0, spent: 0, won: 0, strikes: [], nPerms }); setBtLoading(false); return; }

      const drawNos = draws.map(d => d.draw_no);
      const { data: prizeData } = await supabase
        .from('fourd_prizes').select('draw_no, category, number').in('draw_no', drawNos);

      const totalSpent = costPerDraw * draws.length;
      let totalWon = 0;
      const strikes = [];

      draws.forEach(draw => {
        const dp          = prizeData?.filter(p => p.draw_no === draw.draw_no) || [];
        const starters    = dp.filter(p => p.category === 'starter').map(p => p.number);
        const consolations= dp.filter(p => p.category === 'consolation').map(p => p.number);
        perms.forEach(num => {
          let prizeKey = null;
          if      (num === draw.prize_1st)     prizeKey = '1st';
          else if (num === draw.prize_2nd)     prizeKey = '2nd';
          else if (num === draw.prize_3rd)     prizeKey = '3rd';
          else if (starters.includes(num))     prizeKey = 'Starter';
          else if (consolations.includes(num)) prizeKey = 'Consolation';
          if (prizeKey) {
            const win = betMode === 'ibet'
              ? Math.floor((bigAmt * PRIZES_BIG[prizeKey] / nPerms) * 10) / 10 +
                Math.floor((smallAmt * PRIZES_SMALL[prizeKey] / nPerms) * 10) / 10
              : bigAmt * PRIZES_BIG[prizeKey] + smallAmt * PRIZES_SMALL[prizeKey];
            totalWon += win;
            strikes.push({ date: draw.draw_date, number: num, category: prizeKey, win });
          }
        });
      });
      setBtResult({ draws: draws.length, spent: totalSpent, won: totalWon, strikes, nPerms });
    } catch (_) {}
    setBtLoading(false);
  };

  // ── Renders ───────────────────────────────────────────────────────────────
  const renderGenerate = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      {/* Slip count */}
      <Text style={s.fieldLabel}>{ZH ? '打印张数' : 'SLIPS TO PRINT'}</Text>
      <View style={s.chipRow}>
        {SLIP_OPTS.map(n => (
          <TouchableOpacity key={n} style={[s.chip, slipCount === n && s.chipActive]} onPress={() => setSlipCount(n)}>
            <Text style={[s.chipText, slipCount === n && s.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Run button */}
      <TouchableOpacity style={s.redBtn} onPress={handleGenerate} disabled={generating || genLoading}>
        {generating && !showPrompt
          ? <ActivityIndicator color={PAPER} />
          : <Text style={s.redBtnText}>{ZH ? '运行生成器' : 'RUN GENERATOR'}</Text>}
      </TouchableOpacity>

      {/* Empty state */}
      {sets.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyLine1}>{ZH ? '暂无号码。' : 'NO SLIPS PRINTED.'}</Text>
          <Text style={s.emptyLine2}>{ZH ? '生成器等待中。' : 'THE MACHINE IS WAITING.'}</Text>
        </View>
      )}

      {/* Result cards */}
      {sets.map((set, idx) => {
        const cols = balancedCols(set.numbers.length);
        const strat = STRATEGY_LABEL[set.strategy];
        const note  = set.note;
        return (
          <View key={idx} style={s.genCard}>
            <View style={s.genCardHeader}>
              <Text style={s.genCardStrategy}>{ZH ? strat?.zh : strat?.en}</Text>
              <Text style={s.genCardTemp}>{TEMP_LABEL[set.temp]}</Text>
            </View>
            <View style={s.genGrid}>
              {set.numbers.map((n, i) => (
                <View key={i} style={s.genCell}>
                  <Text style={s.genNum}>{n}</Text>
                </View>
              ))}
            </View>
            <Text style={s.genNote}>
              {ZH ? note?.zh : note?.en} · {ZH ? `最近${set.window}期` : `last ${set.window} draws.`}
            </Text>
          </View>
        );
      })}

      {/* Honesty note */}
      {sets.length > 0 && (
        <View style={s.honestyBox}>
          <Text style={s.honestyText}>
            {ZH
              ? '这些是历史频率的排列，不是预测。每个组合中奖机会相同。策略名称描述排序方式，不是优势。'
              : 'These are arrangements of past frequency, not predictions. Every combination remains equally likely. The strategy names describe the sort, not an edge.'}
          </Text>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  const renderBacktest = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      {/* Number display */}
      <Text style={s.fieldLabel}>{ZH ? '测试号码' : 'NUMBER UNDER TEST'}</Text>
      <View style={s.numberRow}>
        <Text style={s.numberDisplay}>
          {bet.padEnd(4, '·')}
        </Text>
        <TouchableOpacity style={s.delBtn} onPress={handleDel}>
          <Text style={s.delBtnText}>DEL</Text>
        </TouchableOpacity>
      </View>

      {/* Keypad */}
      <View style={s.keypad}>
        {[1,2,3,4,5,6,7,8,9,0].map(d => (
          <TouchableOpacity
            key={d}
            style={s.key}
            onPress={() => handleKeypad(String(d))}
            disabled={bet.length >= 4}
          >
            <View style={s.keyInner}>
              <Text style={s.keyText}>{d}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Big / Small steppers */}
      <View style={s.stakeRow}>
        <View style={s.stakeGroup}>
          <Text style={s.fieldLabel}>{ZH ? '大 (BIG)' : 'BIG'}</Text>
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setBigAmt(a => Math.max(0, a - 1))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepVal}>${bigAmt}</Text>
            <TouchableOpacity style={s.stepBtn} onPress={() => setBigAmt(a => a + 1)}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.stakeGroup}>
          <Text style={s.fieldLabel}>{ZH ? '小 (SMALL)' : 'SMALL'}</Text>
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setSmallAmt(a => Math.max(0, a - 1))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepVal}>${smallAmt}</Text>
            <TouchableOpacity style={s.stepBtn} onPress={() => setSmallAmt(a => a + 1)}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Perm / iBet toggle */}
      {bet.length === 4 && (
        <>
          <View style={s.betTypeRow}>
            {['perm', 'ibet'].map(t => (
              <TouchableOpacity
                key={t}
                style={[s.betTypeBtn, betMode === t && s.betTypeBtnActive]}
                onPress={() => { setBetMode(t); setBtResult(null); }}
              >
                <Text style={[s.betTypeBtnText, betMode === t && s.betTypeBtnTextActive]}>
                  {t === 'perm'
                    ? `PERM ×${numPerms}`
                    : `IBET ×${numPerms}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.stakeLine}>
            {betMode === 'ibet'
              ? `IBET · $${bigAmt + smallAmt} SPLIT ACROSS ${numPerms} PERMUTATIONS · $${((bigAmt + smallAmt) / (numPerms || 1)).toFixed(2)} PER DRAW`
              : `PERMUTATION · ${numPerms} × $${bigAmt + smallAmt} AT FULL PAYOUT · $${(numPerms || 1) * (bigAmt + smallAmt)} PER DRAW`}
          </Text>
        </>
      )}

      {/* Lookback */}
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>{ZH ? '回看期间' : 'LOOKBACK'}</Text>
      <View style={s.chipRow}>
        {[1,2,3,4,5].map(y => (
          <TouchableOpacity key={y} style={[s.chip, frame === y && s.chipActive]} onPress={() => { setFrame(y); setBtResult(null); }}>
            <Text style={[s.chipText, frame === y && s.chipTextActive]}>{y}{ZH ? '年' : 'Y'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Run backtest */}
      <TouchableOpacity
        style={[s.redBtn, (bet.length !== 4 || btLoading) && s.redBtnDisabled]}
        onPress={runBacktest}
        disabled={bet.length !== 4 || btLoading}
      >
        {btLoading
          ? <ActivityIndicator color={PAPER} />
          : <Text style={s.redBtnText}>{ZH ? '运行回测' : 'RUN BACKTEST'}</Text>}
      </TouchableOpacity>

      {/* Results */}
      {btResult && (() => {
        const net     = btResult.won - btResult.spent;
        const isLoss  = net < 0;
        const quip    = pickRandom(isLoss ? (ZH ? QUIPS_LOSS_ZH : QUIPS_LOSS_EN) : (ZH ? QUIPS_WIN_ZH : QUIPS_WIN_EN));
        return (
          <>
            {/* Net figure */}
            <View style={s.netBlock}>
              <Text style={s.netLabel}>{isLoss ? (ZH ? '净亏损' : 'NET LOSS') : (ZH ? '净盈利' : 'NET GAIN')}</Text>
              <Text style={[s.netFigure, { color: isLoss ? RED : INK }]}>
                {isLoss ? '−' : '+'}{fmtMoney(net)}
              </Text>
              <Text style={s.quip}>{quip}</Text>
            </View>

            {/* 4-stat strip */}
            <View style={s.statStrip}>
              {[
                { label: ZH ? '花费' : 'SPENT',   val: fmtMoney(btResult.spent),         valStyle: {} },
                { label: ZH ? '赢得' : 'WON',     val: fmtMoney(btResult.won),           valStyle: {} },
                { label: ZH ? '期数' : 'DRAWS',   val: String(btResult.draws),           valStyle: {} },
                { label: ZH ? '中奖' : 'STRIKES', val: String(btResult.strikes.length),  valStyle: { color: RED } },
              ].map((stat, i) => (
                <View key={i} style={s.statCell}>
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={[s.statVal, stat.valStyle]}>{stat.val}</Text>
                </View>
              ))}
            </View>

            {/* Strike ledger */}
            {btResult.strikes.length > 0 ? (
              <View style={s.ledger}>
                <View style={s.ledgerHeader}>
                  <Text style={[s.ledgerHead, { flex: 1.3 }]}>{ZH ? '日期' : 'DATE'}</Text>
                  <Text style={[s.ledgerHead, { flex: 1 }]}>{ZH ? '号码' : 'NUMBER'}</Text>
                  <Text style={[s.ledgerHead, { flex: 1.2 }]}>{ZH ? '奖项' : 'PRIZE'}</Text>
                  <Text style={[s.ledgerHead, { flex: 1, textAlign: 'right' }]}>{ZH ? '奖金' : 'WON'}</Text>
                </View>
                {btResult.strikes.slice(0, 14).map((strike, i) => (
                  <View key={i} style={s.ledgerRow}>
                    <Text style={[s.ledgerCell, { flex: 1.3 }]}>{fmtDate(strike.date)}</Text>
                    <Text style={[s.ledgerCell, { flex: 1 }]}>{strike.number}</Text>
                    <Text style={[s.ledgerCell, { flex: 1.2 }]}>{strike.category}</Text>
                    <Text style={[s.ledgerCell, { flex: 1, textAlign: 'right', color: INK }]}>{fmtMoney(strike.win)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.noStrikes}>
                {ZH ? '一次都没有。连安慰奖都没有。' : 'NOT ONCE. NOT EVEN A CONSOLATION.'}
              </Text>
            )}
          </>
        );
      })()}

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  return (
    <View style={s.wrapper}>
      {/* Mode toggle */}
      <View style={s.modeToggle}>
        {['generate', 'backtest'].map(m => (
          <TouchableOpacity
            key={m}
            style={[s.modeBtn, mode === m && s.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[s.modeBtnText, mode === m && s.modeBtnTextActive]}>
              {m === 'generate' ? (ZH ? '生成' : 'GENERATE') : (ZH ? '回测' : 'BACKTEST')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'generate' ? renderGenerate() : renderBacktest()}

      <SupportPrompt visible={showPrompt} onWatchAd={handleWatchAd} onSkip={doGenerate} lang={lang} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper:   { flex: 1, backgroundColor: PAPER },
  screenPad: { padding: 16, paddingTop: 12 },

  // Mode toggle
  modeToggle:       { flexDirection: 'row', borderBottomWidth: 1, borderColor: RED },
  modeBtn:          { flex: 1, paddingVertical: 11, alignItems: 'center', borderRightWidth: 1, borderColor: RED },
  modeBtnActive:    { backgroundColor: RED },
  modeBtnText:      { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: MUTE, letterSpacing: 2 },
  modeBtnTextActive:{ color: PAPER },

  // Field label
  fieldLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 8 },

  // Chips
  chipRow:         { flexDirection: 'row', gap: 5, marginBottom: 14 },
  chip:            { width: 34, height: 34, borderWidth: 1, borderColor: RED, alignItems: 'center', justifyContent: 'center' },
  chipActive:      { backgroundColor: RED },
  chipText:        { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 13, color: RED },
  chipTextActive:  { color: PAPER },

  // Red button
  redBtn:         { backgroundColor: RED, paddingVertical: 13, alignItems: 'center', marginBottom: 16 },
  redBtnDisabled: { opacity: 0.4 },
  redBtnText:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: PAPER, letterSpacing: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyLine1: { fontFamily: 'IBMPlexMono-Medium', fontSize: 12, color: FAINT, letterSpacing: 1, marginBottom: 4 },
  emptyLine2: { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: FAINT, letterSpacing: 1 },

  // Generator cards
  genCard:        { borderWidth: 1, borderColor: RED, backgroundColor: TINT, marginBottom: 10 },
  genCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderColor: RED },
  genCardStrategy:{ fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: INK, letterSpacing: 1 },
  genCardTemp:    { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: RED, letterSpacing: 1 },
  genGrid:        { flexDirection: 'row', padding: 5 },
  genCell:        { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: RED, backgroundColor: PAPER, paddingVertical: 9, margin: 2.5 },
  genNum:         { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 17, color: INK, letterSpacing: 1 },
  genNote:        { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: MUTE, paddingHorizontal: 10, paddingBottom: 8, lineHeight: 14 },

  // Honesty note
  honestyBox:  { borderTopWidth: 1, borderColor: RED, paddingTop: 10, marginTop: 4 },
  honestyText: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, lineHeight: 15, letterSpacing: 0.3 },

  // Backtest — number display
  numberRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  numberDisplay: { fontFamily: 'IBMPlexMono-Bold', fontSize: 52, color: INK, letterSpacing: 4 },
  delBtn:        { borderWidth: 1, borderColor: RED, paddingHorizontal: 10, paddingVertical: 6 },
  delBtnText:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: RED, letterSpacing: 1 },

  // Keypad
  keypad:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 14 },
  key:      { width: '18%', aspectRatio: 1, borderWidth: 1, borderColor: RED, backgroundColor: TINT, padding: 0 },
  keyInner: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  keyText:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 16, color: INK, includeFontPadding: false, textAlignVertical: 'center', lineHeight: 20 },

  // Stake steppers
  stakeRow:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stakeGroup: { flex: 1 },
  stepper:    { flexDirection: 'row', borderWidth: 1, borderColor: RED },
  stepBtn:    { width: 36, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRightWidth: 1, borderColor: RULE },
  stepBtnText:{ fontFamily: 'IBMPlexMono-Bold', fontSize: 16, color: RED, textAlign: 'center' },
  stepVal:    { flex: 1, fontFamily: 'IBMPlexMono-SemiBold', fontSize: 14, color: INK, textAlign: 'center', paddingVertical: 10 },

  // Bet type
  betTypeRow:       { flexDirection: 'row', gap: 5, marginBottom: 6 },
  betTypeBtn:       { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: RED, alignItems: 'center' },
  betTypeBtnActive: { backgroundColor: RED },
  betTypeBtnText:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: RED, letterSpacing: 1 },
  betTypeBtnTextActive: { color: PAPER },
  stakeLine:        { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 0.5, marginBottom: 4, lineHeight: 14 },

  // Backtest results
  netBlock:   { borderTopWidth: 1, borderColor: RULE, paddingTop: 14, marginTop: 8, marginBottom: 12 },
  netLabel:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 4 },
  netFigure:  { fontFamily: 'IBMPlexMono-Bold', fontSize: 46, letterSpacing: -0.5, lineHeight: 52 },
  quip:       { fontFamily: 'ArchivoNarrow-Medium', fontSize: 13, color: MUTE, marginTop: 6, lineHeight: 19 },

  // 2×2 stat grid
  statStrip:      { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: RULE, paddingTop: 12, marginBottom: 14 },
  statCell:       { width: '50%', paddingVertical: 8, paddingHorizontal: 4 },
  statLabel:      { fontFamily: 'IBMPlexMono-Regular', fontSize: 8, color: FAINT, letterSpacing: 1, marginBottom: 4 },
  statVal:        { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 15, color: INK },

  ledger:       { borderTopWidth: 1, borderColor: RULE },
  ledgerHeader: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderColor: RED },
  ledgerHead:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: FAINT, letterSpacing: 1 },
  ledgerRow:    { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: RULE },
  ledgerCell:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: INK },
  noStrikes:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 10, color: FAINT, textAlign: 'center', paddingVertical: 24, letterSpacing: 1 },
});

// ── Support prompt styles ─────────────────────────────────────────────────────
const p = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  box:     { backgroundColor: PAPER, borderTopWidth: 3, borderColor: RED, padding: 24, width: '100%' },
  title:   { fontFamily: 'IBMPlexMono-Bold', fontSize: 13, color: INK, letterSpacing: 2, marginBottom: 10 },
  body:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: MUTE, lineHeight: 18, marginBottom: 20 },
  btn:     { backgroundColor: RED, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  btnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: PAPER, letterSpacing: 2 },
  skipBtn:     { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: FAINT },
});
