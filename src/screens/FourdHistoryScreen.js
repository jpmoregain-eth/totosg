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
const PAGE_SIZE   = 20;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR-1, CURRENT_YEAR-2, CURRENT_YEAR-3];

const DAYS_EN  = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtRowDate(dateStr, lang) {
  const d = new Date(dateStr);
  if (lang === 'ZH') {
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  }
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtSheetDate(dateStr, lang) {
  const d = new Date(dateStr);
  if (lang === 'ZH') {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;
  }
  return `${DAYS_EN[d.getDay()]} ${d.getDate()} ${MONTHS_EN[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}

// ── Draw Detail Bottom Sheet ──────────────────────────────────────────────────
function DrawSheet({ draw, prizes, visible, onClose, lang }) {
  const ZH = lang === 'ZH';
  if (!draw) return null;

  const starters     = prizes.filter(p => p.category === 'starter');
  const consolations = prizes.filter(p => p.category === 'consolation');

  const renderGrid = (items, muted = false) => {
    const rows = [];
    for (let i = 0; i < items.length; i += 5) rows.push(items.slice(i, i + 5));
    return (
      <View style={sh.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={sh.gridRow}>
            {row.map((item, ci) => (
              <View key={ci} style={[sh.gridCell, ri === 0 && sh.gridCellFirst]}>
                <Text style={[sh.gridNum, muted && sh.gridNumMuted]}>
                  {typeof item === 'object' ? item.number : item}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sh.scrim}>
        <View style={sh.sheet}>
          {/* Sheet header — red background */}
          <View style={sh.header}>
            <View>
              <Text style={sh.headerDraw}>DRAW #{draw.draw_no}</Text>
              <Text style={sh.headerDate}>{fmtSheetDate(draw.draw_date, lang)}</Text>
            </View>
            <TouchableOpacity style={sh.closeBtn} onPress={onClose}>
              <Text style={sh.closeBtnText}>{ZH ? '关闭' : 'CLOSE'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={sh.body} showsVerticalScrollIndicator={false}>
            {/* Top 3 prizes */}
            <View style={sh.prizesRow}>
              <View style={sh.prizeCell}>
                <Text style={sh.prizeLabelRed}>{ZH ? '头奖' : '1ST'}</Text>
                <Text style={sh.prizeNum}>{draw.prize_1st}</Text>
              </View>
              <View style={sh.prizeDivider} />
              <View style={sh.prizeCell}>
                <Text style={sh.prizeLabelMute}>{ZH ? '二奖' : '2ND'}</Text>
                <Text style={sh.prizeNum}>{draw.prize_2nd}</Text>
              </View>
              <View style={sh.prizeDivider} />
              <View style={sh.prizeCell}>
                <Text style={sh.prizeLabelMute}>{ZH ? '三奖' : '3RD'}</Text>
                <Text style={sh.prizeNum}>{draw.prize_3rd}</Text>
              </View>
            </View>

            {/* Starter grid */}
            <View style={sh.section}>
              <View style={sh.sectionHeader}>
                <Text style={sh.sectionLabel}>{ZH ? '入围奖 ×10' : 'STARTER ×10'}</Text>
                <Text style={sh.sectionMeta}>{ZH ? '$250 大' : '$250 BIG'}</Text>
              </View>
              {prizes.length === 0
                ? <ActivityIndicator color={RED} style={{ marginVertical: 12 }} />
                : renderGrid(starters, false)}
            </View>

            {/* Consolation grid */}
            <View style={sh.section}>
              <View style={sh.sectionHeader}>
                <Text style={sh.sectionLabel}>{ZH ? '安慰奖 ×10' : 'CONSOLATION ×10'}</Text>
                <Text style={sh.sectionMeta}>{ZH ? '$60 大' : '$60 BIG'}</Text>
              </View>
              {prizes.length === 0
                ? <ActivityIndicator color={RED} style={{ marginVertical: 12 }} />
                : renderGrid(consolations, true)}
            </View>

            {/* Footer note */}
            <Text style={sh.footer}>
              {ZH ? '本期共 23 个中奖号码' : '23 WINNING NUMBERS IN THIS DRAW'}
            </Text>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FourdHistoryScreen() {
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
  const [sheetVisible, setSheetVisible] = useState(false);

  const fetchDraws = useCallback(async (pageNum = 0, year = CURRENT_YEAR) => {
    if (pageNum === 0) setLoading(true); else setLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from('fourd_draws')
      .select('draw_no, draw_date, prize_1st, prize_2nd, prize_3rd')
      .gte('draw_date', `${year}-01-01`)
      .lt('draw_date',  `${year + 1}-01-01`)
      .order('draw_date', { ascending: false })
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
    setSheetVisible(true);
    const { data } = await supabase
      .from('fourd_prizes')
      .select('*')
      .eq('draw_no', draw.draw_no);
    setSelectedPrizes(data || []);
  };

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderItem = ({ item }) => (
    <TouchableOpacity style={s.row} onPress={() => openDraw(item)} activeOpacity={0.7}>
      <View style={s.rowContent}>
        <Text style={s.rowDrawNo}>#{item.draw_no} · {fmtRowDate(item.draw_date, lang)}</Text>
        <Text style={s.rowNumsText}>
          <Text style={s.rowNum1}>{item.prize_1st}  </Text>
          <Text style={s.rowNum2}>{item.prize_2nd}  </Text>
          <Text style={s.rowNum3}>{item.prize_3rd}</Text>
        </Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );

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

      {/* ── Hint line ── */}
      <View style={s.hintRow}>
        <Text style={s.hintText}>
          {ZH ? '点击任一期查看完整成绩' : 'TAP A DRAW FOR THE FULL RESULT'}
        </Text>
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
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        lang={lang}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: PAPER },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAPER },

  // Year filter bar
  yearBar:          { flexDirection: 'row', alignItems: 'center', backgroundColor: TINT, borderBottomWidth: 1, borderColor: RED, paddingVertical: 8, paddingHorizontal: 12 },
  yearChips:        { flexDirection: 'row', gap: 6 },
  yearChip:         { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: RED },
  yearChipActive:   { backgroundColor: RED },
  yearChipText:     { fontFamily: 'IBMPlexMono-Medium', fontSize: 11, color: RED, letterSpacing: 1 },
  yearChipTextActive:{ color: PAPER },
  drawCount:        { fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: FAINT, marginLeft: 'auto', letterSpacing: 1 },

  // Hint row
  hintRow:  { borderBottomWidth: 1, borderStyle: 'dotted', borderColor: RULE, paddingHorizontal: 16, paddingVertical: 7 },
  hintText: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, letterSpacing: 1 },

  // Draw rows
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: RULE },
  rowContent:  { flex: 1 },
  rowDrawNo:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 10, color: MUTE, letterSpacing: 0.5, marginBottom: 6 },
  rowNums:     { flex: 1 },
  rowNumsText: { fontFamily: 'IBMPlexMono-Medium', fontSize: 19, letterSpacing: 1 },
  rowNum1:  { color: RED },
  rowNum2:  { color: INK },
  rowNum3:  { color: INK },
  chevron:  { fontFamily: 'IBMPlexMono-Regular', fontSize: 20, color: RED, marginLeft: 8 },

  // Footer
  scrollHint: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, textAlign: 'center', letterSpacing: 1, paddingVertical: 16 },
  empty:      { fontFamily: 'IBMPlexMono-Regular', fontSize: 11, color: FAINT, textAlign: 'center', paddingVertical: 40, letterSpacing: 1 },
});

// ── Sheet styles ──────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  scrim:  { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet:  { backgroundColor: PAPER, borderTopWidth: 3, borderColor: RED, maxHeight: '88%' },

  // Header
  header:       { backgroundColor: RED, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headerDraw:   { fontFamily: 'ArchivoNarrow-Bold', fontSize: 19, color: PAPER, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerDate:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.78)', letterSpacing: 2, marginTop: 3 },
  closeBtn:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 9, paddingVertical: 5 },
  closeBtnText: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: PAPER, letterSpacing: 1 },

  body: { paddingHorizontal: 16, paddingTop: 12 },

  // Top 3 prizes
  prizesRow:    { flexDirection: 'row', borderBottomWidth: 1, borderColor: RULE, paddingBottom: 14, marginBottom: 14 },
  prizeCell:    { flex: 1 },
  prizeDivider: { width: 1, backgroundColor: RULE, marginHorizontal: 10 },
  prizeLabelRed:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: RED, letterSpacing: 2, marginBottom: 4 },
  prizeLabelMute: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: MUTE, letterSpacing: 2, marginBottom: 4 },
  prizeNum:     { fontFamily: 'IBMPlexMono-Bold', fontSize: 26, color: INK, letterSpacing: 2 },

  // Grids
  section:       { marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sectionLabel:  { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 9, color: INK, letterSpacing: 2 },
  sectionMeta:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: FAINT, letterSpacing: 1 },
  grid:          { borderTopWidth: 1, borderLeftWidth: 1, borderColor: RED },
  gridRow:       { flexDirection: 'row' },
  gridCell:      { flex: 1, alignItems: 'center', paddingVertical: 9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: RULE },
  gridCellFirst: { borderTopColor: RED },
  gridNum:       { fontFamily: 'IBMPlexMono-Medium', fontSize: 16, color: INK, letterSpacing: 1 },
  gridNumMuted:  { color: MUTE },

  footer: { fontFamily: 'IBMPlexMono-Regular', fontSize: 9, color: FAINT, textAlign: 'center', letterSpacing: 1.5, marginTop: 8 },
});
