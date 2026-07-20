import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds, BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../lib/LangContext';
import { tr } from '../lib/i18n';

const DARK = '#1a1a2e';
const RED = '#E24B4A';
const BLUE = '#185FA5';
const PURPLE = '#534AB7';

const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-6984775309510247/6047752765';
const BANNER_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-6984775309510247/2111888204';

const rewarded = RewardedAd.createForAdRequest(REWARDED_ID, { requestNonPersonalizedAdsOnly: true });

const STRATEGIES = ['Frequency', 'Mean Reversion', 'Positional Bias', 'Sum Range', 'Odd/Even', 'Cold Numbers'];
const TEMPS = ['Hottest', 'Coldest', 'Balanced'];
const WINDOWS = [25, 50, 100, 200];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function pad(n) { return String(Math.abs(Math.round(n))).padStart(4, '0').slice(0, 4); }

function generate4D(draws, strategy, temp) {
  const freq = {};
  draws.forEach(d => { [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => { if (n) freq[parseInt(n)] = (freq[parseInt(n)] || 0) + 1; }); });
  const sorted = Object.entries(freq).sort((a, b) => { const diff = temp === 'Coldest' ? a[1] - b[1] : b[1] - a[1]; return diff !== 0 ? diff : Math.random() - 0.5; });
  if (strategy === 'Positional Bias') {
    const positions = [[], [], [], []];
    draws.forEach(d => { [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => { if (n) { const s = String(n).padStart(4, '0'); s.split('').forEach((digit, i) => positions[i].push(parseInt(digit))); } }); });
    const results = [];
    for (let k = 0; k < 3; k++) {
      const digits = positions.map(pos => {
        if (pos.length === 0) return Math.floor(Math.random() * 10);
        const digitFreq = {};
        pos.forEach(d => { digitFreq[d] = (digitFreq[d] || 0) + 1; });
        const sortedDigits = Object.entries(digitFreq).sort((a, b) => b[1] - a[1] + (Math.random() - 0.5) * 0.1);
        return parseInt(sortedDigits[Math.floor(Math.random() * Math.min(4, sortedDigits.length))][0]);
      });
      results.push(digits.join('').padStart(4, '0'));
    }
    return results;
  }
  if (strategy === 'Mean Reversion') {
    const recent = new Set();
    draws.slice(0, 10).forEach(d => { [d.prize_1st, d.prize_2nd, d.prize_3rd].forEach(n => { if (n) recent.add(parseInt(n)); }); });
    const overdue = Object.keys(freq).map(n => parseInt(n)).filter(n => !recent.has(n));
    return shuffle(overdue).slice(0, 3).map(n => pad(n));
  }
  if (strategy === 'Sum Range') {
    const pool = sorted.slice(0, 200); let attempts = 0;
    while (attempts < 200) {
      const candidates = shuffle(pool).slice(0, 3).map(x => parseInt(x[0]));
      if (candidates.reduce((a, b) => a + b, 0) >= 3000 && candidates.reduce((a, b) => a + b, 0) <= 7000) return candidates.map(n => pad(n));
      attempts++;
    }
    return shuffle(pool).slice(0, 3).map(x => pad(parseInt(x[0])));
  }
  if (strategy === 'Odd/Even') {
    let attempts = 0;
    while (attempts < 200) {
      const candidates = shuffle(sorted.slice(0, 200)).slice(0, 3).map(x => parseInt(x[0]));
      if (candidates.filter(n => n % 2 !== 0).length === 1 || candidates.filter(n => n % 2 !== 0).length === 2) return candidates.map(n => pad(n));
      attempts++;
    }
    return shuffle(sorted.slice(0, 3)).map(x => pad(parseInt(x[0])));
  }
  const appeared = temp === 'Coldest' ? sorted.filter(x => x[1] > 0) : sorted;
  return shuffle(appeared.slice(0, 100)).slice(0, 3).map(x => pad(parseInt(x[0])));
}

function getTempColor(temp) {
  if (temp === 'Hottest') return RED; if (temp === 'Coldest') return BLUE; return PURPLE;
}

const STRATEGY_ZH = {
  'Frequency': '频率', 'Mean Reversion': '均值回归', 'Positional Bias': '位置偏好',
  'Sum Range': '总和范围', 'Odd/Even': '奇偶', 'Cold Numbers': '冷号码',
};
const TEMP_ZH = { 'Hottest': '最热', 'Coldest': '最冷', 'Balanced': '平衡' };

