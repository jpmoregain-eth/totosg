import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK = '#1a1a2e';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const START_YEAR = 1986;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);

function MonthYearPicker({ visible, onClose, onSelect }) {
  const [selMonth, setSelMonth] = React.useState(new Date().getMonth());
  const [selYear, setSelYear] = React.useState(new Date().getFullYear());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mpStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={mpStyles.container}>
          <Text style={mpStyles.title}>Select Month & Year</Text>
          <View style={mpStyles.columns}>
            <ScrollView style={mpStyles.col} showsVerticalScrollIndicator={false}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity key={m} style={[mpStyles.item, selMonth === i && mpStyles.itemActive]} onPress={() => setSelMonth(i)}>
                  <Text style={[mpStyles.itemText, selMonth === i && mpStyles.itemTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={mpStyles.col} showsVerticalScrollIndicator={false}>
              {YEARS.map(y => (
                <TouchableOpacity key={y} style={[mpStyles.item, selYear === y && mpStyles.itemActive]} onPress={() => setSelYear(y)}>
                  <Text style={[mpStyles.itemText, selYear === y && mpStyles.itemTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={mpStyles.btn} onPress={() => { console.log('Show Results pressed:', selMonth, selYear); onSelect(selMonth, selYear); onClose(); }}>
            <Text style={mpStyles.btnText}>Show Results</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mpStyles.clear} onPress={() => { onSelect(null, null); onClose(); }}>
            <Text style={mpStyles.clearText}>Clear filter</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const mpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', maxHeight: '70%' },
  title: { fontSize: 16, fontWeight: '600', color: DARK, textAlign: 'center', marginBottom: 16 },
  columns: { flexDirection: 'row', height: 200 },
  col: { flex: 1 },
  item: { paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginVertical: 2 },
  itemActive: { backgroundColor: DARK },
  itemText: { fontSize: 14, color: '#555' },
  itemTextActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: DARK, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  clear: { alignItems: 'center', marginTop: 10 },
  clearText: { color: '#999', fontSize: 13 },
});
const GOLD = '#C9A84C';
const PAGE_SIZE = 20;

const BANNER_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-6984775309510247/2111888204';

function DrawModal({ draw, prizes, visible, onClose }) {
  if (!draw) return null;

  const dateStr = new Date(draw.draw_date).toLocaleDateString('en-SG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const starters = prizes.filter(p => p.category === 'starter');
  const consolations = prizes.filter(p => p.category === 'consolation');

  const renderGrid = (numbers, color) => {
    const rows = [];
    for (let i = 0; i < numbers.length; i += 4) {
      rows.push(numbers.slice(i, i + 4));
    }
    return rows.map((row, ri) => (
      <View key={ri} style={styles.gridRow}>
        {row.map((n, ci) => (
          <View key={ci} style={[styles.gridCell, { backgroundColor: color + '22' }]}>
            <Text style={[styles.gridNumber, { color }]}>{n.number}</Text>
          </View>
        ))}
      </View>
    ));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Draw #{draw.draw_no}</Text>
              <Text style={styles.modalDate}>{dateStr}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Top 3 */}
            <View style={styles.topPrizesRow}>
              {[
                { label: '1st', value: draw.prize_1st, color: GOLD },
                { label: '2nd', value: draw.prize_2nd, color: '#C0C0C0' },
                { label: '3rd', value: draw.prize_3rd, color: '#CD7F32' },
              ].map(p => (
                <View key={p.label} style={styles.prizeBox}>
                  <Text style={[styles.prizeLabel, { color: p.color }]}>{p.label}</Text>
                  <Text style={styles.prizeNumber}>{p.value}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Starter Prizes</Text>
            {renderGrid(starters, '#185FA5')}

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Consolation Prizes</Text>
            {renderGrid(consolations, '#534AB7')}

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeBottomBtn} onPress={onClose}>
            <Text style={styles.closeBottomText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FourdHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterMonth, setFilterMonth] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedDraw, setSelectedDraw] = useState(null);
  const [selectedPrizes, setSelectedPrizes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchDraws = useCallback(async (pageNum = 0, month = null, year = null, append = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('fourd_draws')
      .select('draw_no, draw_date, prize_1st, prize_2nd, prize_3rd')
      .order('draw_date', { ascending: false })
      .range(from, to);

    if (month !== null && year !== null) {
      const monthStr = String(month + 1).padStart(2, '0');
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const nextMonthStr = String(nextMonth).padStart(2, '0');
      const dateFrom = `${year}-${monthStr}-01`;
      const dateTo = `${nextYear}-${nextMonthStr}-01`;
      console.log('Filtering by:', dateFrom, 'to', dateTo);
      query = supabase
        .from('fourd_draws')
        .select('draw_no, draw_date, prize_1st, prize_2nd, prize_3rd')
        .gte('draw_date', dateFrom)
        .lt('draw_date', dateTo)
        .order('draw_date', { ascending: false });
    }

    const { data, error } = await query;
    console.log('Query result:', data?.length, 'error:', error);
    if (data) {
      if (pageNum === 0) setDraws(data);
      else setDraws(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE && month === null);
    }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    console.log('Filter changed:', filterMonth, filterYear);
    setPage(0);
    fetchDraws(0, filterMonth, filterYear, false);
  }, [filterMonth, filterYear]);

  const loadMore = () => {
    if (!loadingMore && hasMore && filterMonth === null) {
      setLoadingMore(true);
      const next = page + 1;
      setPage(next);
      fetchDraws(next, null, null, true);
    }
  };

  const openDraw = async (draw) => {
    setSelectedDraw(draw);
    setSelectedPrizes([]);
    setModalVisible(true);
    const { data } = await supabase
      .from('fourd_prizes')
      .select('*')
      .eq('draw_no', draw.draw_no);
    setSelectedPrizes(data || []);
  };

  const dateStr = (d) => new Date(d).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => openDraw(item)}>
      <View style={styles.rowLeft}>
        <Text style={styles.drawNo}>#{item.draw_no}</Text>
        <Text style={styles.drawDate}>{dateStr(item.draw_date)}</Text>
      </View>
      <View style={styles.rowRight}>
        {[item.prize_1st, item.prize_2nd, item.prize_3rd].map((n, i) => (
          <View key={i} style={[styles.numBadge, i === 0 && styles.numBadgeFirst]}>
            <Text style={[styles.numText, i === 0 && styles.numTextFirst]}>{n}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={DARK} />
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.filterBar} onPress={() => setPickerVisible(true)}>
        <Text style={styles.filterLabel}>📅 {filterMonth !== null ? `${MONTHS[filterMonth]} ${filterYear}` : 'Filter by month'}</Text>
        {filterMonth !== null && (
          <TouchableOpacity onPress={() => { setFilterMonth(null); setFilterYear(null); }}>
            <Text style={styles.filterClear}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      <FlatList
        data={draws}
        keyExtractor={item => String(item.draw_no)}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={DARK} /> : null}
      />

      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd
          unitId={BANNER_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <MonthYearPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(m, y) => { console.log('onSelect called:', m, y); setFilterMonth(m); setFilterYear(y); }}
      />

      <DrawModal
        draw={selectedDraw}
        prizes={selectedPrizes}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
  filterLabel: { fontSize: 13, color: DARK, fontWeight: '500' },
  filterClear: { fontSize: 16, color: '#999', paddingHorizontal: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  rowLeft: { width: 110 },
  drawNo: { fontSize: 13, fontWeight: '600', color: DARK },
  drawDate: { fontSize: 11, color: '#999', marginTop: 2 },
  rowRight: { flex: 1, flexDirection: 'row', gap: 6 },
  numBadge: { backgroundColor: '#f0f0f0', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  numBadgeFirst: { backgroundColor: DARK },
  numText: { fontSize: 13, fontWeight: '600', color: '#333', letterSpacing: 1 },
  numTextFirst: { color: '#fff' },
  chevron: { color: '#ccc', fontSize: 20, marginLeft: 8 },
  bannerContainer: { alignItems: 'center', paddingTop: 6, borderTopWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, borderBottomWidth: 0.5, borderColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: DARK },
  modalDate: { fontSize: 12, color: '#999', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: '#555', fontWeight: '600' },
  modalBody: { padding: 16 },
  topPrizesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  prizeBox: { flex: 1, alignItems: 'center', backgroundColor: '#f7f7f7', borderRadius: 10, padding: 12, marginHorizontal: 4 },
  prizeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  prizeNumber: { color: DARK, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  gridRow: { flexDirection: 'row', marginBottom: 8 },
  gridCell: { flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 3, borderRadius: 6 },
  gridNumber: { fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  closeBottomBtn: { margin: 16, backgroundColor: DARK, borderRadius: 10, padding: 14, alignItems: 'center' },
  closeBottomText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
