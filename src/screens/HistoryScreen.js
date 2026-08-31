import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView,
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

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE    = 20;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS        = [CURRENT_YEAR, CURRENT_YEAR-1, CURRENT_YEAR-2, CURRENT_YEAR-3];
const MONTHS       = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS         = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtRowDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtSheetDate(dateStr) {
  const d = new Date(dateStr);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── Draw Detail Bottom Sheet ──────────────────────────────────────────────────
function DrawSheet({ draw, prizes, prizeLoading, visible, onClose, lang }) {
  const ZH = lang === 'ZH';
  if (!draw) return null;

  const nums = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6];

  const grpLabel = (g) => {
    if (ZH) {
      const map = { 1:'头奖', 2:'二奖', 3:'三奖', 4:'四奖', 5:'五奖', 6:'六奖', 7:'七奖' };
      return map[g] || `GRP ${g}`;
    }
    return `GRP ${g}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sh.scrim}>
        <View style={sh.sheet}>
          {/* Red header */}
          <View style={sh.header}>
            <View>
              <Text style={sh.headerDraw}>DRAW #{draw.draw_no}</Text>
              <Text style={sh.headerDate}>{fmtSheetDate(draw.draw_date)}</Text>
            </View>
            <TouchableOpacity style={sh.closeBtn} onPress={onClose}>
              <Text style={sh.closeBtnText}>{ZH ? '关闭' : 'CLOSE'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={sh.body} showsVerticalScrollIndicator={false}>
            {/* Winning numbers */}
            <Text style={sh.fieldLabel}>{ZH ? '中奖号码' : 'WINNING NUMBERS'}</Text>
            <View style={sh.ballsRow}>
              {nums.map((n, i) => (
                <View key={i} style={sh.ball}>
                  <Text style={sh.ballText}>{pad(n)}</Text>
                </View>
              ))}
            </View>
            <View style={sh.additionalRow}>
              <View style={sh.ballRed}>
                <Text style={sh.ballRedText}>{pad(draw.additional)}</Text>
              </View>
              <Text style={sh.additionalLabel}>{ZH ? '附加号码' : 'ADDITIONAL'}</Text>
            </View>

            <View style={sh.divider} />

            {/* Prize table — all groups */}
            <Text style={sh.fieldLabel}>{ZH ? '奖项分组' : 'PRIZE GROUPS'}</Text>
            <View style={sh.tableHeader}>
              <Text style={[sh.tableHead, { flex: 1 }]}>{ZH ? '组别' : 'GRP'}</Text>
              <Text style={[sh.tableHead, { flex: 1.5, textAlign: 'center' }]}>{ZH ? '得奖人数' : 'SHARES'}</Text>
              <Text style={[sh.tableHead, { flex: 2, textAlign: 'right' }]}>{ZH ? '每份奖金' : 'PER SHARE'}</Text>
            </View>

            {prizeLoading ? (
              <ActivityIndicator color={RED} style={{ marginVertical: 16 }} />
            ) : prizes.length > 0 ? (
              prizes.map(p => (
                <View key={p.prize_group} style={sh.tableRow}>
                  <Text style={[sh.tableCell, { flex: 1 }]}>{grpLabel(p.prize_group)}</Text>
                  <Text style={[sh.tableCellMute, { flex: 1.5, textAlign: 'center' }]}>
                    {p.winning_shares > 0 ? p.winning_shares.toLocaleString() : '-'}
                  </Text>
                  <Text style={[sh.tableCell, { flex: 2, textAlign: 'right' }]}>
                    {p.share_amount ? '$' + Number(p.share_amount).toLocaleString('en-SG') : '-'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={sh.noPrizes}>{ZH ? '暂无奖项资料' : 'No prize data available'}</Text>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { lang } = useLang();
  const ZH = lang === 'ZH';

  const [draws,        setDraws]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [page,         setPage]         = useState(0);
  const [hasMore,      setHasMore]      = useState(true);
  const [filterYear,   setFilterYear]   = useState(CURRENT_YEAR);
  const [selectedDraw, setSelectedDraw] = useState(null);
  const [selectedPrizes, setSelectedPrizes] = useState([]);
  const [prizeLoading, setPrizeLoading] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const fetchDraws = useCallback(async (pageNum = 0, year = CURRENT_YEAR) => {
    if (pageNum === 0) setLoading(true); else setLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from('toto_draws')
      .select('*')
      .gte('draw_date', `${year}-01-01`)
      .lt('draw_date',  `${year + 1}-01-01`)
      .order('draw_no', { ascending: false })
      .range(from, to);

    if (data) {
      setDraws(pageNum === 0 ? data : prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => { setPage(0); fetchDraws(0, filterYear); }, [filterYear]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const next = page + 1; setPage(next); fetchDraws(next, filterYear);
    }
  };

  const openDraw = async (draw) => {
    setSelectedDraw(draw);
    setSelectedPrizes([]);
    setPrizeLoading(true);
    setSheetVisible(true);
    const { data } = await supabase
      .from('toto_prize_details')
      .select('*')
      .eq('draw_no', draw.draw_no)
      .order('prize_group');
    setSelectedPrizes(data || []);
    setPrizeLoading(false);
  };

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const nums     = [item.n1, item.n2, item.n3, item.n4, item.n5, item.n6];
    const isRollover = item.group1_prize && Number(item.group1_prize) === 0;

    return (
      <TouchableOpacity style={s.row} onPress={() => openDraw(item)} activeOpacity={0.7}>
        <View style={s.rowContent}>
          <View style={s.rowMeta}>
            <Text style={s.rowMetaText}>#{item.draw_no} · {fmtRowDate(item.draw_date)}</Text>
            {isRollover && <Text style={s.rollover}>{ZH ? '过关' : 'ROLLOVER'}</Text>}
          </View>
          <View style={s.rowNums}>
            {nums.map((n, i) => (
              <Text key={i} style={s.rowNum}>{pad(n)} </Text>
            ))}
            <Text style={s.rowAdditional}>+{pad(item.additional)}</Text>
          </View>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={RED} />
    </View>
  );

  return (
    <View style={s.wrapper}>
      {/* ── Year filter chips ── */}
      <View style={s.yearBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.yearChips}>
          {YEARS.map(y => (
            <TouchableOpacity
              key={y}
              style={[s.yearChip, filterYear === y && s.yearChipActive]}
              onPress={() => setFilterYear(y)}
            >
              <Text style={[s.yearChipText, filterYear === y && s.yearChipTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={s.drawCount}>{draws.length} {ZH ? '期' : 'DRAWS'}</Text>
      </View>

      {/* ── Hint ── */}
      <View style={s.hintRow}>
        <Text style={s.hintText}>{ZH ? '点击任一期查看完整成绩' : 'TAP A DRAW FOR THE FULL RESULT'}</Text>
      </View>

      {/* ── Draw list ── */}
      <FlatList
        data={draws}
        keyExtractor={item => String(item.draw_no)}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore
            ? <ActivityIndicator style={{ padding: 16 }} color={RED} />
            : draws.length > 0
              ? <Text style={s.scrollHint}>{ZH ? '— 上滑查看更多 —' : '— SCROLL FOR OLDER —'}</Text>
              : null
        }
        ListEmptyComponent={
          <Text style={s.empty}>{ZH ? '本年度暂无成绩' : 'NO DRAWS FOR THIS YEAR'}</Text>
        }
      />

      {/* ── Detail sheet ── */}
      <DrawSheet
        draw={selectedDraw}
        prizes={selectedPrizes}
        prizeLoading={prizeLoading}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        lang={lang}
      />
    </View>
  );
}

// ── List styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: PAPER },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAPER },

  yearBar:           { flexDirection: 'row', alignItems: 'center', backgroundColor: TINT, borderBottomWidth: 1, borderColor: RED, paddingVertical: 8, paddingHorizontal: 12 },
  yearChips:         { flexDirection: 'row', gap: 6 },
  yearChip:          { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: RED },
  yearChipActive:    { backgroundColor: RED },
  yearChipText:      { fontFamily: 'IBMPlexMono-Medium', fontSize: 11, color: RED, letterSpacing: 1 },
  yearChipTextActive:{ color: PAPER },
  drawCount:         { fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: FAINT, marginLeft: 'auto', letterSpacing: 1 },

  hintRow:  { borderBottomWidth: 1, borderColor: RULE, paddingHorizontal: 16, paddingVertical: 7 },
  hintText: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1 },

  row:        { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: RULE, flexDirection: 'row', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowMeta:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rowMetaText:{ fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: MUTE, letterSpacing: 0.5 },
  rollover:   { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 8, color: MUTE, letterSpacing: 1, borderWidth: 1, borderColor: RULE, paddingHorizontal: 5, paddingVertical: 2 },
  rowNums:    { flexDirection: 'row', alignItems: 'center' },
  rowNum:     { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 18, color: INK, letterSpacing: 0.5 },
  rowAdditional: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 18, color: RED },
  chevron:    { fontFamily: 'IBMPlexMono-Regular', fontSize: 20, color: RED, marginLeft: 6 },

  scrollHint: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, textAlign: 'center', letterSpacing: 1, paddingVertical: 16 },
  empty:      { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: FAINT, textAlign: 'center', paddingVertical: 40, letterSpacing: 1 },
});

// ── Sheet styles ──────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: PAPER, borderTopWidth: 3, borderColor: RED, maxHeight: '88%' },

  header:       { backgroundColor: RED, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headerDraw:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 19, color: PAPER, letterSpacing: 0.5 },
  headerDate:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.78)', letterSpacing: 2, marginTop: 3 },
  closeBtn:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 9, paddingVertical: 5 },
  closeBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 1 },

  body:       { paddingHorizontal: 16, paddingTop: 14 },
  fieldLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2, marginBottom: 10 },
  divider:    { height: 1, backgroundColor: RULE, marginVertical: 14 },

  ballsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ball:     { flex: 1, marginHorizontal: 2, aspectRatio: 1, borderWidth: 1, borderColor: RED, backgroundColor: TINT, alignItems: 'center', justifyContent: 'center' },
  ballText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 17, color: INK, includeFontPadding: false, textAlignVertical: 'center' },

  additionalRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  ballRed:        { width: 48, height: 48, borderWidth: 1, borderColor: RED, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  ballRedText:    { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 17, color: PAPER, includeFontPadding: false, textAlignVertical: 'center' },
  additionalLabel:{ fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: MUTE, letterSpacing: 2 },

  tableHeader:   { flexDirection: 'row', paddingBottom: 7, borderBottomWidth: 1, borderColor: RED, marginBottom: 2 },
  tableHead:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: FAINT, letterSpacing: 1.5 },
  tableRow:      { flexDirection: 'row', paddingVertical: 11, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: RULE },
  tableCell:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 14, color: INK },
  tableCellMute: { fontFamily: 'IBMPlexMono-Regular', fontSize: 14, color: MUTE },
  noPrizes:      { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: FAINT, textAlign: 'center', paddingVertical: 20 },
});