function SupportPrompt({ visible, onWatchAd, onSkip, lang }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.promptOverlay}>
        <View style={styles.promptBox}>
          <Text style={styles.promptEmoji}>🙏</Text>
          <Text style={styles.promptTitle}>{lang === 'ZH' ? '支持开发者！' : 'Support the Dev!'}</Text>
          <Text style={styles.promptMsg}>
            {lang === 'ZH'
              ? '喜欢这个应用吗？观看一则短广告来支持开发者并生成您的幸运号码！'
              : 'Enjoying the app? Watch a short ad to support the developer and generate your lucky numbers!'}
          </Text>
          <TouchableOpacity style={styles.promptWatchBtn} onPress={onWatchAd}>
            <Text style={styles.promptWatchText}>{lang === 'ZH' ? '观看广告 🙏' : 'Watch Ad 🙏'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.promptSkipBtn} onPress={onSkip}>
            <Text style={styles.promptSkipText}>{lang === 'ZH' ? '跳过' : 'Skip'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FourdGeneratorScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const [allDraws, setAllDraws] = useState({});
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const doGenerateRef = React.useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      const results = {};
      for (const w of WINDOWS) {
        const { data } = await supabase.from('fourd_draws').select('prize_1st,prize_2nd,prize_3rd').order('draw_date', { ascending: false }).limit(w);
        if (data) results[w] = data;
      }
      setAllDraws(results); setLoading(false);
    };
    fetchData();
    const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => setAdLoaded(true));
    const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {});
    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false); rewarded.load(); doGenerateRef.current();
    });
    const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      setAdLoaded(false); doGenerateRef.current();
    });
    rewarded.load();
    return () => { unsubLoaded(); unsubEarned(); unsubClosed(); unsubError(); };
  }, []);

  const doGenerate = React.useCallback(() => {
    const newSets = Array.from({ length: 5 }, () => {
      const strategy = pickRandom(STRATEGIES);
      const temp = pickRandom(TEMPS);
      const window = pickRandom(WINDOWS);
      const draws = allDraws[window] || [];
      const numbers = generate4D(draws, strategy, temp);
      return { strategy, temp, window, numbers };
    });
    setSets(newSets); setGenerating(false); setShowPrompt(false);
  }, [allDraws]);

  React.useEffect(() => { doGenerateRef.current = doGenerate; }, [doGenerate]);

  const handleGenerate = () => {
    setGenerating(true);
    setShowPrompt(true);
  };

  const handleWatchAd = () => {
    if (adLoaded) { rewarded.show(); } else { doGenerate(); }
  };

  const handleSkip = () => { doGenerate(); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={DARK} /></View>;

  const stratLabel = (s) => lang === 'ZH' ? (STRATEGY_ZH[s] || s) : s;
  const tempLabel = (t) => lang === 'ZH' ? (TEMP_ZH[t] || t) : t;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.sectionLabel}>{lang === 'ZH' ? '建议4D号码' : 'Suggested 4D numbers'}</Text>
        {sets.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{lang === 'ZH' ? '点击生成获取幸运4D号码' : 'Tap Generate to get your lucky 4D numbers'}</Text>
          </View>
        )}
        {sets.map((set, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.cardLabel}>
              <Text style={{ color: getTempColor(set.temp), fontWeight: '600' }}>{stratLabel(set.strategy)} · {tempLabel(set.temp)}</Text>
              <Text style={{ color: '#999' }}> · {lang === 'ZH' ? `最近${set.window}期` : `last ${set.window} draws`}</Text>
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
          {generating && !showPrompt ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{tr('generate', lang)}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
      </View>

      <SupportPrompt visible={showPrompt} onWatchAd={handleWatchAd} onSkip={handleSkip} lang={lang} />
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
  // Support prompt
  promptOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center',padding:32},
  promptBox:{backgroundColor:'#fff',borderRadius:20,padding:24,alignItems:'center',width:'100%'},
  promptEmoji:{fontSize:40,marginBottom:12},
  promptTitle:{fontSize:18,fontWeight:'700',color:DARK,marginBottom:8},
  promptMsg:{fontSize:14,color:'#555',textAlign:'center',lineHeight:22,marginBottom:24},
  promptWatchBtn:{backgroundColor:PURPLE,borderRadius:12,paddingVertical:14,paddingHorizontal:32,width:'100%',alignItems:'center',marginBottom:10},
  promptWatchText:{color:'#fff',fontSize:15,fontWeight:'700'},
  promptSkipBtn:{paddingVertical:10},
  promptSkipText:{color:'#999',fontSize:13},
});
