import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Dimensions,
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

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING = 32; // 16px each side
const CELL_SIZE = Math.floor((SCREEN_W - GRID_PADDING) / 7);
const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-6984775309510247/6047752765';
const rewarded = RewardedAd.createForAdRequest(REWARDED_ID, { requestNonPersonalizedAdsOnly: true });

// ── Generator constants ───────────────────────────────────────────────────────
const STRATEGIES = ['Frequency', 'Markov Chain', 'Mean Reversion', 'Wheeling', 'Sum Range', 'Odd/Even Balance', 'Positional Bias'];
const TEMPS      = ['Hottest', 'Coldest', 'Balanced'];
const WINDOWS    = [25, 50, 100, 200];
const COUNT_OPTS = [2, 3, 4, 6, 7, 8, 9, 10, 11, 12];

const STRATEGY_LABEL = {
  'Frequency':       { en: 'FREQUENCY',        zh: '频率',    temp: 'Balanced' },
  'Markov Chain':    { en: 'MARKOV CHAIN',      zh: '马尔可夫', temp: 'Hottest'  },
  'Mean Reversion':  { en: 'MEAN REVERSION',   zh: '均值回归', temp: 'Coldest'  },
  'Wheeling':        { en: 'WHEELING',          zh: '轮式',    temp: 'Balanced' },
  'Sum Range':       { en: 'SUM RANGE',         zh: '总和范围', temp: 'Balanced' },
  'Odd/Even Balance':{ en: 'ODD / EVEN',        zh: '奇偶平衡', temp: 'Balanced' },
  'Positional Bias': { en: 'POSITIONAL BIAS',   zh: '位置偏好', temp: 'Hottest'  },
};

const TEMP_LABEL = { Hottest: 'HOTTEST', Coldest: 'COLDEST', Balanced: 'BALANCED' };

const METHOD_NOTE = {
  'Frequency':       { en: 'Top picks by appearance count',         zh: '按出现次数排序' },
  'Markov Chain':    { en: 'Transition probability weighted',        zh: '转移概率加权' },
  'Mean Reversion':  { en: 'Numbers absent from the last 10 draws', zh: '最近10期未出现的号码' },
  'Wheeling':        { en: 'Random subset of a hot pool',            zh: '热号码池随机子集' },
  'Sum Range':       { en: 'Filtered to historical sum band',        zh: '按历史总和范围筛选' },
  'Odd/Even Balance':{ en: 'Balanced parity split',                  zh: '平衡奇偶比例' },
  'Positional Bias': { en: 'Most common digit at each position',     zh: '每位最常见数字' },
};

// ── TOTO prize structure ──────────────────────────────────────────────────────
// For backtest: $1 per draw ordinary entry
// Group wins based on matching n of 6 + additional
const TOTO_PRIZES = {
  'Group 1': 1000000, // jackpot — use stored value ideally
  'Group 2': 62000,
  'Group 3': 3875,
  'Group 4': 1308,
  'Group 5': 50,
  'Group 6': 25,
  'Group 7': 10,
};

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
function pad(n)          { return String(n).padStart(2, '0'); }

function pickNumbers(draws, temp, count) {
  const freq = {};
  for (let i = 1; i <= 49; i++) freq[i] = 0;
  draws.forEach(d => {
    [d.n1,d.n2,d.n3,d.n4,d.n5,d.n6,d.additional].forEach(n => { if (n) freq[n] = (freq[n]||0)+1; });
  });
  const sorted = Object.entries(freq).sort((a,b) => {
    const diff = temp==='Coldest' ? a[1]-b[1] : b[1]-a[1];
    return diff !== 0 ? diff : Math.random()-0.5;
  });
  if (temp === 'Balanced') {
    const hot  = sorted.slice(0, 20).map(x => parseInt(x[0]));
    const cold = sorted.slice(-20).map(x => parseInt(x[0]));
    return shuffle([...hot,...cold]).slice(0, count).sort((a,b) => a-b);
  }
  if (temp === 'Coldest') {
    const appeared = sorted.filter(x => x[1] > 0);
    const pool = appeared.length >= count ? appeared : sorted;
    return pool.slice(0, count).map(x => parseInt(x[0])).sort((a,b) => a-b);
  }
  return sorted.slice(0, count).map(x => parseInt(x[0])).sort((a,b) => a-b);
}

