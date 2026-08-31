import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useLang } from '../lib/LangContext';

// ── Design tokens ─────────────────────────────────────────────────────────────
const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';
const FAINT = '#9A9A9A';
const RULE  = '#E4DEDE';
const TINT  = '#FDF0F1';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDrawDate(dateStr, lang) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (lang === 'ZH') {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;
  }
  const days   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function useCountdown(targetStr) {
  const [display, setDisplay] = useState('--:--:--');
  useEffect(() => {
    if (!targetStr) return;
    // targetStr format from DB: "Mon, 25 Aug 2025" — parse to next 6:30 PM SGT
    const parts = targetStr.match(/(\d+)\s+(\w+)\s+(\d+)/);
    if (!parts) return;
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const target = new Date(
      parseInt(parts[3]), months[parts[2]], parseInt(parts[1]), 18, 30, 0
    );
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
  }, [targetStr]);
  return display;
}

function fmtMoney(n) {
  if (!n) return '-';
  return '$' + Number(n).toLocaleString('en-SG');
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ResultsScreen() {
  const { lang } = useLang();
  const ZH = lang === 'ZH';

  const [draw,      setDraw]      = useState(null);
  const [prizes,    setPrizes]    = useState([]);
  const [jackpot,   setJackpot]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const countdown = useCountdown(jackpot?.next_draw_date);

  const fetchLatest = async () => {
    const { data: drawData } = await supabase
      .from('toto_draws')
      .select('*')
      .order('draw_no', { ascending: false })
      .limit(1)
      .single();

    if (drawData) {
      setDraw(drawData);
      const { data: prizeData } = await supabase
        .from('toto_prize_details')
        .select('*')
        .eq('draw_no', drawData.draw_no)
        .order('prize_group');
      setPrizes(prizeData || []);
    }

    const { data: jackpotData } = await supabase
      .from('toto_jackpot')
      .select('*')
      .eq('id', 1)
      .single();
    if (jackpotData) setJackpot(jackpotData);

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

  const nums       = draw ? [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6] : [];
  const dateStr    = formatDrawDate(draw?.draw_date, lang);
  const group1Prize = prizes.find(p => p.prize_group === 1);

  // Prize table — skip group 1 (shown in hero block)
  const tableRows = prizes.filter(p => p.prize_group !== 1);

  const grpLabel = (g) => {
    if (ZH) {
      const map = { 2:'二奖', 3:'三奖', 4:'四奖', 5:'五奖', 6:'六奖', 7:'七奖' };
      return map[g] || `GRP ${g}`;
    }
    return `GRP ${g}`;
  };

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
    >
      {/* ── Draw header ── */}
      <View style={s.drawHeader}>
        <Text style={s.drawNo}>DRAW #{draw?.draw_no}</Text>
        <Text style={s.drawDate}>{dateStr}</Text>
      </View>

      {/* ── Winning numbers ── */}
      <View style={s.section}>
        <Text style={s.fieldLabel}>{ZH ? '中奖号码' : 'WINNING NUMBERS'}</Text>
        <View style={s.ballsRow}>
          {nums.map((n, i) => (
            <View key={i} style={s.ball}>
              <Text style={s.ballText}>{String(n).padStart(2, '0')}</Text>
            </View>
          ))}
        </View>

        {/* Additional ball */}
        <View style={s.additionalRow}>
          <View style={s.ballRed}>
            <Text style={s.ballRedText}>{String(draw?.additional).padStart(2, '0')}</Text>
          </View>
          <Text style={s.additionalLabel}>{ZH ? '附加号码' : 'ADDITIONAL'}</Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* ── Group 1 hero ── */}
      <View style={s.section}>
        <Text style={s.fieldLabel}>{ZH ? '头奖' : 'GROUP 1 PRIZE'}</Text>
        <View style={s.heroRow}>
          <Text style={s.heroAmount}>
            {draw?.group1_prize
              ? '$' + Number(draw.group1_prize).toLocaleString('en-SG')
              : fmtMoney(group1Prize?.share_amount)}
          </Text>
          <View style={s.heroShares}>
            <Text style={s.heroSharesLabel}>{ZH ? '得奖人数' : 'SHARES'}</Text>
            <Text style={s.heroSharesVal}>{group1Prize?.winning_shares ?? '-'}</Text>
          </View>
        </View>
      </View>

      <View style={s.divider} />

      {/* ── Est. Next Jackpot ── */}
      {jackpot && (
        <View style={s.jackpotCard}>
          <View>
            <Text style={s.jackpotCardLabel}>{ZH ? '下期预计头奖' : 'EST. NEXT JACKPOT'}</Text>
            <Text style={s.jackpotCardAmt}>
              {'$' + Number(jackpot.jackpot_amount).toLocaleString('en-SG')}
            </Text>
          </View>
          <View style={s.jackpotCardRight}>
            <Text style={s.jackpotCardLabel}>{ZH ? '距离截止' : 'CLOSES IN'}</Text>
            <Text style={s.jackpotCardTimer}>{countdown}</Text>
          </View>
        </View>
      )}

      <View style={s.divider} />

      {/* ── Prize table (GRP 2–7) ── */}
      <View style={s.section}>
        <Text style={s.fieldLabel}>{ZH ? '奖项分组' : 'PRIZE GROUPS'}</Text>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHead, { flex: 1 }]}>{ZH ? '组别' : 'GRP'}</Text>
          <Text style={[s.tableHead, { flex: 1.5, textAlign: 'center' }]}>{ZH ? '得奖人数' : 'SHARES'}</Text>
          <Text style={[s.tableHead, { flex: 2, textAlign: 'right' }]}>{ZH ? '每份奖金' : 'PER SHARE'}</Text>
        </View>

        {tableRows.map((p) => (
          <View key={p.prize_group} style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 1 }]}>{grpLabel(p.prize_group)}</Text>
            <Text style={[s.tableCellMute, { flex: 1.5, textAlign: 'center' }]}>
              {p.winning_shares > 0 ? p.winning_shares.toLocaleString() : '-'}
            </Text>
            <Text style={[s.tableCell, { flex: 2, textAlign: 'right' }]}>
              {p.share_amount ? fmtMoney(p.share_amount) : '-'}
            </Text>
          </View>
        ))}
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

  // Draw header
  drawHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderColor: RED, marginBottom: 14 },
  drawNo:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: INK, letterSpacing: 1.5 },
  drawDate:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: MUTE, letterSpacing: 1.2 },

  // Section
  section:    { paddingVertical: 12 },
  fieldLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2, marginBottom: 10 },
  divider:    { height: 1, backgroundColor: RULE },

  // Balls
  ballsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ball:     { flex: 1, marginHorizontal: 2, aspectRatio: 1, borderWidth: 1, borderColor: RED, backgroundColor: TINT, alignItems: 'center', justifyContent: 'center' },
  ballText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 17, color: INK, includeFontPadding: false, textAlignVertical: 'center' },

  // Additional ball
  additionalRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ballRed:        { width: 48, height: 48, borderWidth: 1, borderColor: RED, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  ballRedText:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 17, color: PAPER, includeFontPadding: false, textAlignVertical: 'center' },
  additionalLabel:{ fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: MUTE, letterSpacing: 2 },

  // Group 1 hero
  heroRow:        { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroAmount:     { fontFamily: 'IBMPlexMono-Bold', fontSize: 36, color: INK, letterSpacing: -0.5, flex: 1 },
  heroShares:     { alignItems: 'flex-end', paddingBottom: 4 },
  heroSharesLabel:{ fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1, marginBottom: 3 },
  heroSharesVal:  { fontFamily: 'IBMPlexMono-Bold', fontSize: 22, color: INK },

  // Prize table
  tableHeader:   { flexDirection: 'row', paddingBottom: 7, borderBottomWidth: 1, borderColor: RED, marginBottom: 2 },
  tableHead:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: FAINT, letterSpacing: 1.5 },
  tableRow:      { flexDirection: 'row', paddingVertical: 11, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: RULE },
  tableCell:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 14, color: INK },
  tableCellMute: { fontFamily: 'IBMPlexMono-Regular', fontSize: 14, color: MUTE },

  // Jackpot card
  jackpotCard:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: RULE, padding: 14, marginTop: 4 },
  jackpotCardLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 1.5, marginBottom: 5 },
  jackpotCardAmt:   { fontFamily: 'IBMPlexMono-Bold', fontSize: 22, color: INK },
  jackpotCardRight: { alignItems: 'flex-end' },
  jackpotCardTimer: { fontFamily: 'IBMPlexMono-Bold', fontSize: 22, color: RED, letterSpacing: 1 },
});
