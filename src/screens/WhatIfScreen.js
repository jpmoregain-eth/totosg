import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../lib/LangContext';

const DARK = '#1a1a2e';
const PURPLE = '#7c6ff7';
const GOLD = '#C9A84C';
const ORANGE = '#FF6B35';

const BANNER_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-6984775309510247/2111888204';

const PRIZES_BIG   = { '1st': 2000, '2nd': 1000, '3rd': 490, 'Starter': 250, 'Consolation': 60 };
const PRIZES_SMALL = { '1st': 3000, '2nd': 2000, '3rd': 800, 'Starter': 0,   'Consolation': 0  };

const PRIZE_ZH = { '1st': '一等奖', '2nd': '二等奖', '3rd': '三等奖', 'Starter': '特别奖', 'Consolation': '安慰奖' };

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

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatMoney(amount) {
  return '$' + amount.toLocaleString('en-SG', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function TimeframePicker({ value, onChange, lang }) {
  return (
    <View style={styles.pillRow}>
      {[1, 2, 3, 4, 5].map(y => (
        <TouchableOpacity
          key={y}
          style={[styles.pill, value === y && styles.pillActive]}
          onPress={() => onChange(y)}
        >
          <Text style={[styles.pillText, value === y && styles.pillTextActive]}>
            {y}{lang === 'ZH' ? '年' : 'Y'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── 4D What If ───────────────────────────────────────────────────────────────

function FourdWhatIf({ insets }) {
  const { lang } = useLang();
  const [number, setNumber]     = useState('');
  const [timeframe, setTimeframe] = useState(1);
  const [bigAmt, setBigAmt]     = useState('1');
  const [smallAmt, setSmallAmt] = useState('0');
  const [betMode, setBetMode]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);

  const numPerms = number.length === 4 ? calcNumPerms(number) : null;
  const toggleBetMode = mode => { setBetMode(prev => (prev === mode ? null : mode)); setResult(null); };

  const calculate = async () => {
    if (!/^\d{4}$/.test(number)) {
      Alert.alert(lang === 'ZH' ? '号码无效' : 'Invalid number', lang === 'ZH' ? '请输入4位数字。' : 'Please enter a 4-digit number.');
      return;
    }
    const big = parseFloat(bigAmt) || 0;
    const small = parseFloat(smallAmt) || 0;
    if (big === 0 && small === 0) {
      Alert.alert(lang === 'ZH' ? '未填入下注金额' : 'No bet amount', lang === 'ZH' ? '请输入大或小的下注金额。' : 'Enter at least one bet amount (Big or Small).');
      return;
    }
    setLoading(true); setResult(null);
    try {
      const nPerms = numPerms || 1;
      const perms = (betMode === 'ibet' || betMode === 'perm') ? getAllPerms(number) : [number];
      const costPerDraw = betMode === 'perm' ? (big + small) * nPerms : (big + small);
      const { data: draws } = await supabase.from('fourd_draws')
        .select('draw_no, draw_date, prize_1st, prize_2nd, prize_3rd')
        .gte('draw_date', getStartDate(timeframe)).order('draw_date', { ascending: false });
      if (!draws?.length) { setResult({ draws: 0, spent: 0, won: 0, strikes: [], nPerms }); setLoading(false); return; }
      const drawNos = draws.map(d => d.draw_no);
      const { data: prizeData } = await supabase.from('fourd_prizes').select('draw_no, category, number').in('draw_no', drawNos);
      const totalSpent = costPerDraw * draws.length;
      let totalWon = 0;
      const strikes = [];
      draws.forEach(draw => {
        const dp = prizeData?.filter(p => p.draw_no === draw.draw_no) || [];
        const starters = dp.filter(p => p.category === 'starter').map(p => p.number);
        const consolations = dp.filter(p => p.category === 'consolation').map(p => p.number);
        perms.forEach(num => {
          let prizeKey = null;
          if      (num === draw.prize_1st)     prizeKey = '1st';
          else if (num === draw.prize_2nd)     prizeKey = '2nd';
          else if (num === draw.prize_3rd)     prizeKey = '3rd';
          else if (starters.includes(num))     prizeKey = 'Starter';
          else if (consolations.includes(num)) prizeKey = 'Consolation';
          if (prizeKey) {
            let win = 0;
            if (betMode === 'ibet') {
              win = Math.floor((big * PRIZES_BIG[prizeKey] / nPerms) * 10) / 10 +
                    Math.floor((small * PRIZES_SMALL[prizeKey] / nPerms) * 10) / 10;
            } else {
              win = big * PRIZES_BIG[prizeKey] + small * PRIZES_SMALL[prizeKey];
            }
            totalWon += win;
            strikes.push({ date: draw.draw_date, number: num, category: prizeKey, win });
          }
        });
      });
      setResult({ draws: draws.length, spent: totalSpent, won: totalWon, strikes, nPerms });
    } catch (e) {
      Alert.alert(lang === 'ZH' ? '错误' : 'Error', lang === 'ZH' ? '出错了，请再试。' : 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const save = async () => {
    try {
      const saved = JSON.parse((await AsyncStorage.getItem('whatif_4d')) || '[]');
      if (saved.find(s => s.number === number)) {
        Alert.alert(lang === 'ZH' ? '已保存' : 'Already saved', lang === 'ZH' ? `${number} 已在您的保存列表中。` : `${number} is already in your saved list.`);
        return;
      }
      saved.unshift({ number, bigAmt, smallAmt, betMode, timeframe });
      await AsyncStorage.setItem('whatif_4d', JSON.stringify(saved.slice(0, 10)));
      Alert.alert(lang === 'ZH' ? '已保存！✓' : 'Saved! ✓', lang === 'ZH' ? `${number} 已保存。` : `${number} has been saved.`);
    } catch (e) {}
  };

  const net = result ? result.won - result.spent : 0;
  const isProfit = net >= 0;

  const summaryMsg = result ? (isProfit
    ? (lang === 'ZH'
        ? `根据过去成绩，您在 ${result.draws} 期内${(betMode === 'ibet' || betMode === 'perm') ? `，共 ${result.nPerms} 个排列，` : ''}花费 ${formatMoney(result.spent)}，赢得 ${formatMoney(result.won)}！🎉 发啊！`
        : `Based on past results, you would have spent ${formatMoney(result.spent)} over ${result.draws} draws${(betMode === 'ibet' || betMode === 'perm') ? ` across ${result.nPerms} unique permutation${result.nPerms > 1 ? 's' : ''}` : ''} and made ${formatMoney(result.won)} in winnings! 🎉 HUAT AHH!`)
    : (lang === 'ZH'
        ? `根据过去成绩，您在 ${result.draws} 期内花费 ${formatMoney(result.spent)}，赢得 ${formatMoney(result.won)}。😅 下次好运！`
        : `Based on past results, you would have spent ${formatMoney(result.spent)} over ${result.draws} draws${(betMode === 'ibet' || betMode === 'perm') ? ` across ${result.nPerms} unique permutation${result.nPerms > 1 ? 's' : ''}` : ''} and made ${formatMoney(result.won)} in winnings! 😅 Better luck next time lah!`)
  ) : '';

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>{lang === 'ZH' ? '如果我买了' : 'What if I bought'}</Text>
          <TextInput
            style={styles.numberInput}
            value={number}
            onChangeText={t => { setNumber(t.replace(/\D/g, '').slice(0, 4)); setResult(null); }}
            placeholder="XXXX"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="numeric"
            maxLength={4}
          />
          <Text style={styles.questionLabel}>{lang === 'ZH' ? '每期，过去' : 'every draw for the past'}</Text>
          <TimeframePicker value={timeframe} onChange={t => { setTimeframe(t); setResult(null); }} lang={lang} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{lang === 'ZH' ? '每期下注金额' : 'Bet Amount per Draw'}</Text>
          <View style={styles.betRow}>
            <View style={styles.betField}>
              <Text style={styles.betLabel}>{lang === 'ZH' ? '大 ($)' : 'Big ($)'}</Text>
              <TextInput style={styles.betInput} value={bigAmt} onChangeText={t => { setBigAmt(t); setResult(null); }} keyboardType="decimal-pad" placeholder="0" />
            </View>
            <View style={styles.betField}>
              <Text style={styles.betLabel}>{lang === 'ZH' ? '小 ($)' : 'Small ($)'}</Text>
              <TextInput style={styles.betInput} value={smallAmt} onChangeText={t => { setSmallAmt(t); setResult(null); }} keyboardType="decimal-pad" placeholder="0" />
            </View>
          </View>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, betMode === 'ibet' && styles.toggleActive, betMode === 'perm' && styles.toggleDisabled]}
              onPress={() => betMode !== 'perm' && toggleBetMode('ibet')} disabled={betMode === 'perm'}
            >
              <Text style={[styles.toggleText, betMode === 'ibet' && styles.toggleTextActive]}>iBet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, betMode === 'perm' && styles.toggleActive, betMode === 'ibet' && styles.toggleDisabled]}
              onPress={() => betMode !== 'ibet' && toggleBetMode('perm')} disabled={betMode === 'ibet'}
            >
              <Text style={[styles.toggleText, betMode === 'perm' && styles.toggleTextActive]}>{lang === 'ZH' ? '所有排列' : 'All Permutations'}</Text>
            </TouchableOpacity>
          </View>
          {numPerms && (betMode === 'ibet' || betMode === 'perm') && (
            <Text style={styles.permNote}>
              {lang === 'ZH'
                ? `${number} 有 ${numPerms} 个排列${betMode === 'perm' ? ` · 每期费用 ${numPerms}×` : ' · 奖金按排列分配'}`
                : `${number} has ${numPerms} unique permutation${numPerms > 1 ? 's' : ''}${betMode === 'perm' ? ` · cost ${numPerms}× per draw` : ' · prize shared across permutations'}`}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.calcBtn} onPress={calculate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.calcBtnText}>{lang === 'ZH' ? '计算 🎰' : 'Calculate 🎰'}</Text>}
        </TouchableOpacity>

        {result && (
          <>
            <View style={[styles.resultCard, isProfit ? styles.resultProfit : styles.resultLoss]}>
              <Text style={styles.resultMessage}>{summaryMsg}</Text>
              <Text style={[styles.netAmount, { color: isProfit ? '#4CAF50' : '#F44336' }]}>
                {lang === 'ZH' ? '净额：' : 'Net: '}{isProfit ? '+' : ''}{formatMoney(net)}
              </Text>
            </View>

            {result.strikes.length > 0 ? (
              <View style={styles.tableCard}>
                <Text style={styles.cardTitle}>{lang === 'ZH' ? `中奖记录 (${result.strikes.length})` : `Strike History (${result.strikes.length})`}</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHead, { flex: 1.5 }]}>{lang === 'ZH' ? '日期' : 'Date'}</Text>
                  <Text style={[styles.tableHead, { flex: 0.9, textAlign: 'center' }]}>{lang === 'ZH' ? '号码' : 'Number'}</Text>
                  <Text style={[styles.tableHead, { flex: 1.1 }]}>{lang === 'ZH' ? '奖项' : 'Prize'}</Text>
                  <Text style={[styles.tableHead, { flex: 1.2, textAlign: 'right' }]}>{lang === 'ZH' ? '奖金' : 'Winnings'}</Text>
                </View>
                {result.strikes.map((s, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, { flex: 1.5, fontSize: 11 }]}>{formatDate(s.date)}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center', fontWeight: '700', color: GOLD, letterSpacing: 1 }]}>{s.number}</Text>
                    <Text style={[styles.tableCell, { flex: 1.1, fontSize: 12 }]}>{lang === 'ZH' ? (PRIZE_ZH[s.category] || s.category) : s.category}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right', color: '#4CAF50', fontWeight: '600' }]}>{formatMoney(s.win)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{lang === 'ZH' ? '此时间段内无中奖记录 😔' : 'No strikes in this timeframe 😔'}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>💾 {lang === 'ZH' ? '保存此号码' : 'Save this combination'}</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
      </View>
    </View>
  );
}

// ── TOTO Number Picker Modal ──────────────────────────────────────────────────

const ALL_TOTO_NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

function NumberPickerModal({ visible, selected, onPick, onClose, lang }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{lang === 'ZH' ? '选择号码' : 'Pick a number'}</Text>
          <FlatList
            data={ALL_TOTO_NUMBERS}
            keyExtractor={n => String(n)}
            numColumns={7}
            contentContainerStyle={styles.pickerGrid}
            renderItem={({ item }) => {
              const isSelected = selected.includes(item);
              return (
                <TouchableOpacity
                  style={[styles.pickerNum, isSelected && styles.pickerNumSelected]}
                  onPress={() => !isSelected && onPick(item)}
                  disabled={isSelected}
                >
                  <Text style={[styles.pickerNumText, isSelected && styles.pickerNumTextSelected]}>{item}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── TOTO What If ─────────────────────────────────────────────────────────────

function TotoWhatIf({ insets }) {
  const { lang } = useLang();
  const [selected, setSelected]   = useState([]);
  const [timeframe, setTimeframe] = useState(1);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const addNumber    = n => { setSelected(prev => [...prev, n]); setResult(null); setPickerOpen(false); };
  const removeNumber = n => { setSelected(prev => prev.filter(x => x !== n)); setResult(null); };

  const slots = [...selected];
  if (slots.length < 6) slots.push('ADD');
  while (slots.length % 3 !== 0) slots.push('EMPTY');
  const rows = [];
  for (let i = 0; i < slots.length; i += 3) rows.push(slots.slice(i, i + 3));

  const calculate = async () => {
    if (selected.length === 0) {
      Alert.alert(lang === 'ZH' ? '未选号码' : 'No numbers', lang === 'ZH' ? '请至少选择一个号码。' : 'Please pick at least 1 number.');
      return;
    }
    setLoading(true); setResult(null);
    try {
      const { data: draws } = await supabase.from('toto_draws')
        .select('draw_no, draw_date, n1, n2, n3, n4, n5, n6, additional')
        .gte('draw_date', getStartDate(timeframe)).order('draw_date', { ascending: false });
      if (!draws?.length) { setResult({ draws: 0, strikes: [], picked: selected }); setLoading(false); return; }
      const strikes = [];
      draws.forEach(draw => {
        const winning   = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6];
        const matchMain = selected.filter(n => winning.includes(n));
        const matchAdd  = selected.filter(n => n === draw.additional);
        const allFound  = new Set([...matchMain, ...matchAdd]);
        if (allFound.size === selected.length) strikes.push({ date: draw.draw_date, matchMain, matchAdd });
      });
      setResult({ draws: draws.length, strikes, picked: [...selected] });
    } catch (e) {
      Alert.alert(lang === 'ZH' ? '错误' : 'Error', lang === 'ZH' ? '出错了，请再试。' : 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const save = async () => {
    try {
      const key   = [...selected].sort((a, b) => a - b).join(',');
      const saved = JSON.parse((await AsyncStorage.getItem('whatif_toto')) || '[]');
      if (saved.find(s => s.key === key)) {
        Alert.alert(lang === 'ZH' ? '已保存' : 'Already saved', lang === 'ZH' ? '此号码组合已保存。' : 'This combination is already saved.');
        return;
      }
      saved.unshift({ key, numbers: selected, timeframe });
      await AsyncStorage.setItem('whatif_toto', JSON.stringify(saved.slice(0, 10)));
      Alert.alert(lang === 'ZH' ? '已保存！✓' : 'Saved! ✓', lang === 'ZH' ? '您的号码组合已保存。' : 'Your combination has been saved.');
    } catch (e) {}
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>{lang === 'ZH' ? '如果我买了' : 'What if I bought'}</Text>
          <View style={styles.totoGrid}>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.totoRow}>
                {row.map((slot, ci) => {
                  if (slot === 'EMPTY') return <View key={ci} style={styles.totoSlotEmpty} />;
                  if (slot === 'ADD') return (
                    <TouchableOpacity key={ci} style={styles.totoSlotAdd} onPress={() => setPickerOpen(true)}>
                      <Text style={styles.totoSlotAddText}>+</Text>
                    </TouchableOpacity>
                  );
                  return (
                    <View key={slot} style={styles.totoSlotFilled}>
                      <Text style={styles.totoSlotNumber}>{slot}</Text>
                      <TouchableOpacity style={styles.totoSlotX} onPress={() => removeNumber(slot)}>
                        <Text style={styles.totoSlotXText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
          <Text style={[styles.questionLabel, { marginTop: 16 }]}>{lang === 'ZH' ? '过去' : 'for the past'}</Text>
          <TimeframePicker value={timeframe} onChange={t => { setTimeframe(t); setResult(null); }} lang={lang} />
        </View>

        <TouchableOpacity style={styles.calcBtn} onPress={calculate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.calcBtnText}>{lang === 'ZH' ? '查询开彩 🎱' : 'Check Draws 🎱'}</Text>}
        </TouchableOpacity>

        {result && (
          <>
            <View style={styles.totoSummaryCard}>
              <Text style={styles.totoSummaryText}>
                {lang === 'ZH'
                  ? `在 ${result.draws} 期内，您的号码中奖 `
                  : `Over ${result.draws} draws, your numbers struck\n`}
                <Text style={[styles.totoStrikeCount, { color: result.strikes.length > 0 ? GOLD : '#FF5252' }]}>
                  {result.strikes.length}{lang === 'ZH' ? '' : (result.strikes.length !== 1 ? ' times' : ' time')}
                </Text>
                {lang === 'ZH' ? ' 次！' : '!'}
              </Text>
              {result.strikes.length > 0 && (
                <Text style={styles.totoLegend}>
                  <Text style={{ color: ORANGE }}>●</Text> {lang === 'ZH' ? '附加号码' : 'via additional ball'}{'   '}
                  <Text style={{ color: PURPLE }}>●</Text> {lang === 'ZH' ? '主号码' : 'main numbers'}
                </Text>
              )}
            </View>

            {result.strikes.length > 0 ? (
              <View style={styles.tableCard}>
                <Text style={styles.cardTitle}>{lang === 'ZH' ? '中奖记录' : 'Strike History'}</Text>
                {result.strikes.map((s, i) => (
                  <View key={i} style={[styles.totoStrikeRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={styles.totoStrikeDate}>{formatDate(s.date)}</Text>
                    <View style={styles.miniballRow}>
                      {result.picked.map(n => {
                        const isAdd  = s.matchAdd.includes(n);
                        const isMain = s.matchMain.includes(n);
                        return (
                          <View key={n} style={[styles.miniball, isAdd ? styles.miniballAdd : isMain ? styles.miniballMain : styles.miniballNone]}>
                            <Text style={[styles.miniballText, isAdd && { color: '#fff' }]}>{n}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{lang === 'ZH' ? '此时间段内无匹配 😔' : 'No matches found in this timeframe 😔'}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>💾 {lang === 'ZH' ? '保存此号码组合' : 'Save this combination'}</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <NumberPickerModal visible={pickerOpen} selected={selected} onPick={addNumber} onClose={() => setPickerOpen(false)} lang={lang} />
      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
      </View>
    </View>
  );
}

// ── Root Export ───────────────────────────────────────────────────────────────

export default function WhatIfScreen({ game }) {
  const insets = useSafeAreaInsets();
  if (game === '4D') return <FourdWhatIf insets={insets} />;
  return <TotoWhatIf insets={insets} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper:       { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:        { flex: 1 },
  scrollContent: { padding: 16 },
  questionCard:    { backgroundColor: DARK, borderRadius: 16, padding: 20, marginBottom: 12 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  tableCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  resultCard:      { borderRadius: 16, padding: 20, marginBottom: 12 },
  resultProfit:    { backgroundColor: '#E8F5E9' },
  resultLoss:      { backgroundColor: '#FFF3E0' },
  totoSummaryCard: { backgroundColor: DARK, borderRadius: 16, padding: 20, marginBottom: 12 },
  emptyCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', elevation: 1 },
  questionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 10 },
  numberInput:   { color: '#fff', fontSize: 36, fontWeight: '700', letterSpacing: 8, borderBottomWidth: 2, borderColor: GOLD, paddingBottom: 4, marginBottom: 18, width: 160 },
  pillRow:        { flexDirection: 'row', gap: 8 },
  pill:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  pillActive:     { backgroundColor: GOLD },
  pillText:       { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#fff' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 12 },
  betRow:    { flexDirection: 'row', gap: 12, marginBottom: 12 },
  betField:  { flex: 1 },
  betLabel:  { fontSize: 11, color: '#999', marginBottom: 4 },
  betInput:  { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 16, fontWeight: '600', color: '#222' },
  toggleRow:         { flexDirection: 'row', gap: 8 },
  toggleBtn:         { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  toggleActive:      { backgroundColor: PURPLE, borderColor: PURPLE },
  toggleDisabled:    { opacity: 0.35 },
  toggleText:        { fontSize: 13, color: '#555', fontWeight: '500' },
  toggleTextActive:  { color: '#fff', fontWeight: '600' },
  permNote:          { marginTop: 10, fontSize: 11, color: PURPLE, textAlign: 'center', lineHeight: 16 },
  calcBtn:     { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultMessage: { fontSize: 14, color: '#333', lineHeight: 22 },
  netAmount:     { fontSize: 24, fontWeight: '700', marginTop: 12 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 0.5, borderColor: '#ddd', marginBottom: 2 },
  tableHead:   { fontSize: 11, color: '#999', fontWeight: '500' },
  tableRow:    { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 0.5, borderColor: '#f0f0f0', alignItems: 'center' },
  tableRowAlt: { backgroundColor: '#fafafa' },
  tableCell:   { fontSize: 13, color: '#222' },
  emptyText:   { color: '#999', fontSize: 14 },
  totoGrid:           { marginBottom: 4 },
  totoRow:            { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  totoSlotFilled:     { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  totoSlotAdd:        { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: GOLD, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  totoSlotEmpty:      { width: 88, height: 88 },
  totoSlotNumber:     { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  totoSlotAddText:    { color: GOLD, fontSize: 28, fontWeight: '300' },
  totoSlotX:          { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  totoSlotXText:      { color: '#fff', fontSize: 9, fontWeight: '700' },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '70%' },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  modalTitle:         { fontSize: 15, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 12 },
  pickerGrid:         { paddingHorizontal: 12, paddingBottom: 8 },
  pickerNum:          { flex: 1, margin: 4, aspectRatio: 1, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  pickerNumSelected:  { backgroundColor: PURPLE },
  pickerNumText:      { fontSize: 13, fontWeight: '600', color: '#333' },
  pickerNumTextSelected: { color: '#fff' },
  totoSummaryText:  { color: '#fff', fontSize: 16, lineHeight: 26 },
  totoStrikeCount:  { fontSize: 28, fontWeight: '700' },
  totoLegend:       { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 10 },
  totoStrikeRow:  { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#f0f0f0', alignItems: 'center' },
  totoStrikeDate: { fontSize: 11, color: '#666', width: 90 },
  miniballRow:    { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  miniball:       { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', margin: 2 },
  miniballMain:   { backgroundColor: 'rgba(124,111,247,0.2)' },
  miniballAdd:    { backgroundColor: ORANGE },
  miniballNone:   { backgroundColor: 'rgba(0,0,0,0.06)' },
  miniballText:   { fontSize: 11, fontWeight: '700', color: '#444' },
  saveBtn:     { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#ddd', elevation: 1 },
  saveBtnText: { color: '#555', fontSize: 14, fontWeight: '500' },
  bannerContainer: { alignItems: 'center', paddingTop: 6, borderTopWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
});
