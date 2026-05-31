import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InterstitialAd, AdEventType, TestIds, BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useLang } from '../lib/LangContext';
import { tr } from '../lib/i18n';

const DARK = '#1a1a2e';
const ORANGE = '#FF6B35';
const RED = '#E24B4A';
const BLUE = '#185FA5';
const PURPLE = '#534AB7';

const AD_UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-6984775309510247/5548935293';
const BANNER_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-6984775309510247/2111888204';

const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID, { requestNonPersonalizedAdsOnly: true });

const STRATEGIES = ['Frequency', 'Markov Chain', 'Mean Reversion', 'LSTM', 'Wheeling', 'Sum Range', 'Odd/Even Balance', 'Positional Bias'];
const TEMPS = ['Hottest', 'Coldest', 'Balanced'];
const WINDOWS = [25, 50, 100, 200];
const STRATEGY_ZH = {
  'Frequency': '频率', 'Markov Chain': '马尔可夫链', 'Mean Reversion': '均值回归',
  'LSTM': 'LSTM', 'Wheeling': '轮盘', 'Sum Range': '总和范围',
  'Odd/Even Balance': '奇偶平衡', 'Positional Bias': '位置偏好',
};
const TEMP_ZH = { 'Hottest': '最热', 'Coldest': '最冷', 'Balanced': '平衡' };

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function pickNumbers(draws, temp, count = 6) {
  const freq = {};
  for (let i = 1; i <= 49; i++) freq[i] = 0;
  draws.forEach(d => { [d.n1,d.n2,d.n3,d.n4,d.n5,d.n6,d.additional].forEach(n => { if (n) freq[n] = (freq[n]||0)+1; }); });
  const sorted = Object.entries(freq).sort((a,b) => { const diff = temp==='Coldest'?a[1]-b[1]:b[1]-a[1]; return diff!==0?diff:Math.random()-0.5; });
  if (temp==='Balanced') { const hot=sorted.slice(0,20).map(x=>parseInt(x[0])); const cold=sorted.slice(-20).map(x=>parseInt(x[0])); return shuffle([...hot,...cold]).slice(0,count).sort((a,b)=>a-b); }
  if (temp==='Coldest') { const appeared=sorted.filter(x=>x[1]>0); const pool=appeared.length>=count?appeared:sorted; return pool.slice(0,count).map(x=>parseInt(x[0])).sort((a,b)=>a-b); }
  return sorted.slice(0,count).map(x=>parseInt(x[0])).sort((a,b)=>a-b);
}

function pickAdditional(draws, mainNums, temp) {
  const freq = {};
  for (let i=1;i<=49;i++) freq[i]=0;
  draws.forEach(d=>{if(d.additional) freq[d.additional]++;});
  const candidates = Object.entries(freq).filter(([n])=>!mainNums.includes(parseInt(n))).filter(([,c])=>c>0)
    .sort((a,b)=>{const diff=temp==='Coldest'?a[1]-b[1]:b[1]-a[1];return diff!==0?diff:Math.random()-0.5;});
  const pool=candidates.length>0?candidates:Object.entries(freq).filter(([n])=>!mainNums.includes(parseInt(n))).sort(()=>Math.random()-0.5);
  if(temp==='Balanced') return parseInt(pool[Math.floor(pool.length/2)][0]);
  return parseInt(pool[0][0]);
}

