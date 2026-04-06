import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK = '#1a1a2e';
const ORANGE = '#FF6B35';

const BANNER_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-6984775309510247/2111888204';

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const [draw, setDraw] = useState(null);
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchLatest(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchLatest(); };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={DARK} />
    </View>
  );

  const nums = draw ? [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6] : [];
  const dateStr = draw ? new Date(draw.draw_date).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }) : '';

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Draw #{draw?.draw_no} · {dateStr}</Text>
          </View>

          <Text style={styles.sectionLabel}>Winning numbers</Text>
          <View style={styles.numbersRow}>
            {nums.map((n, i) => (
              <View key={i} style={styles.ball}>
                <Text style={styles.ballText}>{n}</Text>
              </View>
            ))}
          </View>
          <View style={styles.addRow}>
            <View style={[styles.ball, styles.ballAdd]}>
              <Text style={styles.ballText}>{draw?.additional}</Text>
            </View>
          </View>

          <Text style={styles.jackpot}>
            ${draw?.group1_prize ? Number(draw.group1_prize).toLocaleString() : 'N/A'}
          </Text>
          <Text style={styles.jackpotLabel}>Group 1 jackpot</Text>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHead, { flex: 1.2 }]}>Group</Text>
            <Text style={[styles.tableHead, { flex: 1, textAlign: 'center' }]}>Winners</Text>
            <Text style={[styles.tableHead, { flex: 1.5, textAlign: 'right' }]}>Prize</Text>
          </View>
          {prizes.map((p) => (
            <View key={p.prize_group} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>Group {p.prize_group}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                {p.winning_shares > 0 ? p.winning_shares.toLocaleString() : '-'}
              </Text>
              <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right', fontWeight: '500' }]}>
                {p.share_amount ? '$' + Number(p.share_amount).toLocaleString() : '-'}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky Banner */}
      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd
          unitId={BANNER_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: DARK, padding: 20, paddingTop: 40 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 16 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c6ff7', marginRight: 6 },
  badgeText: { color: '#fff', fontSize: 12 },
  sectionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 10 },
  numbersRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ball: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  ballAdd: { backgroundColor: ORANGE },
  ballText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  addRow: { alignItems: 'center', marginBottom: 20 },
  jackpot: { color: '#fff', fontSize: 28, fontWeight: '600' },
  jackpotLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },
  tableContainer: { padding: 16 },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 0.5, borderColor: '#ddd', marginBottom: 4 },
  tableHead: { fontSize: 11, color: '#999', fontWeight: '500' },
  tableRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  tableCell: { fontSize: 13, color: '#222' },
  bannerContainer: { alignItems: 'center', paddingTop: 6, borderTopWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
});
