import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useLang } from '../lib/LangContext';

// ── Design tokens ─────────────────────────────────────────────────────────────
const RED    = '#ED2939';
const PAPER  = '#FFFFFF';
const INK    = '#1A1A1A';
const MUTE   = '#7C7C7C';
const FAINT  = '#9A9A9A';
const RULE   = '#E4DEDE';
const TINT   = '#FDF0F1';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDrawDate(dateStr, lang) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (lang === 'ZH') {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;
  }
  return d.toLocaleDateString('en-SG', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase();
}

function getNextDrawInfo(lang) {
  const now   = new Date();
  const draws = [3, 6, 0]; // Wed=3, Sat=6, Sun=0
  let next    = null;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(18, 30, 0, 0);
    if (draws.includes(d.getDay())) { next = d; break; }
  }
  if (!next) return { label: '', countdown: '' };
  const days  = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const month = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const label = lang === 'ZH'
    ? `${next.getMonth()+1}月${next.getDate()}日 · 18:30`
    : `${days[next.getDay()]} ${next.getDate()} ${month[next.getMonth()]} · 18:30`;
  return { next, label };
}

function useCountdown(target) {
  const [display, setDisplay] = useState('--:--:--');
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setDisplay('00:00:00'); return; }
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setDisplay(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return display;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FourdResultsScreen() {
  const { lang } = useLang();
  const ZH = lang === 'ZH';

  const [draw,      setDraw]      = useState(null);
  const [prizes,    setPrizes]    = useState({ starters: [], consolations: [] });
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const { next: nextDrawTarget, label: nextDrawLabel } = getNextDrawInfo(lang);
  const countdown = useCountdown(nextDrawTarget?.getTime());

  const fetchLatest = async () => {
    const { data: drawData } = await supabase
      .from('fourd_draws')
      .select('*')
      .order('draw_date', { ascending: false })
      .limit(1)
      .single();

    if (drawData) {
      setDraw(drawData);
      const { data: prizeData } = await supabase
        .from('fourd_prizes')
        .select('*')
        .eq('draw_no', drawData.draw_no);

      const starters     = prizeData?.filter(p => p.category === 'starter').map(p => p.number)     || [];
      const consolations = prizeData?.filter(p => p.category === 'consolation').map(p => p.number) || [];
      setPrizes({ starters, consolations });
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchLatest(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchLatest(); };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={RED} />
    </View>
  );

  const dateStr = formatDrawDate(draw?.draw_date, lang);

  // ── 5-column grid renderer ────────────────────────────────────────────────
  const renderGrid = (numbers, muted = false) => {
    const rows = [];
    for (let i = 0; i < numbers.length; i += 5) {
      rows.push(numbers.slice(i, i + 5));
    }
    return (
      <View style={s.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={s.gridRow}>
            {row.map((n, ci) => (
              <View key={ci} style={[s.gridCell, ri === 0 && s.gridCellFirstRow]}>
                <Text style={[s.gridNum, muted && s.gridNumMuted]}>{n}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
    >
      {/* ── Draw header row ── */}
      <View style={s.drawHeader}>
        <Text style={s.drawNo}>DRAW #{draw?.draw_no}</Text>
        <Text style={s.drawDate}>{dateStr}</Text>
      </View>

      {/* ── 1st Prize ── */}
      <View style={s.firstPrizeBlock}>
        <Text style={s.prizeLabel}>{ZH ? '头奖' : '1ST PRIZE'}</Text>
        <Text style={s.firstPrizeNum}>{draw?.prize_1st}</Text>
      </View>

      {/* ── 2nd / 3rd Prize ── */}
      <View style={s.secondThirdRow}>
        <View style={s.secondThirdCell}>
          <Text style={s.prizeLabel}>{ZH ? '二奖' : '2ND PRIZE'}</Text>
          <Text style={s.secondThirdNum}>{draw?.prize_2nd}</Text>
        </View>
        <View style={s.secondThirdDivider} />
        <View style={s.secondThirdCell}>
          <Text style={s.prizeLabel}>{ZH ? '三奖' : '3RD PRIZE'}</Text>
          <Text style={s.secondThirdNum}>{draw?.prize_3rd}</Text>
        </View>
      </View>

      {/* ── Starter grid ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>{ZH ? '入围奖 ×10' : 'STARTER ×10'}</Text>
          <Text style={s.sectionMeta}>{ZH ? '$250 大' : '$250 BIG'}</Text>
        </View>
        {renderGrid(prizes.starters, false)}
      </View>

      {/* ── Consolation grid ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>{ZH ? '安慰奖 ×10' : 'CONSOLATION ×10'}</Text>
          <Text style={s.sectionMeta}>{ZH ? '$60 大' : '$60 BIG'}</Text>
        </View>
        {renderGrid(prizes.consolations, true)}
      </View>

      {/* ── Next draw countdown ── */}
      <View style={s.countdownCard}>
        <View>
          <Text style={s.countdownLabel}>{ZH ? '下期开彩' : 'NEXT DRAW'}</Text>
          <Text style={s.countdownDate}>{nextDrawLabel}</Text>
        </View>
        <Text style={s.countdownTimer}>{countdown}</Text>
      </View>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: PAPER },
  content:  { paddingHorizontal: 16, paddingTop: 12 },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAPER },

  // Draw header row
  drawHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderColor: RED, marginBottom: 14 },
  drawNo:       { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: INK, letterSpacing: 1.5 },
  drawDate:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: MUTE, letterSpacing: 1.2 },

  // 1st prize
  firstPrizeBlock: { marginBottom: 14 },
  prizeLabel:      { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2, marginBottom: 4 },
  firstPrizeNum:   { fontFamily: 'IBMPlexMono-Bold', fontSize: 62, color: INK, letterSpacing: 3, lineHeight: 68 },

  // 2nd / 3rd
  secondThirdRow:     { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: RULE, paddingVertical: 12, marginBottom: 18 },
  secondThirdCell:    { flex: 1 },
  secondThirdDivider: { width: 1, backgroundColor: RULE, marginHorizontal: 16 },
  secondThirdNum:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 30, color: INK, letterSpacing: 2, marginTop: 4 },

  // Section
  section:       { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionLabel:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: INK, letterSpacing: 2 },
  sectionMeta:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: FAINT, letterSpacing: 1 },

  // 5-col grid
  grid:            { borderTopWidth: 1, borderLeftWidth: 1, borderColor: RED },
  gridRow:         { flexDirection: 'row' },
  gridCell:        { flex: 1, alignItems: 'center', paddingVertical: 9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: RULE },
  gridCellFirstRow:{ borderTopColor: RED },
  gridNum:         { fontFamily: 'IBMPlexMono-Medium', fontSize: 16, color: INK, letterSpacing: 1 },
  gridNumMuted:    { color: MUTE },

  // Countdown card
  countdownCard:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: RED, padding: 12, marginTop: 4 },
  countdownLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 3 },
  countdownDate:  { fontFamily: 'IBMPlexMono-Medium', fontSize: 13, color: INK, letterSpacing: 0.5 },
  countdownTimer: { fontFamily: 'IBMPlexMono-Bold', fontSize: 26, color: RED, letterSpacing: 1 },
});
