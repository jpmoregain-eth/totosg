import React, { useState, useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, Dimensions,
} from 'react-native';

import SplashScreen from './SplashScreen';
import { LangProvider, useLang } from './src/lib/LangContext';
import { fetchGofConfig, GofConfig } from './src/lib/gofConfig';
import { requestNotificationPermission, getFCMToken, setupForegroundHandler } from './src/lib/notifications';
import GofModal from './src/components/GofModal';
import SifuModal from './src/components/SifuModal';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ResultsScreen from './src/screens/ResultsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import FourdResultsScreen from './src/screens/FourdResultsScreen';
import FourdHistoryScreen from './src/screens/FourdHistoryScreen';
import FourdLabScreen from './src/screens/FourdLabScreen';
import TotoLabScreen from './src/screens/TotoLabScreen';

// ── Design tokens ─────────────────────────────────────────────────────────────
const RED    = '#ED2939';
const PAPER  = '#FFFFFF';
const DARK   = '#1a1a2e';
const GOLD   = '#C9A84C';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BANNER_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-6984775309510247/2111888204';

// ── Bottom Tab Navigator ──────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

// ── Teaser Dialog ─────────────────────────────────────────────────────────────
function TeaserDialog({ visible, onClose, lang, config }: {
  visible: boolean; onClose: () => void; lang: string; config: GofConfig | null;
}) {
  const L = lang === 'ZH';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={td.overlay} activeOpacity={1} onPress={onClose}>
        <View style={td.dialog}>
          <Image source={config?.icon ?? require('./src/assets/GoF.png')} style={td.image} resizeMode="contain" />
          <Text style={td.title}>财神到！🧧</Text>
          <Text style={td.msg}>{L ? (config?.teaserZH || '') : (config?.teaserEN || '')}</Text>
          <TouchableOpacity style={td.btn} onPress={onClose}>
            <Text style={td.btnText}>{L ? '发财！🧧 关闭' : '发财！🧧 Close'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function MainApp() {
  const { lang, setLang } = useLang();
  const ZH = lang === 'ZH';
  const insets = useSafeAreaInsets();

  const [game, setGame]           = useState<'4D' | 'TOTO'>('4D');
  const [gofConfig, setGofConfig] = useState<GofConfig | null>(null);
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [gofVisible, setGofVisible]       = useState(false);
  const [sifuVisible, setSifuVisible]     = useState(false);
  const [sifuUnlocked, setSifuUnlocked]   = useState(false);
  const [gofUnlocked, setGofUnlocked]     = useState(false);

  useEffect(() => {
    fetchGofConfig().then(setGofConfig).catch(() => {});

    // Firebase notifications
    requestNotificationPermission().then(granted => {
      if (granted) getFCMToken();
    });
    const unsubForeground = setupForegroundHandler();
    return () => unsubForeground();
  }, []);

  const handleGofPress = () => {
    if (gofConfig?.featureActive) setGofVisible(true);
    else setTeaserVisible(true);
  };

  // ── Screen components per game/tab ─────────────────────────────────────────
  const DrawScreen  = game === '4D' ? FourdResultsScreen : ResultsScreen;
  const ArchiveScreen = game === '4D' ? FourdHistoryScreen : HistoryScreen;
  const LabScreen   = game === '4D' ? FourdLabScreen : TotoLabScreen;

  return (
    <View style={{ flex: 1, backgroundColor: RED }}>
      <SafeAreaView style={s.safeArea} edges={['top']}>

        {/* ── Red header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>SG LOTTERY</Text>
            <Text style={s.headerSub}>NOTICE BOARD · SINGAPORE POOLS</Text>
          </View>
          <View style={s.headerRight}>
            {/* EN/中 toggle */}
            <View style={s.langToggle}>
              <TouchableOpacity onPress={() => setLang('EN')} style={[s.langBtn, lang === 'EN' && s.langBtnActive]}>
                <Text style={[s.langText, lang === 'EN' && s.langTextActive]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLang('ZH')} style={[s.langBtn, lang === 'ZH' && s.langBtnActive]}>
                <Text style={[s.langText, lang === 'ZH' && s.langTextActive]}>中</Text>
              </TouchableOpacity>
            </View>
            {/* 財 GoF button — white bg, red text, rotated */}
            <TouchableOpacity style={s.featureBtnCai} onPress={handleGofPress} activeOpacity={0.8}>
              <Text style={s.featureBtnCharCai}>财</Text>
              <Text style={s.featureBtnLabelCai}>CAISHEN</Text>
            </TouchableOpacity>
            {/* 師 Sifu button — outline only, white text, straight */}
            <TouchableOpacity style={s.featureBtnSifu} onPress={() => setSifuVisible(true)} activeOpacity={0.8}>
              <Text style={s.featureBtnCharSifu}>师</Text>
              <Text style={s.featureBtnLabelSifu}>SIFU</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 4D / TOTO game switcher ── */}
        <View style={s.gameSwitcher}>
          <TouchableOpacity
            style={[s.gameBtn, game === '4D' && s.gameBtnActive]}
            onPress={() => setGame('4D')}
          >
            <Text style={[s.gameBtnText, game === '4D' && s.gameBtnTextActive]}>4D</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.gameBtn, game === 'TOTO' && s.gameBtnActive]}
            onPress={() => setGame('TOTO')}
          >
            <Text style={[s.gameBtnText, game === 'TOTO' && s.gameBtnTextActive]}>TOTO</Text>
          </TouchableOpacity>
        </View>

        {/* ── Content + Bottom tabs ── */}
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: s.tabBar,
              tabBarActiveTintColor: PAPER,
              tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
              tabBarLabelStyle: s.tabLabel,
              tabBarItemStyle: s.tabItem,
              tabBarIcon: () => null,
              tabBarIconStyle: { display: 'none' },
              tabBarHideOnKeyboard: true,
            }}
            safeAreaInsets={{ bottom: 0 }}
          >
            <Tab.Screen
              name="Draw"
              component={DrawScreen}
              options={{ tabBarLabel: ZH ? '开彩' : 'DRAW' }}
            />
            <Tab.Screen
              name="Archive"
              component={ArchiveScreen}
              options={{ tabBarLabel: ZH ? '记录' : 'ARCHIVE' }}
            />
            <Tab.Screen
              name="Lab"
              component={LabScreen}
              options={{ tabBarLabel: 'LAB' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
        {/* ── Banner ad — sits above bottom tab bar ── */}
        <View style={[s.bannerContainer, { paddingBottom: insets.bottom }]}>
          <BannerAd
            unitId={BANNER_ID}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>

      </SafeAreaView>

      {/* ── Modals ── */}
      <TeaserDialog
        visible={teaserVisible}
        onClose={() => setTeaserVisible(false)}
        lang={lang}
        config={gofConfig}
      />
      {gofConfig?.featureActive && (
        <GofModal
          visible={gofVisible}
          onClose={() => setGofVisible(false)}
          fabX={SCREEN_W - 60}
          fabY={80}
          fabSize={48}
          lang={lang as 'EN' | 'ZH'}
          config={gofConfig}
          gofUnlocked={gofUnlocked}
          onUnlock={() => setGofUnlocked(true)}
        />
      )}
      <SifuModal
        visible={sifuVisible}
        onClose={() => setSifuVisible(false)}
        lang={lang as 'EN' | 'ZH'}
        sifuUnlocked={sifuUnlocked}
        onUnlock={() => setSifuUnlocked(true)}
      />
    </View>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  if (!splashDone) {
    return (
      <SafeAreaProvider>
        <SplashScreen onDone={() => setSplashDone(true)} />
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <LangProvider>
        <MainApp />
      </LangProvider>
    </SafeAreaProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: RED },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: RED },
  headerLeft:  {},
  headerTitle: { fontFamily: 'ArchivoNarrow-Bold', fontSize: 26, color: PAPER, letterSpacing: 0.5, lineHeight: 30 },
  headerSub:   { fontFamily: 'IBMPlexMono-Medium', fontSize: 9, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Lang toggle
  langToggle:    { flexDirection: 'column', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', marginRight: 4 },
  langBtn:       { paddingHorizontal: 8, paddingVertical: 3 },
  langBtnActive: { backgroundColor: PAPER },
  langText:      { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  langTextActive:{ color: RED },

  // 财 CaiShen button — white fill, red char, rotated
  featureBtnCai:      { backgroundColor: PAPER, paddingHorizontal: 7, paddingVertical: 4, alignItems: 'center', minWidth: 52, transform: [{ rotate: '-12deg' }] },
  featureBtnCharCai:  { fontFamily: 'ArchivoNarrow-Bold', fontSize: 22, color: RED, lineHeight: 26 },
  featureBtnLabelCai: { fontFamily: 'IBMPlexMono-Regular', fontSize: 7, color: RED, letterSpacing: 1 },

  // 师 Sifu button — outline only, white text, straight
  featureBtnSifu:      { borderWidth: 1.5, borderColor: PAPER, paddingHorizontal: 7, paddingVertical: 4, alignItems: 'center', minWidth: 52 },
  featureBtnCharSifu:  { fontFamily: 'ArchivoNarrow-Bold', fontSize: 22, color: PAPER, lineHeight: 26 },
  featureBtnLabelSifu: { fontFamily: 'IBMPlexMono-Regular', fontSize: 7, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },

  // Game switcher
  gameSwitcher:      { flexDirection: 'row', backgroundColor: RED },
  gameBtn:           { flex: 1, paddingVertical: 11, alignItems: 'center', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  gameBtnActive:     { backgroundColor: PAPER },
  gameBtnText:       { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  gameBtnTextActive: { color: RED },

  // Bottom tab bar
  tabBar:   { backgroundColor: RED, borderTopWidth: 0, height: 52 + 0, elevation: 0, shadowOpacity: 0 },
  tabLabel: { fontFamily: 'IBMPlexMono-SemiBold', fontSize: 10, letterSpacing: 2, marginBottom: 10, marginTop: 10 },
  tabItem:  { justifyContent: 'center', alignItems: 'center', height: 52 },

  // Banner
  bannerContainer: { alignItems: 'center', backgroundColor: PAPER, borderTopWidth: 0.5, borderColor: '#eee' },
});

// ── Teaser dialog styles ──────────────────────────────────────────────────────
const td = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog:  { backgroundColor: PAPER, borderRadius: 24, padding: 24, alignItems: 'center', width: '100%' },
  image:   { width: 120, height: 120, marginBottom: 12 },
  title:   { fontSize: 22, fontWeight: '700', color: DARK, marginBottom: 12 },
  msg:     { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn:     { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnText: { color: PAPER, fontSize: 15, fontWeight: '700' },
});
