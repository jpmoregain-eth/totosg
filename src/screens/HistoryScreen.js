import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';

const DARK = '#1a1a2e';
const ORANGE = '#FF6B35';
const PAGE_SIZE = 20;

export default function HistoryScreen() {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchDraws = async (pageNum = 0, searchVal = '', append = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    let query = supabase
      .from('toto_draws')
      .select('*')
      .order('draw_no', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (searchVal.trim()) {
      const val = searchVal.trim();
      if (/^\d+$/.test(val) && val.length <= 4) {
        query = supabase
          .from('toto_draws')
          .select('*')
          .eq('draw_no', parseInt(val))
          .order('draw_no', { ascending: false });
      } else {
        query = supabase
          .from('toto_draws')
          .select('*')
          .ilike('draw_date', `%${val}%`)
          .order('draw_no', { ascending: false })
          .range(0, PAGE_SIZE - 1);
      }
    }

    const { data } = await query;
    if (data) {
      setDraws(append ? prev => [...prev, ...data] : data);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    setPage(0);
    fetchDraws(0, search, false);
  }, [search]);

  const loadMore = () => {
    if (!loadingMore && hasMore && !search.trim()) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchDraws(nextPage, '', true);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-SG', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const renderItem = ({ item }) => {
    const nums = [item.n1, item.n2, item.n3, item.n4, item.n5, item.n6];
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowDate}>{formatDate(item.draw_date)}</Text>
          <Text style={styles.rowDraw}>Draw #{item.draw_no}</Text>
        </View>
        <View style={styles.numsRow}>
          {nums.map((n, i) => (
            <View key={i} style={styles.miniBall}>
              <Text style={styles.miniBallText}>{n}</Text>
            </View>
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
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by date or draw no."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DARK} />
        </View>
      ) : (
        <FlatList
          data={draws}
          keyExtractor={(item) => item.draw_no.toString()}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={DARK} /> : null}
          ListEmptyComponent={<Text style={styles.empty}>No draws found.</Text>}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { padding: 12, borderBottomWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
  searchInput: { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 13, color: '#222' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  rowLeft: { flex: 1 },
  rowDate: { fontSize: 12, color: '#555' },
  rowDraw: { fontSize: 11, color: '#999', marginTop: 2 },
  numsRow: { flexDirection: 'row', gap: 3 },
  miniBall: { width: 24, height: 24, borderRadius: 12, backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' },
  miniBallAdd: { backgroundColor: ORANGE },
  miniBallText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 14 },
});
