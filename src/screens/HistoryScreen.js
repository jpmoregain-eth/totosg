import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';

import { useLang } from '../lib/LangContext';
import { tr } from '../lib/i18n';

const DARK = '#1a1a2e';
const ORANGE = '#FF6B35';
const PAGE_SIZE = 20;


const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const START_YEAR = 1997;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);

function MonthYearPicker({ visible, onClose, onSelect, lang }) {
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const MONTHS = lang === 'ZH' ? MONTHS_ZH : MONTHS_EN;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>{lang === 'ZH' ? '选择月份与年份' : 'Select Month & Year'}</Text>
          <View style={styles.pickerColumns}>
            <ScrollView style={styles.pickerCol} showsVerticalScrollIndicator={false}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity key={m} style={[styles.pickerItem, selMonth === i && styles.pickerItemActive]} onPress={() => setSelMonth(i)}>
                  <Text style={[styles.pickerItemText, selMonth === i && styles.pickerItemTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={styles.pickerCol} showsVerticalScrollIndicator={false}>
              {YEARS.map(y => (
                <TouchableOpacity key={y} style={[styles.pickerItem, selYear === y && styles.pickerItemActive]} onPress={() => setSelYear(y)}>
                  <Text style={[styles.pickerItemText, selYear === y && styles.pickerItemTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => { onSelect(selMonth, selYear); onClose(); }}>
            <Text style={styles.pickerBtnText}>{lang === 'ZH' ? '显示成绩' : 'Show Results'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerClear} onPress={() => { onSelect(null, null); onClose(); }}>
            <Text style={styles.pickerClearText}>{lang === 'ZH' ? '清除筛选' : 'Clear filter'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function HistoryScreen() {
  const { lang } = useLang();
  const MONTHS = lang === 'ZH' ? MONTHS_ZH : MONTHS_EN;
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterMonth, setFilterMonth] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const fetchDraws = async (pageNum = 0, month = filterMonth, year = filterYear, append = false) => {
    if (pageNum === 0) setLoading(true); else setLoadingMore(true);
    let query = supabase.from('toto_draws').select('*').order('draw_no', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
    if (month !== null && year !== null) {
      const monthStr = String(month + 1).padStart(2, '0');
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const nextMonthStr = String(nextMonth).padStart(2, '0');
      query = supabase.from('toto_draws').select('*')
        .gte('draw_date', `${year}-${monthStr}-01`).lt('draw_date', `${nextYear}-${nextMonthStr}-01`)
        .order('draw_no', { ascending: false });
    }
    const { data } = await query;
    if (data) {
      setDraws(append ? prev => [...prev, ...data] : data);
      setHasMore(data.length === PAGE_SIZE && month === null);
    }
    setLoading(false); setLoadingMore(false);
  };

  useEffect(() => { setPage(0); fetchDraws(0, filterMonth, filterYear, false); }, [filterMonth, filterYear]);

  const loadMore = () => {
    if (!loadingMore && hasMore && filterMonth === null) {
      const next = page + 1; setPage(next); fetchDraws(next, null, null, true);
    }
  };

  const filterLabel = filterMonth !== null && filterYear !== null
    ? `${MONTHS[filterMonth]} ${filterYear}`
    : (lang === 'ZH' ? '按月筛选' : 'Filter by month');

  const renderItem = ({ item }) => {
    const nums = [item.n1, item.n2, item.n3, item.n4, item.n5, item.n6];
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowDate}>{new Date(item.draw_date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          <Text style={styles.rowDraw}>{tr('drawNo', lang)} {item.draw_no}</Text>
        </View>
        <View style={styles.numsRow}>
          {nums.map((n, i) => (
            <View key={i} style={styles.miniBall}><Text style={styles.miniBallText}>{n}</Text></View>
          ))}
          <View style={[styles.miniBall, styles.miniBallAdd]}>
            <Text style={styles.miniBallText}>{item.additional}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.filterBar} onPress={() => setPickerVisible(true)}>
        <Text style={styles.filterLabel}>📅 {filterLabel}</Text>
        {filterMonth !== null && (
          <TouchableOpacity onPress={() => { setFilterMonth(null); setFilterYear(null); }}>
            <Text style={styles.filterClear}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={DARK} /></View>
      ) : (
        <FlatList
          data={draws}
          keyExtractor={(item) => item.draw_no.toString()}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={DARK} /> : null}
          ListEmptyComponent={<Text style={styles.empty}>{tr('noResults', lang)}</Text>}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      )}
      <MonthYearPicker visible={pickerVisible} onClose={() => setPickerVisible(false)}
        onSelect={(m, y) => { setFilterMonth(m); setFilterYear(y); }} lang={lang} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
  filterLabel: { fontSize: 13, color: DARK, fontWeight: '500' },
  filterClear: { fontSize: 16, color: '#999', paddingHorizontal: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  rowLeft: { flex: 1 },
  rowDate: { fontSize: 12, color: '#555' },
  rowDraw: { fontSize: 11, color: '#999', marginTop: 2 },
  numsRow: { flexDirection: 'row', gap: 3 },
  miniBall: { width: 24, height: 24, borderRadius: 12, backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' },
  miniBallAdd: { backgroundColor: ORANGE },
  miniBallText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 14 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', maxHeight: '70%' },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: DARK, textAlign: 'center', marginBottom: 16 },
  pickerColumns: { flexDirection: 'row', height: 200 },
  pickerCol: { flex: 1 },
  pickerItem: { paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginVertical: 2 },
  pickerItemActive: { backgroundColor: DARK },
  pickerItemText: { fontSize: 14, color: '#555' },
  pickerItemTextActive: { color: '#fff', fontWeight: '600' },
  pickerBtn: { backgroundColor: DARK, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16 },
  pickerBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  pickerClear: { alignItems: 'center', marginTop: 10 },
  pickerClearText: { color: '#999', fontSize: 13 },
});
