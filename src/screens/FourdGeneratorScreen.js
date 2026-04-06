import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { InterstitialAd, AdEventType, TestIds, BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DARK = '#1a1a2e';
const RED = '#E24B4A';
const BLUE = '#185FA5';
const PURPLE = '#534AB7';

const INTERSTITIAL_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-6984775309510247/5548935293';

const BANNER_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-6984775309510247/2111888204';

const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_ID, {
  requestNonPersonalizedAdsOnly: true,
});

const STRATEGIES = ['Frequency', 'Mean Reversion', 'Positional Bias', 'Sum Range', 'Odd/Even', 'Cold Numbers'];
const TEMPS = ['Hottest', 'Coldest', 'Balanced'];
const WINDOWS = [25, 50, 100, 200];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function pad(n) { return String(Math.abs(Math.round(n))).padStart(4, '0').slice(0, 4); }

function generate4D(draws, strategy, temp) {
  const freq = {};
  draws.forEach(d => {
    [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => {
      if (n) freq[parseInt(n)] = (freq[parseInt(n)] || 0) + 1;
    });
  });

  const sorted = Object.entries(freq).sort((a, b) => {
    const diff = temp === 'Coldest' ? a[1] - b[1] : b[1] - a[1];
    return diff !== 0 ? diff : Math.random() - 0.5;
  });

  if (strategy === 'Positional Bias') {
    const positions = [[], [], [], []];
    draws.forEach(d => {
      [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => {
        if (n) {
          const s = String(n).padStart(4, '0');
          s.split('').forEach((digit, i) => positions[i].push(parseInt(digit)));
        }
      });
    });

    const results = [];
    for (let k = 0; k < 3; k++) {
      const digits = positions.map(pos => {
        if (pos.length === 0) return Math.floor(Math.random() * 10);
        const digitFreq = {};
        pos.forEach(d => { digitFreq[d] = (digitFreq[d] || 0) + 1; });
        const sortedDigits = Object.entries(digitFreq)
          .sort((a, b) => b[1] - a[1] + (Math.random() - 0.5) * 0.1);
        const pick = Math.floor(Math.random() * Math.min(4, sortedDigits.length));
        return parseInt(sortedDigits[pick][0]);
      });
      results.push(digits.join('').padStart(4, '0'));
    }
    return results;
  }

  if (strategy === 'Mean Reversion') {
    const recent = new Set();
    draws.slice(0, 10).forEach(d => {
      [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => { if (n) recent.add(parseInt(n)); });
    });
    const overdue = Object.keys(freq).map(n => parseInt(n)).filter(n => !recent.has(n));
    return shuffle(overdue).slice(0, 3).map(n => pad(n));
  }

  if (strategy === 'Sum Range') {
    const pool = sorted.slice(0, 200);
    let attempts = 0;
    while (attempts < 200) {
      const candidates = shuffle(pool).slice(0, 3).map(x => parseInt(x[0]));
      const sum = candidates.reduce((a, b) => a + b, 0);
      if (sum >= 3000 && sum <= 7000) return candidates.map(n => pad(n));
      attempts++;
    }
  }

  if (strategy === 'Odd/Even') {
    let attempts = 0;
    while (attempts < 200) {
      const candidates = shuffle(sorted.slice(0, 200)).slice(0, 3).map(x => parseInt(x[0]));
      const odds = candidates.filter(n => n % 2 !== 0).length;
      if (odds === 1 || odds === 2) return candidates.map(n => pad(n));
      attempts++;
    }
  }

  // Frequency / Cold Numbers / fallback
  const appeared = temp === 'Coldest'
    ? sorted.filter(x => x[1] > 0)
    : sorted;
  const pool = appeared.slice(0, 100);
  return shuffle(pool).slice(0, 3).map(x => pad(parseInt(x[0])));
}

function getTempColor(temp) {
  if (temp === 'Hottest') return RED;
  if (temp === 'Coldest') return BLUE;
  return PURPLE;
}

export default function FourdGeneratorScreen() {
  const insets = useSafeAreaInsets();
  const [allDraws, setAllDraws] = useState({});
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const results = {};
      for (const w of WINDOWS) {
        const { data } = await supabase
          .from('fourd_draws')
          .select('prize_1st,prize_2nd,prize_3rd')
          .order('draw_date', { ascending: false })
          .limit(w);
        if (data) results[w] = data;
      }
      setAllDraws(results);
      setLoading(false);
    };
    fetchData();

    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => setAdLoaded(true));
    const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false);
      interstitial.load();
      doGenerate();
    });
    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      setAdLoaded(false);
      doGenerate();
    });
    interstitial.load();
    return () => { unsubLoaded(); unsubClosed(); unsubError(); };
  }, []);

  const doGenerate = () => {
    const newSets = Array.from({ length: 5 }, () => {
      const strategy = pickRandom(STRATEGIES);
      const temp = pickRandom(TEMPS);
      const window = pickRandom(WINDOWS);
      const draws = allDraws[window] || [];
      const numbers = generate4D(draws, strategy, temp);
      return { strategy, temp, window, numbers };
    });
    setSets(newSets);
    setGenerating(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const today = new Date().toDateString();
    const stored = await AsyncStorage.getItem('fourd_generate_count');
    const parsed = stored ? JSON.parse(stored) : { date: today, count: 0 };
    const count = parsed.date === today ? parsed.count : 0;
    await AsyncStorage.setItem('fourd_generate_count', JSON.stringify({ date: today, count: count + 1 }));
    if (count < 20 && adLoaded) {
      interstitial.show();
    } else {
      setTimeout(() => doGenerate(), 300);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={DARK} />
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.sectionLabel}>Suggested 4D numbers</Text>

        {sets.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Tap Generate to get your lucky 4D numbers</Text>
          </View>
        )}

        {sets.map((set, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.cardLabel}>
              <Text style={{ color: getTempColor(set.temp), fontWeight: '600' }}>
                {set.strategy} · {set.temp}
              </Text>
              <Text style={{ color: '#999' }}> · last {set.window} draws</Text>
            </Text>
            <View style={styles.numsRow}>
              {set.numbers.map((n, i) => (
                <View key={i} style={[styles.numBall, { backgroundColor: getTempColor(set.temp) }]}>
                  <Text style={styles.numText}>{n}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.btn} onPress={handleGenerate} disabled={generating}>
          {generating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Generate new sets</Text>
          }
        </TouchableOpacity>
      </ScrollView>

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
  sectionLabel: { fontSize: 14, fontWeight: '500', color: '#111', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#999', fontSize: 13 },
  card: { backgroundColor: '#f7f7f7', borderRadius: 12, padding: 12, marginBottom: 12 },
  cardLabel: { fontSize: 11, marginBottom: 10 },
  numsRow: { flexDirection: 'row', gap: 10 },
  numBall: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  numText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  btn: { backgroundColor: DARK, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 16 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  bannerContainer: { alignItems: 'center', paddingTop: 6, borderTopWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
});
