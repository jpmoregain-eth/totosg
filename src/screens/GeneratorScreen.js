import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds, BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useLang } from '../lib/LangContext';
import { tr } from '../lib/i18n';

const DARK = '#1a1a2e';
const RED = '#E24B4A';
const BLUE = '#185FA5';
const PURPLE = '#534AB7';
const GOLD = '#C9A84C';

const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-6984775309510247/6047752765';
const BANNER_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-6984775309510247/2111888204';

const rewarded = RewardedAd.createForAdRequest(REWARDED_ID, { requestNonPersonalizedAdsOnly: true });

const STRATEGIES = ['Frequency', 'Markov Chain', 'Mean Reversion', 'LSTM', 'Wheeling', 'Sum Range', 'Odd/Even Balance', 'Positional Bias'];
const TEMPS = ['Hottest', 'Coldest', 'Balanced'];
const WINDOWS = [25, 50, 100, 200];
const COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const STRATEGY_ZH = {
  'Frequency': '频率', 'Markov Chain': '马尔可夫链', 'Mean Reversion': '均值回归',
  'LSTM': 'LSTM', 'Wheeling': '轮盘', 'Sum Range': '总和范围',
  'Odd/Even Balance': '奇偶平衡', 'Positional Bias': '位置偏好',
};
const TEMP_ZH = { 'Hottest': '最热', 'Coldest': '最冷', 'Balanced': '平衡' };

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function pickNumbers(draws, temp, count) {
  const freq = {};
  for (let i = 1; i <= 49; i++) freq[i] = 0;
  draws.forEach(d => { [d.n1,d.n2,d.n3,d.n4,d.n5,d.n6,d.additional].forEach(n => { if (n) freq[n] = (freq[n]||0)+1; }); });
  const sorted = Object.entries(freq).sort((a,b) => { const diff = temp==='Coldest'?a[1]-b[1]:b[1]-a[1]; return diff!==0?diff:Math.random()-0.5; });
  if (temp==='Balanced') { const hot=sorted.slice(0,20).map(x=>parseInt(x[0])); const cold=sorted.slice(-20).map(x=>parseInt(x[0])); return shuffle([...hot,...cold]).slice(0,count).sort((a,b)=>a-b); }
  if (temp==='Coldest') { const appeared=sorted.filter(x=>x[1]>0); const pool=appeared.length>=count?appeared:sorted; return pool.slice(0,count).map(x=>parseInt(x[0])).sort((a,b)=>a-b); }
  return sorted.slice(0,count).map(x=>parseInt(x[0])).sort((a,b)=>a-b);
}

function positionalBias(draws, count) {
  if (count !== 6 || !draws || draws.length < 10) return null;
  const positional=[[],[],[],[],[],[]];
  draws.forEach(d=>{[d.n1,d.n2,d.n3,d.n4,d.n5,d.n6].forEach((n,i)=>{const num=parseInt(n);if(num&&!isNaN(num)&&num>=1&&num<=49) positional[i].push(num);});});
  const picked=new Set(); const result=[];
  for(let i=0;i<6;i++){
    const pos=positional[i]; let chosen=null;
    if(pos.length>0){const freq={};pos.forEach(n=>{freq[n]=(freq[n]||0)+1;});const sorted=Object.entries(freq).sort((a,b)=>{const diff=b[1]-a[1];return diff!==0?diff:Math.random()-0.5;});for(const[n] of sorted){const num=parseInt(n);if(!picked.has(num)){chosen=num;break;}}}
    if(!chosen) chosen=Array.from({length:49},(_,j)=>j+1).find(n=>!picked.has(n));
    picked.add(chosen); result.push(chosen);
  }
  return result.sort((a,b)=>a-b);
}

function generateSet(draws, strategy, temp, count) {
  let nums = pickNumbers(draws, temp, count);
  if (strategy === 'Mean Reversion') {
    const recent = new Set();
    draws.slice(0, 10).forEach(d => [d.n1,d.n2,d.n3,d.n4,d.n5,d.n6].forEach(n => recent.add(n)));
    const overdue = Array.from({length:49},(_,i)=>i+1).filter(n => !recent.has(n));
    if (overdue.length >= count) nums = shuffle(overdue).slice(0, count).sort((a,b)=>a-b);
  } else if (strategy === 'Sum Range') {
    const lower = Math.round(count * 16.7); const upper = Math.round(count * 30);
    let attempts = 0;
    while (attempts < 50) { const c = pickNumbers(draws, temp, count); if (c.reduce((a,b)=>a+b,0) >= lower && c.reduce((a,b)=>a+b,0) <= upper) { nums = c; break; } attempts++; }
  } else if (strategy === 'Odd/Even Balance') {
    const targetOdd = Math.round(count / 2); let attempts = 0;
    while (attempts < 50) { const c = shuffle(Array.from({length:49},(_,i)=>i+1)).slice(0, count).sort((a,b)=>a-b); if (c.filter(n => n % 2 !== 0).length === targetOdd) { nums = c; break; } attempts++; }
  } else if (strategy === 'Wheeling') {
    const pool = pickNumbers(draws, temp, Math.min(49, count + 6));
    nums = shuffle(pool).slice(0, count).sort((a,b)=>a-b);
  } else if (strategy === 'Positional Bias') {
    const pb = positionalBias(draws, count); if (pb) nums = pb;
  }
  return { nums };
}