function positionalBias(draws, count) {
  if (count !== 6 || !draws || draws.length < 10) return null;
  const positional = [[],[],[],[],[],[]];
  draws.forEach(d => {
    [d.n1,d.n2,d.n3,d.n4,d.n5,d.n6].forEach((n,i) => {
      const num = parseInt(n);
      if (num && !isNaN(num) && num >= 1 && num <= 49) positional[i].push(num);
    });
  });
  const picked = new Set(); const result = [];
  for (let i = 0; i < 6; i++) {
    const pos = positional[i]; let chosen = null;
    if (pos.length > 0) {
      const freq = {}; pos.forEach(n => { freq[n] = (freq[n]||0)+1; });
      const sd = Object.entries(freq).sort((a,b) => { const d=b[1]-a[1]; return d!==0?d:Math.random()-0.5; });
      for (const [n] of sd) { const num = parseInt(n); if (!picked.has(num)) { chosen=num; break; } }
    }
    if (!chosen) chosen = Array.from({length:49},(_,j)=>j+1).find(n => !picked.has(n));
    picked.add(chosen); result.push(chosen);
  }
  return result.sort((a,b) => a-b);
}

function generateSet(draws, strategy, temp, count) {
  let nums = pickNumbers(draws, temp, count);
  if (strategy === 'Mean Reversion') {
    const recent = new Set();
    draws.slice(0,10).forEach(d => [d.n1,d.n2,d.n3,d.n4,d.n5,d.n6].forEach(n => recent.add(n)));
    const overdue = Array.from({length:49},(_,i)=>i+1).filter(n => !recent.has(n));
    if (overdue.length >= count) nums = shuffle(overdue).slice(0,count).sort((a,b)=>a-b);
  } else if (strategy === 'Sum Range') {
    const lower = Math.round(count * 16.7); const upper = Math.round(count * 30);
    for (let i = 0; i < 50; i++) {
      const c = pickNumbers(draws, temp, count);
      if (c.reduce((a,b)=>a+b,0) >= lower && c.reduce((a,b)=>a+b,0) <= upper) { nums=c; break; }
    }
  } else if (strategy === 'Odd/Even Balance') {
    const target = Math.round(count/2);
    for (let i = 0; i < 50; i++) {
      const c = shuffle(Array.from({length:49},(_,i)=>i+1)).slice(0,count).sort((a,b)=>a-b);
      if (c.filter(n => n%2!==0).length === target) { nums=c; break; }
    }
  } else if (strategy === 'Wheeling') {
    const pool = pickNumbers(draws, temp, Math.min(49, count+6));
    nums = shuffle(pool).slice(0,count).sort((a,b)=>a-b);
  } else if (strategy === 'Positional Bias') {
    const pb = positionalBias(draws, count); if (pb) nums = pb;
  }
  return nums;
}