function positionalBias(draws) {
  if(!draws||draws.length<10) return null;
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

function generateSet(draws, strategy, temp) {
  let nums = pickNumbers(draws, temp, 6);
  if(strategy==='Mean Reversion'){const recent=new Set();draws.slice(0,10).forEach(d=>[d.n1,d.n2,d.n3,d.n4,d.n5,d.n6].forEach(n=>recent.add(n)));const overdue=Array.from({length:49},(_,i)=>i+1).filter(n=>!recent.has(n));if(overdue.length>=6) nums=shuffle(overdue).slice(0,6).sort((a,b)=>a-b);}
  else if(strategy==='Sum Range'){let attempts=0;while(attempts<50){const c=pickNumbers(draws,temp,6);if(c.reduce((a,b)=>a+b,0)>=100&&c.reduce((a,b)=>a+b,0)<=180){nums=c;break;}attempts++;}}
  else if(strategy==='Odd/Even Balance'){let attempts=0;while(attempts<50){const c=shuffle(Array.from({length:49},(_,i)=>i+1)).slice(0,6).sort((a,b)=>a-b);if(c.filter(n=>n%2!==0).length===3){nums=c;break;}attempts++;}}
  else if(strategy==='Wheeling'){const pool=pickNumbers(draws,temp,10);nums=shuffle(pool).slice(0,6).sort((a,b)=>a-b);}
  else if(strategy==='Positional Bias'){const pb=positionalBias(draws);if(pb) nums=pb;}
  return { nums, additional: pickAdditional(draws, nums, temp) };
}

function getTempColor(temp) {
  if(temp==='Hottest') return RED;
  if(temp==='Coldest') return BLUE;
  return PURPLE;
}

export default function GeneratorScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const [allDraws, setAllDraws] = useState({});
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

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
    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, ()=>setAdLoaded(true));
    const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, ()=>{setAdLoaded(false);interstitial.load();doGenerate();});
    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, ()=>{setAdLoaded(false);doGenerate();});
    interstitial.load();
    return ()=>{unsubLoaded();unsubClosed();unsubError();};
  }, []);

  const doGenerate = () => {
    const newSets = Array.from({length:3},()=>{
      const strategy=pickRandom(STRATEGIES); const temp=pickRandom(TEMPS); const window=pickRandom(WINDOWS);
      const draws=allDraws[window]||[]; const {nums,additional}=generateSet(draws,strategy,temp);
      return {strategy,temp,window,nums,additional};
    });
    setSets(newSets); setGenerating(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const today=new Date().toDateString();
    const stored=await AsyncStorage.getItem('generate_count');
    const parsed=stored?JSON.parse(stored):{date:today,count:0};
    const count=parsed.date===today?parsed.count:0;
    await AsyncStorage.setItem('generate_count',JSON.stringify({date:today,count:count+1}));
    if(count<20&&adLoaded){interstitial.show();}else{setTimeout(()=>doGenerate(),300);}
  };

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={DARK}/></View>;

  const stratLabel = (s) => lang==='ZH'?(STRATEGY_ZH[s]||s):s;
  const tempLabel = (t) => lang==='ZH'?(TEMP_ZH[t]||t):t;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={{padding:16}}>
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
            <View style={styles.numsRow}>
              {set.nums.map((n,i)=>(<View key={i} style={[styles.ball,{backgroundColor:getTempColor(set.temp)}]}><Text style={styles.ballText}>{n}</Text></View>))}
            </View>
            <View style={styles.addRow}>
              <View style={[styles.ball,{backgroundColor:ORANGE}]}><Text style={styles.ballText}>{set.additional}</Text></View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.btn} onPress={handleGenerate} disabled={generating}>
          {generating?<ActivityIndicator color="#fff"/>:<Text style={styles.btnText}>{tr('generate',lang)}</Text>}
        </TouchableOpacity>
      </ScrollView>
      <View style={[styles.bannerContainer,{paddingBottom:insets.bottom}]}>
        <BannerAd unitId={BANNER_ID} size={BannerAdSize.BANNER} requestOptions={{requestNonPersonalizedAdsOnly:true}}/>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:{flex:1,backgroundColor:'#fff'}, container:{flex:1}, center:{flex:1,justifyContent:'center',alignItems:'center'},
  sectionLabel:{fontSize:14,fontWeight:'500',color:'#111',marginBottom:12},
  emptyState:{alignItems:'center',paddingVertical:40}, emptyText:{color:'#999',fontSize:13},
  card:{backgroundColor:'#f7f7f7',borderRadius:12,padding:12,marginBottom:12}, cardLabel:{fontSize:11,marginBottom:10},
  numsRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  ball:{width:40,height:40,borderRadius:20,justifyContent:'center',alignItems:'center'}, ballText:{color:'#fff',fontSize:13,fontWeight:'600'},
  addRow:{alignItems:'center'},
  btn:{backgroundColor:DARK,borderRadius:10,padding:14,alignItems:'center',marginTop:4,marginBottom:16}, btnText:{color:'#fff',fontSize:14,fontWeight:'500'},
  bannerContainer:{alignItems:'center',paddingTop:6,borderTopWidth:0.5,borderColor:'#eee',backgroundColor:'#fff'},
});