function getTempColor(temp) {
  if(temp==='Hottest') return RED; if(temp==='Coldest') return BLUE; return PURPLE;
}

function splitIntoRows(nums) {
  if (nums.length <= 7) return [nums];
  const firstRowCount = Math.ceil(nums.length / 2);
  return [nums.slice(0, firstRowCount), nums.slice(firstRowCount)];
}

function NumberCountSelector({ value, onChange, lang }) {
  return (
    <View style={styles.countSection}>
      <Text style={styles.countLabel}>{lang === 'ZH' ? '生成号码数量' : 'Numbers to generate'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countRow}>
        {COUNT_OPTIONS.map(n => (
          <TouchableOpacity key={n} style={[styles.countPill, value === n && styles.countPillActive]} onPress={() => onChange(n)}>
            <Text style={[styles.countPillText, value === n && styles.countPillTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

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

export default function GeneratorScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const [allDraws, setAllDraws] = useState({});
  const [sets, setSets] = useState([]);
  const [numCount, setNumCount] = useState(6);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const doGenerateRef = React.useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      const results = {};
      for (const w of WINDOWS) {
        const { data } = await supabase.from('toto_draws').select('n1,n2,n3,n4,n5,n6,additional').order('draw_no',{ascending:false}).limit(w);
        if(data) results[w]=data;
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
    const newSets = Array.from({length:3},()=>{
      const strategy=pickRandom(STRATEGIES); const temp=pickRandom(TEMPS); const window=pickRandom(WINDOWS);
      const draws=allDraws[window]||[]; const {nums}=generateSet(draws,strategy,temp,numCount);
      return {strategy,temp,window,nums};
    });
    setSets(newSets); setGenerating(false); setShowPrompt(false);
  }, [allDraws, numCount]);

  React.useEffect(() => { doGenerateRef.current = doGenerate; }, [doGenerate]);

  const handleGenerate = () => {
    setGenerating(true);
    setShowPrompt(true);
  };

  const handleWatchAd = () => {
    if (adLoaded) {
      rewarded.show();
    } else {
      doGenerate();
    }
  };

  const handleSkip = () => {
    doGenerate();
  };

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={DARK}/></View>;

  const stratLabel = (s) => lang==='ZH'?(STRATEGY_ZH[s]||s):s;
  const tempLabel = (t) => lang==='ZH'?(TEMP_ZH[t]||t):t;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={{padding:16}}>
        <NumberCountSelector value={numCount} onChange={(n) => { setNumCount(n); setSets([]); }} lang={lang} />
        <Text style={styles.sectionLabel}>{lang==='ZH'?'建议号码':'Suggested sets'}</Text>
        {sets.length===0&&(
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{lang==='ZH'?'点击生成获取幸运号码':'Tap Generate to get your lucky numbers'}</Text>
          </View>
        )}
        {sets.map((set,idx)=>(
          <View key={idx} style={styles.card}>
            <Text style={styles.cardLabel}>
              <Text style={{color:getTempColor(set.temp),fontWeight:'600'}}>{stratLabel(set.strategy)} · {tempLabel(set.temp)}</Text>
              <Text style={{color:'#999'}}> · {lang==='ZH'?`最近${set.window}期`:`last ${set.window} draws`}</Text>
            </Text>
            <View style={styles.numsContainer}>
              {splitIntoRows(set.nums).map((row, ri) => (
                <View key={ri} style={styles.numsRow}>
                  {row.map((n,i)=>(<View key={i} style={[styles.ball,{backgroundColor:getTempColor(set.temp)}]}><Text style={styles.ballText}>{n}</Text></View>))}
                </View>
              ))}
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.btn} onPress={handleGenerate} disabled={generating}>
          {generating && !showPrompt ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>{tr('generate',lang)}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.bannerContainer,{paddingBottom:insets.bottom}]}>
        <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{requestNonPersonalizedAdsOnly:true}}/>
      </View>

      <SupportPrompt visible={showPrompt} onWatchAd={handleWatchAd} onSkip={handleSkip} lang={lang} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:{flex:1,backgroundColor:'#fff'}, container:{flex:1}, center:{flex:1,justifyContent:'center',alignItems:'center'},
  countSection: { marginBottom: 18 },
  countLabel: { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 8 },
  countRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  countPill: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  countPillActive: { backgroundColor: GOLD },
  countPillText: { fontSize: 14, fontWeight: '600', color: '#666' },
  countPillTextActive: { color: '#fff' },
  sectionLabel:{fontSize:14,fontWeight:'500',color:'#111',marginBottom:12},
  emptyState:{alignItems:'center',paddingVertical:40}, emptyText:{color:'#999',fontSize:13},
  card:{backgroundColor:'#f7f7f7',borderRadius:12,padding:12,marginBottom:12}, cardLabel:{fontSize:11,marginBottom:10},
  numsContainer:{gap:8},
  numsRow:{flexDirection:'row',justifyContent:'center',gap:8},
  ball:{width:38,height:38,borderRadius:19,justifyContent:'center',alignItems:'center'}, ballText:{color:'#fff',fontSize:13,fontWeight:'600'},
  btn:{backgroundColor:DARK,borderRadius:10,padding:14,alignItems:'center',marginTop:4,marginBottom:16}, btnText:{color:'#fff',fontSize:14,fontWeight:'500'},
  bannerContainer:{alignItems:'center',paddingTop:6,borderTopWidth:0.5,borderColor:'#eee',backgroundColor:'#fff'},
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