// ── Backtest helpers ──────────────────────────────────────────────────────────
function getStartDate(years) {
  const d = new Date(); d.setFullYear(d.getFullYear() - years);
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

function checkTotoWin(picked, draw) {
  const winning = new Set([draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6].map(Number));
  const additional = Number(draw.additional);
  const matched = picked.filter(n => winning.has(n)).length;
  const hasAdditional = picked.includes(additional);

  if (matched === 6)                        return { group: 'Group 1', prize: TOTO_PRIZES['Group 1'] };
  if (matched === 5 && hasAdditional)       return { group: 'Group 2', prize: TOTO_PRIZES['Group 2'] };
  if (matched === 5)                        return { group: 'Group 3', prize: TOTO_PRIZES['Group 3'] };
  if (matched === 4 && hasAdditional)       return { group: 'Group 4', prize: TOTO_PRIZES['Group 4'] };
  if (matched === 4)                        return { group: 'Group 5', prize: TOTO_PRIZES['Group 5'] };
  if (matched === 3 && hasAdditional)       return { group: 'Group 6', prize: TOTO_PRIZES['Group 6'] };
  if (matched === 3)                        return { group: 'Group 7', prize: TOTO_PRIZES['Group 7'] };
  return null;
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
export default function TotoLabScreen() {
  const { lang } = useLang();
  const ZH = lang === 'ZH';

  const [mode, setMode] = useState('generate');

  // ── Generator state ──
  const [allDraws,   setAllDraws]   = useState({});
  const [numCount,   setNumCount]   = useState(6);
  const [sets,       setSets]       = useState([]);
  const [genLoading, setGenLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adLoaded,   setAdLoaded]   = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const doGenerateRef = useRef(null);

  // ── Backtest state ──
  const [picked,    setPicked]    = useState([]);
  const [frame,     setFrame]     = useState(5);
  const [btLoading, setBtLoading] = useState(false);
  const [btResult,  setBtResult]  = useState(null);

  // ── Load draws + ad ──
  useEffect(() => {
    const fetchData = async () => {
      const results = {};
      for (const w of WINDOWS) {
        const { data } = await supabase
          .from('toto_draws')
          .select('n1,n2,n3,n4,n5,n6,additional')
          .order('draw_no', { ascending: false })
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
    const unsubError  = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      setAdLoaded(false); doGenerateRef.current?.();
    });
    rewarded.load();
    return () => { unsubLoaded(); unsubEarned(); unsubClosed(); unsubError(); };
  }, []);

  // ── Generate ──
  const doGenerate = useCallback(() => {
    const stratPool = shuffle(STRATEGIES);
    const newSets = Array.from({ length: 3 }, (_, i) => {
      const strategy = stratPool[i % stratPool.length];
      const temp     = STRATEGY_LABEL[strategy]?.temp || pickRandom(TEMPS);
      const window   = pickRandom(WINDOWS);
      const draws    = allDraws[window] || [];
      const nums     = generateSet(draws, strategy, temp, numCount);
      return { strategy, temp, window, nums };
    });
    setSets(newSets);
    setGenerating(false);
    setShowPrompt(false);
  }, [allDraws, numCount]);

  useEffect(() => { doGenerateRef.current = doGenerate; }, [doGenerate]);

  const handleGenerate = () => { setGenerating(true); setShowPrompt(true); };
  const handleWatchAd  = () => { if (adLoaded) rewarded.show(); else doGenerate(); };

  // ── Backtest number picker ──
  const togglePick = (n) => {
    setPicked(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n);
      if (prev.length >= 12) return prev; // max 12
      return [...prev, n].sort((a,b) => a-b);
    });
    setBtResult(null);
  };

  // ── Run backtest ──
  const runBacktest = async () => {
    if (picked.length < 3) return;
    setBtLoading(true); setBtResult(null);
    try {
      const { data: draws } = await supabase
        .from('toto_draws')
        .select('*')
        .gte('draw_date', getStartDate(frame))
        .order('draw_date', { ascending: false });

      if (!draws?.length) { setBtResult({ draws: 0, spent: 0, won: 0, strikes: [] }); setBtLoading(false); return; }

      const totalSpent = draws.length; // $1 per draw
      let totalWon = 0;
      const strikes = [];

      draws.forEach(draw => {
        const result = checkTotoWin(picked, draw);
        if (result) {
          totalWon += result.prize;
          strikes.push({ date: draw.draw_date, group: result.group, prize: result.prize });
        }
      });

      setBtResult({ draws: draws.length, spent: totalSpent, won: totalWon, strikes });
    } catch (e) { console.error(e); }
    setBtLoading(false);
  };

  // ── Renders ───────────────────────────────────────────────────────────────
  const renderGenerate = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.screenPad}>
      {/* Numbers per set */}
      <Text style={s.fieldLabel}>{ZH ? '每组号码数' : 'NUMBERS PER SET'}</Text>
      <View style={s.chipRow}>
        {COUNT_OPTS.map(n => (
          <TouchableOpacity
            key={n}
            style={[s.chip, numCount === n && s.chipActive]}
            onPress={() => { setNumCount(n); setSets([]); }}
          >
            <Text style={[s.chipText, numCount === n && s.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.chipHint}>
        {ZH ? '2–4: TOTO Match · 6–12: 系统投注' : '2–4: TOTO Match · 6–12: System Entry'}
      </Text>

      <TouchableOpacity style={s.redBtn} onPress={handleGenerate} disabled={generating || genLoading}>
        {generating && !showPrompt
          ? <ActivityIndicator color={PAPER} />
          : <Text style={s.redBtnText}>{ZH ? '运行生成器' : 'RUN GENERATOR'}</Text>}
      </TouchableOpacity>

      {sets.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyLine1}>{ZH ? '暂无号码。' : 'NO SETS GENERATED.'}</Text>
          <Text style={s.emptyLine2}>{ZH ? '生成器等待中。' : 'THE MACHINE IS WAITING.'}</Text>
        </View>
      )}

      {sets.map((set, idx) => {
        const strat = STRATEGY_LABEL[set.strategy];
        const note  = METHOD_NOTE[set.strategy];
        const rows  = [];
        const cols  = numCount <= 7 ? numCount : Math.ceil(numCount / 2);
        for (let i = 0; i < set.nums.length; i += cols) rows.push(set.nums.slice(i, i + cols));
        return (
          <View key={idx} style={s.genCard}>
            <View style={s.genCardHeader}>
              <Text style={s.genCardStrategy}>{ZH ? strat?.zh : strat?.en}</Text>
              <Text style={s.genCardTemp}>{TEMP_LABEL[set.temp]}</Text>
            </View>
            {rows.map((row, ri) => (
              <View key={ri} style={s.genRow}>
                {row.map((n, ci) => (
                  <View key={ci} style={s.genCell}>
                    <Text style={s.genNum}>{pad(n)}</Text>
                  </View>
                ))}
              </View>
            ))}
            <Text style={s.genNote}>
              {ZH ? note?.zh : note?.en} · {ZH ? `最近${set.window}期` : `last ${set.window} draws.`}
            </Text>
          </View>
        );
      })}

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
      {/* Number grid */}
      <Text style={s.fieldLabel}>{ZH ? '选择你的号码' : 'SELECT YOUR NUMBERS'}</Text>
      <View style={s.grid}>
        {Array.from({ length: 49 }, (_, i) => i + 1).map(n => {
          const isActive = picked.includes(n);
          return (
            <TouchableOpacity
              key={n}
              style={[s.gridCell, isActive && s.gridCellActive]}
              onPress={() => togglePick(n)}
              activeOpacity={0.7}
            >
              <Text style={[s.gridNum, isActive && s.gridNumActive]}>{pad(n)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected summary */}
      <Text style={s.selectedSummary}>
        {picked.length > 0
          ? `${picked.length} ${ZH ? '已选' : 'SELECTED'} · ${picked.map(pad).join(' ')}`
          : ZH ? '请选择至少3个号码' : 'SELECT AT LEAST 3 NUMBERS'}
      </Text>

      {/* Lookback */}
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>{ZH ? '回看期间' : 'LOOKBACK'}</Text>
      <View style={s.chipRow}>
        {[1,2,3,4,5].map(y => (
          <TouchableOpacity
            key={y}
            style={[s.chip, frame === y && s.chipActive]}
            onPress={() => { setFrame(y); setBtResult(null); }}
          >
            <Text style={[s.chipText, frame === y && s.chipTextActive]}>{y}{ZH ? '年' : 'Y'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[s.redBtn, (picked.length < 3 || btLoading) && s.redBtnDisabled]}
        onPress={runBacktest}
        disabled={picked.length < 3 || btLoading}
      >
        {btLoading
          ? <ActivityIndicator color={PAPER} />
          : <Text style={s.redBtnText}>{ZH ? '运行回测' : 'RUN BACKTEST'}</Text>}
      </TouchableOpacity>

      {/* Results */}
      {btResult && (() => {
        const net    = btResult.won - btResult.spent;
        const isLoss = net < 0;
        const quip   = `${btResult.draws} ${ZH ? '期' : 'draws'}. ${btResult.strikes.length} ${ZH ? '次中奖' : 'strikes'}. ${pickRandom(isLoss ? (ZH ? QUIPS_LOSS_ZH : QUIPS_LOSS_EN) : (ZH ? QUIPS_WIN_ZH : QUIPS_WIN_EN))}`;
        return (
          <>
            <View style={s.netBlock}>
              <Text style={s.netLabel}>{isLoss ? (ZH ? '净亏损' : 'NET LOSS') : (ZH ? '净盈利' : 'NET GAIN')}</Text>
              <Text style={[s.netFigure, { color: isLoss ? RED : INK }]}>
                {isLoss ? '−' : '+'}{fmtMoney(net)}
              </Text>
              <Text style={s.quip}>{quip}</Text>
            </View>

            <View style={s.statStrip}>
              {[
                { label: ZH ? '花费' : 'SPENT',   val: fmtMoney(btResult.spent) },
                { label: ZH ? '赢得' : 'WON',     val: fmtMoney(btResult.won)   },
                { label: ZH ? '期数' : 'DRAWS',   val: String(btResult.draws)   },
                { label: ZH ? '中奖' : 'STRIKES', val: String(btResult.strikes.length), red: true },
              ].map((stat, i) => (
                <View key={i} style={s.statCell}>
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={[s.statVal, stat.red && { color: RED }]}>{stat.val}</Text>
                </View>
              ))}
            </View>

            <View style={s.ledger}>
              <Text style={s.ledgerTitle}>{ZH ? '中奖记录' : 'STRIKE LEDGER'}</Text>
              {btResult.strikes.length > 0 ? (
                <>
                  <View style={s.ledgerHeader}>
                    <Text style={[s.ledgerHead, { flex: 1.5 }]}>{ZH ? '日期' : 'DATE'}</Text>
                    <Text style={[s.ledgerHead, { flex: 1 }]}>{ZH ? '组别' : 'GROUP'}</Text>
                    <Text style={[s.ledgerHead, { flex: 1, textAlign: 'right' }]}>{ZH ? '奖金' : 'WON'}</Text>
                  </View>
                  {btResult.strikes.slice(0, 14).map((strike, i) => (
                    <View key={i} style={s.ledgerRow}>
                      <Text style={[s.ledgerCell, { flex: 1.5 }]}>{fmtDate(strike.date)}</Text>
                      <Text style={[s.ledgerCell, { flex: 1 }]}>{strike.group}</Text>
                      <Text style={[s.ledgerCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(strike.prize)}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={s.noStrikes}>{ZH ? '一次都没有。连安慰奖都没有。' : 'NOT ONCE. NOT EVEN A CONSOLATION.'}</Text>
              )}
            </View>
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

  modeToggle:        { flexDirection: 'row', borderBottomWidth: 1, borderColor: RED },
  modeBtn:           { flex: 1, paddingVertical: 11, alignItems: 'center', borderRightWidth: 1, borderColor: RED },
  modeBtnActive:     { backgroundColor: RED },
  modeBtnText:       { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: MUTE, letterSpacing: 2 },
  modeBtnTextActive: { color: PAPER },

  fieldLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 8 },

  chipRow:          { flexDirection: 'row', gap: 5, marginBottom: 14, flexWrap: 'wrap' },
  chip:             { width: 34, height: 34, borderWidth: 1, borderColor: RED, alignItems: 'center', justifyContent: 'center' },
  chipActive:       { backgroundColor: RED },
  chipHint:         { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 0.5, marginTop: -8, marginBottom: 14 },
  chipText:         { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 13, color: RED },
  chipTextActive:   { color: PAPER },

  redBtn:         { backgroundColor: RED, paddingVertical: 13, alignItems: 'center', marginBottom: 16 },
  redBtnDisabled: { opacity: 0.4 },
  redBtnText:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: PAPER, letterSpacing: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyLine1: { fontFamily: 'IBMPlexMono-Medium', fontSize: 12, color: FAINT, letterSpacing: 1, marginBottom: 4 },
  emptyLine2: { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: FAINT, letterSpacing: 1 },

  // Generator cards
  genCard:        { borderWidth: 1, borderColor: RED, backgroundColor: TINT, marginBottom: 10 },
  genCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderColor: RED },
  genCardStrategy:{ fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, color: INK, letterSpacing: 1 },
  genCardTemp:    { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: RED, letterSpacing: 1 },
  genRow:         { flexDirection: 'row', padding: 5, gap: 5 },
  genCell:        { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: RED, backgroundColor: PAPER, paddingVertical: 9 },
  genNum:         { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 16, color: INK, letterSpacing: 1, includeFontPadding: false, textAlignVertical: 'center' },
  genNote:        { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: MUTE, paddingHorizontal: 10, paddingBottom: 8, lineHeight: 14 },

  honestyBox:  { borderTopWidth: 1, borderColor: RED, paddingTop: 10, marginTop: 4 },
  honestyText: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, lineHeight: 15 },

  // Backtest number grid (7 per row, fixed cell size)
  grid:           { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  gridCell:       { width: CELL_SIZE, height: CELL_SIZE, borderWidth: 0.5, borderColor: RULE, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPER },
  gridCellActive: { backgroundColor: RED, borderColor: RED },
  gridNum:        { fontFamily: 'IBMPlexMono-Medium', fontSize: 13, color: INK, includeFontPadding: false, textAlignVertical: 'center' },
  gridNumActive:  { color: PAPER, fontFamily: 'IBMPlexMono-Bold' },

  selectedSummary: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: MUTE, letterSpacing: 0.5, marginBottom: 4 },

  // Results
  netBlock:  { borderTopWidth: 1, borderColor: RULE, paddingTop: 14, marginTop: 8, marginBottom: 12 },
  netLabel:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 4 },
  netFigure: { fontFamily: 'IBMPlexMono-Bold', fontSize: 46, letterSpacing: -0.5, lineHeight: 52 },
  quip:      { fontFamily: 'ArchivoNarrow-Regular', fontSize: 13, color: MUTE, marginTop: 6, lineHeight: 19 },

  statStrip: { flexDirection: 'row', borderTopWidth: 1, borderColor: RULE, paddingTop: 12, marginBottom: 14 },
  statCell:  { flex: 1, alignItems: 'flex-start', paddingHorizontal: 2 },
  statLabel: { fontFamily: 'IBMPlexMono-Regular', fontSize: 8, color: FAINT, letterSpacing: 1, marginBottom: 4 },
  statVal:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 14, color: INK },

  ledger:       { borderTopWidth: 1, borderColor: RULE, paddingTop: 12 },
  ledgerTitle:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 10 },
  ledgerHeader: { flexDirection: 'row', paddingBottom: 7, borderBottomWidth: 1, borderColor: RED },
  ledgerHead:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: FAINT, letterSpacing: 1 },
  ledgerRow:    { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: RULE },
  ledgerCell:   { fontFamily: 'IBMPlexMono-Regular', fontSize: 12, color: INK },
  noStrikes:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 10, color: FAINT, textAlign: 'center', paddingVertical: 24, letterSpacing: 1 },
});

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
