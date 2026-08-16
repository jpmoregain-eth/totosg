import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';

import { useLang } from '../lib/LangContext';
import { tr } from '../lib/i18n';

const DARK = '#1a1a2e';
const GOLD = '#C9A84C';


export default function FourdResultsScreen() {
  const { lang } = useLang();
  const [draw, setDraw] = useState(null);
  const [prizes, setPrizes] = useState({ starters: [], consolations: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      const starters = prizeData?.filter(p => p.category === 'starter').map(p => p.number) || [];
      const consolations = prizeData?.filter(p => p.category === 'consolation').map(p => p.number) || [];
      setPrizes({ starters, consolations });
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

  const dateStr = draw ? new Date(draw.draw_date).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }) : '';

  const renderGrid = (numbers, color) => {
    const rows = [];
    for (let i = 0; i < numbers.length; i += 4) {
      rows.push(numbers.slice(i, i + 4));
    }
    return rows.map((row, ri) => (
      <View key={ri} style={styles.gridRow}>
        {row.map((n, ci) => (
          <View key={ci} style={[styles.gridCell, { backgroundColor: color + '22' }]}>
            <Text style={[styles.gridNumber, { color }]}>{n}</Text>
          </View>
        ))}
      </View>
    ));
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{tr('drawNo', lang)} {draw?.draw_no} · {dateStr}</Text>
          </View>

          <View style={styles.topPrizesRow}>
            {[
              { label: tr('prize1st', lang), value: draw?.prize_1st, color: GOLD },
              { label: tr('prize2nd', lang), value: draw?.prize_2nd, color: '#C0C0C0' },
              { label: tr('prize3rd', lang), value: draw?.prize_3rd, color: '#CD7F32' },
            ].map((p) => (
              <View key={p.label} style={styles.prizeBox}>
                <Text style={[styles.prizeLabel, { color: p.color }]}>{p.label}</Text>
                <Text style={styles.prizeNumber}>{p.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('starter', lang)}</Text>
          {renderGrid(prizes.starters, '#185FA5')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('consolation', lang)}</Text>
          {renderGrid(prizes.consolations, '#534AB7')}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: DARK, padding: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 16 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c6ff7', marginRight: 6 },
  badgeText: { color: '#fff', fontSize: 12 },
  topPrizesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  prizeBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginHorizontal: 4 },
  prizeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  prizeNumber: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  section: { padding: 16, borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 10 },
  gridRow: { flexDirection: 'row', marginBottom: 8 },
  gridCell: { flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 3, backgroundColor: '#f7f7f7', borderRadius: 6 },
  gridNumber: { fontSize: 15, fontWeight: '600', color: '#222', letterSpacing: 1 },
});
