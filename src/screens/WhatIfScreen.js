import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK = '#1a1a2e';
const PURPLE = '#7c6ff7';
const GOLD = '#C9A84C';
const ORANGE = '#FF6B35';

const BANNER_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-6984775309510247/2111888204';

// Standard SP prize payouts per $1 bet
const PRIZES_BIG   = { '1st': 2000, '2nd': 1000, '3rd': 490, 'Starter': 250, 'Consolation': 60 };
const PRIZES_SMALL = { '1st': 3000, '2nd': 2000, '3rd': 800, 'Starter': 0,   'Consolation': 0  };

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcNumPerms(num) {
  const freq = {};
  num.split('').forEach(d => (freq[d] = (freq[d] || 0) + 1));
  let denom = 1;
  Object.values(freq).forEach(f => { for (let i = 2; i <= f; i++) denom *= i; });
  return 24 / denom; // 4! = 24
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

// ── Shared: Timeframe Pill Selector ──────────────────────────────────────────

function TimeframePicker({ value, onChange }) {
  return (
    <View style={styles.pillRow}>
      {[1, 2, 3, 4, 5].map(y => (
        <TouchableOpacity
          key={y}
          style={[styles.pill, value === y && styles.pillActive]}
          onPress={() => onChange(y)}
        >
          <Text style={[styles.pillText, value === y && styles.pillTextActive]}>{y}Y</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── 4D What If ───────────────────────────────────────────────────────────────

function FourdWhatIf({ insets }) {
  const [number, setNumber]   = useState('');
  const [timeframe, setTimeframe] = useState(1);
  const [bigAmt, setBigAmt]   = useState('1');
  const [smallAmt, setSmallAmt] = useState('0');
  const [betMode, setBetMode] = useState(null); // null | 'ibet' | 'perm'
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);

  const numPerms = number.length === 4 ? calcNumPerms(number) : null;

  const toggleBetMode = mode => {
    setBetMode(prev => (prev === mode ? null : mode));
    setResult(null);
  };

  const calculate = async () => {
    if (!/^\d{4}$/.test(number)) {
      Alert.alert('Invalid number', 'Please enter a 4-digit number.');
      return;
    }
    const big   = parseFloat(bigAmt)   || 0;
    const small = parseFloat(smallAmt) || 0;
    if (big === 0 && small === 0) {
      Alert.alert('No bet amount', 'Enter at least one bet amount (Big or Small).');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const nPerms       = numPerms || 1;
      const perms        = (betMode === 'ibet' || betMode === 'perm') ? getAllPerms(number) : [number];
      const costPerDraw  = betMode === 'perm' ? (big + small) * nPerms : (big + small);

      const { data: draws } = await supabase
        .from('fourd_draws')
        .select('draw_no, draw_date, prize_1st, prize_2nd, prize_3rd')
        .gte('draw_date', getStartDate(timeframe))
        .order('draw_date', { ascending: false });

      if (!draws?.length) {
        setResult({ draws: 0, spent: 0, won: 0, strikes: [], nPerms });
        setLoading(false);
        return;
      }

      const drawNos = draws.map(d => d.draw_no);
      const { data: prizeData } = await supabase
        .from('fourd_prizes')
        .select('draw_no, category, number')
        .in('draw_no', drawNos);

      const totalSpent = costPerDraw * draws.length;
      let totalWon = 0;
      const strikes = [];

      draws.forEach(draw => {
        const dp          = prizeData?.filter(p => p.draw_no === draw.draw_no) || [];
        const starters    = dp.filter(p => p.category === 'starter').map(p => p.number);
        const consolations = dp.filter(p => p.category === 'consolation').map(p => p.number);

        perms.forEach(num => {
          let prizeKey = null;
          if      (num === draw.prize_1st)      prizeKey = '1st';
          else if (num === draw.prize_2nd)      prizeKey = '2nd';
          else if (num === draw.prize_3rd)      prizeKey = '3rd';
          else if (starters.includes(num))      prizeKey = 'Starter';
          else if (consolations.includes(num))  prizeKey = 'Consolation';

          if (prizeKey) {
            let win = 0;
            if (betMode === 'ibet') {
              // iBet: prize divided across all permutations, rounded to nearest $0.10
              win =
                Math.floor((big   * PRIZES_BIG[prizeKey]   / nPerms) * 10) / 10 +
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
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  const save = async () => {
    try {
      const saved = JSON.parse((await AsyncStorage.getItem('whatif_4d')) || '[]');
      if (saved.find(s => s.number === number)) {
        Alert.alert('Already saved', `${number} is already in your saved list.`);
        return;
      }
      saved.unshift({ number, bigAmt, smallAmt, betMode, timeframe });
      await AsyncStorage.setItem('whatif_4d', JSON.stringify(saved.slice(0, 10)));
      Alert.alert('Saved! ✓', `${number} has been saved.`);
    } catch (e) {}
  };

  const net      = result ? result.won - result.spent : 0;
  const isProfit = net >= 0;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Question Card ── */}
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>What if I bought</Text>
          <TextInput
            style={styles.numberInput}
            value={number}
            onChangeText={t => { setNumber(t.replace(/\D/g, '').slice(0, 4)); setResult(null); }}
            placeholder="XXXX"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="numeric"
            maxLength={4}
          />
          <Text style={styles.questionLabel}>every draw for the past</Text>
          <TimeframePicker value={timeframe} onChange={t => { setTimeframe(t); setResult(null); }} />
        </View>

        {/* ── Bet Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bet Amount per Draw</Text>
          <View style={styles.betRow}>
            <View style={styles.betField}>
              <Text style={styles.betLabel}>Big ($)</Text>
              <TextInput
                style={styles.betInput}
                value={bigAmt}
                onChangeText={t => { setBigAmt(t); setResult(null); }}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={styles.betField}>
              <Text style={styles.betLabel}>Small ($)</Text>
              <TextInput
                style={styles.betInput}
                value={smallAmt}
                onChangeText={t => { setSmallAmt(t); setResult(null); }}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, betMode === 'ibet' && styles.toggleActive, betMode === 'perm' && styles.toggleDisabled]}
              onPress={() => betMode !== 'perm' && toggleBetMode('ibet')}
              disabled={betMode === 'perm'}
            >
              <Text style={[styles.toggleText, betMode === 'ibet' && styles.toggleTextActive]}>iBet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, betMode === 'perm' && styles.toggleActive, betMode === 'ibet' && styles.toggleDisabled]}
              onPress={() => betMode !== 'ibet' && toggleBetMode('perm')}
              disabled={betMode === 'ibet'}
            >
              <Text style={[styles.toggleText, betMode === 'perm' && styles.toggleTextActive]}>All Permutations</Text>
            </TouchableOpacity>
          </View>

          {numPerms && (betMode === 'ibet' || betMode === 'perm') && (
            <Text style={styles.permNote}>
              {number} has {numPerms} unique permutation{numPerms > 1 ? 's' : ''}
              {betMode === 'perm' ? ` · cost ${numPerms}× per draw` : ' · prize shared across permutations'}
            </Text>
          )}
        </View>

        {/* ── Calculate Button ── */}
        <TouchableOpacity style={styles.calcBtn} onPress={calculate} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.calcBtnText}>Calculate 🎰</Text>}
        </TouchableOpacity>

        {/* ── Results ── */}
        {result && (
          <>
            <View style={[styles.resultCard, isProfit ? styles.resultProfit : styles.resultLoss]}>
              <Text style={styles.resultMessage}>
                Based on past results, you would have spent {formatMoney(result.spent)} over{' '}
                {result.draws} draws
                {(betMode === 'ibet' || betMode === 'perm')
                  ? ` across ${result.nPerms} unique permutation${result.nPerms > 1 ? 's' : ''}`
                  : ''}
                {' '}and made {formatMoney(result.won)} in winnings!{' '}
                {isProfit ? '🎉 HUAT AHH!' : '😅 Better luck next time lah!'}
              </Text>
              <Text style={[styles.netAmount, { color: isProfit ? '#4CAF50' : '#F44336' }]}>
                Net: {isProfit ? '+' : ''}{formatMoney(net)}
              </Text>
            </View>

            {result.strikes.length > 0 ? (
              <View style={styles.tableCard}>
                <Text style={styles.cardTitle}>Strike History ({result.strikes.length})</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHead, { flex: 1.5 }]}>Date</Text>
                  <Text style={[styles.tableHead, { flex: 0.9, textAlign: 'center' }]}>Number</Text>
                  <Text style={[styles.tableHead, { flex: 1.1 }]}>Prize</Text>
                  <Text style={[styles.tableHead, { flex: 1.2, textAlign: 'right' }]}>Winnings</Text>
                </View>
                {result.strikes.map((s, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, { flex: 1.5, fontSize: 11 }]}>{formatDate(s.date)}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center', fontWeight: '700', color: GOLD, letterSpacing: 1 }]}>{s.number}</Text>
                    <Text style={[styles.tableCell, { flex: 1.1, fontSize: 12 }]}>{s.category}</Text>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right', color: '#4CAF50', fontWeight: '600' }]}>{formatMoney(s.win)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No strikes in this timeframe 😔</Text>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>💾 Save this combination</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd unitId={BANNER_ID} size={BannerAdSize.BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
      </View>
    </View>
  );
}

// ── TOTO Number Picker Modal ──────────────────────────────────────────────────

const ALL_TOTO_NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

function NumberPickerModal({ visible, selected, onPick, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Pick a number</Text>
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
                  <Text style={[styles.pickerNumText, isSelected && styles.pickerNumTextSelected]}>
                    {item}
                  </Text>
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
  const [selected, setSelected]   = useState([]); // array of chosen numbers (1-49)
  const [timeframe, setTimeframe] = useState(1);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const addNumber    = n  => { setSelected(prev => [...prev, n]); setResult(null); setPickerOpen(false); };
  const removeNumber = n  => { setSelected(prev => prev.filter(x => x !== n)); setResult(null); };

  // Build 3×2 display grid
  const slots = [...selected];
  if (slots.length < 6) slots.push('ADD');
  while (slots.length % 3 !== 0) slots.push('EMPTY');

  // Build rows of 3
  const rows = [];
  for (let i = 0; i < slots.length; i += 3) rows.push(slots.slice(i, i + 3));

  const calculate = async () => {
    if (selected.length === 0) {
      Alert.alert('No numbers', 'Please pick at least 1 number.');
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const { data: draws } = await supabase
        .from('toto_draws')
        .select('draw_no, draw_date, n1, n2, n3, n4, n5, n6, additional')
        .gte('draw_date', getStartDate(timeframe))
        .order('draw_date', { ascending: false });

      if (!draws?.length) {
        setResult({ draws: 0, strikes: [], picked: selected });
        setLoading(false);
        return;
      }

      const strikes = [];
      draws.forEach(draw => {
        const winning   = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6];
        const matchMain = selected.filter(n => winning.includes(n));
        const matchAdd  = selected.filter(n => n === draw.additional);
        const allFound  = new Set([...matchMain, ...matchAdd]);

        if (allFound.size === selected.length) {
          strikes.push({ date: draw.draw_date, matchMain, matchAdd });
        }
      });

      setResult({ draws: draws.length, strikes, picked: [...selected] });
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const save = async () => {
    try {
      const key   = [...selected].sort((a, b) => a - b).join(',');
      const saved = JSON.parse((await AsyncStorage.getItem('whatif_toto')) || '[]');
      if (saved.find(s => s.key === key)) {
        Alert.alert('Already saved', 'This combination is already saved.');
        return;
      }
      saved.unshift({ key, numbers: selected, timeframe });
      await AsyncStorage.setItem('whatif_toto', JSON.stringify(saved.slice(0, 10)));
      Alert.alert('Saved! ✓', 'Your combination has been saved.');
    } catch (e) {}
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Question Card ── */}
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>What if I bought</Text>

          {/* 3-column grid — explicit rows to keep slots centered */}
          <View style={styles.totoGrid}>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.totoRow}>
                {row.map((slot, ci) => {
                  if (slot === 'EMPTY') return <View key={ci} style={styles.totoSlotEmpty} />;
                  if (slot === 'ADD')   return (
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

          <Text style={[styles.questionLabel, { marginTop: 16 }]}>for the past</Text>
          <TimeframePicker value={timeframe} onChange={t => { setTimeframe(t); setResult(null); }} />
        </View>

        {/* ── Calculate Button ── */}
        <TouchableOpacity style={styles.calcBtn} onPress={calculate} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.calcBtnText}>Check Draws 🎱</Text>}
        </TouchableOpacity>

        {/* ── Results ── */}
        {result && (
          <>
            <View style={styles.totoSummaryCard}>
              <Text style={styles.totoSummaryText}>
                Over {result.draws} draws, your numbers struck{'\n'}
                <Text style={[styles.totoStrikeCount, { color: result.strikes.length > 0 ? GOLD : '#FF5252' }]}>
                  {result.strikes.length} time{result.strikes.length !== 1 ? 's' : ''}
                </Text>!
              </Text>
              {result.strikes.length > 0 && (
                <Text style={styles.totoLegend}>
                  <Text style={{ color: ORANGE }}>●</Text> via additional ball{'   '}
                  <Text style={{ color: PURPLE }}>●</Text> main numbers
                </Text>
              )}
            </View>

            {result.strikes.length > 0 ? (
              <View style={styles.tableCard}>
                <Text style={styles.cardTitle}>Strike History</Text>
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
                <Text style={styles.emptyText}>No matches found in this timeframe 😔</Text>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>💾 Save this combination</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Number Picker Modal ── */}
      <NumberPickerModal
        visible={pickerOpen}
        selected={selected}
        onPick={addNumber}
        onClose={() => setPickerOpen(false)}
      />

      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd unitId={BANNER_ID} size={BannerAdSize.BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
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

  // Cards
  questionCard:    { backgroundColor: DARK, borderRadius: 16, padding: 20, marginBottom: 12 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  tableCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  resultCard:      { borderRadius: 16, padding: 20, marginBottom: 12 },
  resultProfit:    { backgroundColor: '#E8F5E9' },
  resultLoss:      { backgroundColor: '#FFF3E0' },
  totoSummaryCard: { backgroundColor: DARK, borderRadius: 16, padding: 20, marginBottom: 12 },
  emptyCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', elevation: 1 },

  // Question
  questionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 10 },
  numberInput:   { color: '#fff', fontSize: 36, fontWeight: '700', letterSpacing: 8, borderBottomWidth: 2, borderColor: GOLD, paddingBottom: 4, marginBottom: 18, width: 160 },

  // Timeframe pills
  pillRow:        { flexDirection: 'row', gap: 8 },
  pill:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  pillActive:     { backgroundColor: GOLD },
  pillText:       { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#fff' },

  // Bet inputs
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 12 },
  betRow:    { flexDirection: 'row', gap: 12, marginBottom: 12 },
  betField:  { flex: 1 },
  betLabel:  { fontSize: 11, color: '#999', marginBottom: 4 },
  betInput:  { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 16, fontWeight: '600', color: '#222' },

  // Mode toggles
  toggleRow:         { flexDirection: 'row', gap: 8 },
  toggleBtn:         { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  toggleActive:      { backgroundColor: PURPLE, borderColor: PURPLE },
  toggleDisabled:    { opacity: 0.35 },
  toggleText:        { fontSize: 13, color: '#555', fontWeight: '500' },
  toggleTextActive:  { color: '#fff', fontWeight: '600' },
  permNote:          { marginTop: 10, fontSize: 11, color: PURPLE, textAlign: 'center', lineHeight: 16 },

  // Calc button
  calcBtn:     { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Result card
  resultMessage: { fontSize: 14, color: '#333', lineHeight: 22 },
  netAmount:     { fontSize: 24, fontWeight: '700', marginTop: 12 },

  // Table
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 0.5, borderColor: '#ddd', marginBottom: 2 },
  tableHead:   { fontSize: 11, color: '#999', fontWeight: '500' },
  tableRow:    { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 0.5, borderColor: '#f0f0f0', alignItems: 'center' },
  tableRowAlt: { backgroundColor: '#fafafa' },
  tableCell:   { fontSize: 13, color: '#222' },
  emptyText:   { color: '#999', fontSize: 14 },

  // TOTO 3x2 grid
  totoGrid:           { marginBottom: 4 },
  totoRow:            { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  totoSlotFilled:     { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  totoSlotAdd:        { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: GOLD, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  totoSlotEmpty:      { width: 88, height: 88 },
  totoSlotNumber:     { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  totoSlotAddText:    { color: GOLD, fontSize: 28, fontWeight: '300' },
  totoSlotX:          { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  totoSlotXText:      { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Picker modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '70%' },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  modalTitle:         { fontSize: 15, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 12 },
  pickerGrid:         { paddingHorizontal: 12, paddingBottom: 8 },
  pickerNum:          { flex: 1, margin: 4, aspectRatio: 1, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  pickerNumSelected:  { backgroundColor: PURPLE },
  pickerNumText:      { fontSize: 13, fontWeight: '600', color: '#333' },
  pickerNumTextSelected: { color: '#fff' },

  // TOTO summary
  totoSummaryText:  { color: '#fff', fontSize: 16, lineHeight: 26 },
  totoStrikeCount:  { fontSize: 28, fontWeight: '700' },
  totoLegend:       { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 10 },

  // TOTO strike table
  totoStrikeRow:  { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#f0f0f0', alignItems: 'center' },
  totoStrikeDate: { fontSize: 11, color: '#666', width: 90 },
  miniballRow:    { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  miniball:       { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', margin: 2 },
  miniballMain:   { backgroundColor: 'rgba(124,111,247,0.2)' },
  miniballAdd:    { backgroundColor: ORANGE },
  miniballNone:   { backgroundColor: 'rgba(0,0,0,0.06)' },
  miniballText:   { fontSize: 11, fontWeight: '700', color: '#444' },

  // Save button
  saveBtn:     { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#ddd', elevation: 1 },
  saveBtnText: { color: '#555', fontSize: 14, fontWeight: '500' },

  // Banner
  bannerContainer: { alignItems: 'center', paddingTop: 6, borderTopWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
});
