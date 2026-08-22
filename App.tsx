import React, { useState, useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Modal, Dimensions,
} from 'react-native';

import SplashScreen from './SplashScreen';
import { LangProvider, useLang } from './src/lib/LangContext';
import { tr } from './src/lib/i18n';
import { fetchGofConfig, GofConfig } from './src/lib/gofConfig';
import GofModal from './src/components/GofModal';
import SifuModal from './src/components/SifuModal';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResultsScreen from './src/screens/ResultsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GeneratorScreen from './src/screens/GeneratorScreen';
import FourdResultsScreen from './src/screens/FourdResultsScreen';
import FourdHistoryScreen from './src/screens/FourdHistoryScreen';
import FourdGeneratorScreen from './src/screens/FourdGeneratorScreen';
import WhatIfScreen from './src/screens/WhatIfScreen';

const Tab = createMaterialTopTabNavigator();
const DARK   = '#1a1a2e';
const PURPLE = '#7c6ff7';
const GOLD   = '#C9A84C';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Sidebar constants
const SIDEBAR_W    = 80;   // width of expanded sidebar (icon + label)
const HAMBURGER_W  = 20;   // width of collapsed hamburger tab
const AUTO_DISMISS = 3000; // ms before sidebar auto-collapses

// ── Teaser Dialog (shown when gof_feature_active = false) ────────────────────
function TeaserDialog({ visible, onClose, lang, config }: {
  visible: boolean; onClose: () => void; lang: string; config: GofConfig | null;
}) {
  const L = lang === 'ZH';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={gofStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={gofStyles.dialog}>
          <Image source={config?.icon ?? require('./src/assets/GoF.png')} style={gofStyles.dialogImage} resizeMode="contain" />
          <Text style={gofStyles.dialogTitle}>财神到！🧧</Text>
          <Text style={gofStyles.dialogMsg}>
            {L ? (config?.teaserZH || '') : (config?.teaserEN || '')}
          </Text>
          <TouchableOpacity style={gofStyles.closeBtn} onPress={onClose}>
            <Text style={gofStyles.closeBtnText}>{L ? '发财！🧧 关闭' : '发财！🧧 Close'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Feature Sidebar (GoF + Sifu) ──────────────────────────────────────────────
function FeatureSidebar({ lang, config }: { lang: 'EN' | 'ZH'; config: GofConfig | null }) {
  const [expanded, setExpanded]           = useState(true);  // starts open on launch
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [gofVisible, setGofVisible]       = useState(false);
  const [sifuVisible, setSifuVisible]     = useState(false);
  const [sifuUnlocked, setSifuUnlocked]   = useState(false); // in-memory only, resets on app close
  const slideAnim = useRef(new Animated.Value(0)).current;  // 0 = expanded, 1 = collapsed
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulse animation for hamburger tab
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.6, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  // Slide value: 0 = fully open, SIDEBAR_W - HAMBURGER_W = fully collapsed
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SIDEBAR_W - HAMBURGER_W],
  });

  const expand = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setExpanded(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    dismissTimer.current = setTimeout(collapse, AUTO_DISMISS);
  };

  const collapse = () => {
    setExpanded(false);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
  };

  // Auto-expand on mount, then auto-collapse after 3s
  useEffect(() => {
    dismissTimer.current = setTimeout(collapse, AUTO_DISMISS);
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, []);

  const handleGofPress = () => {
    if (config?.featureActive) setGofVisible(true);
    else setTeaserVisible(true);
  };

  const handleSifuPress = () => {
    setSifuVisible(true);
  };

  const iconSource = config?.icon ?? require('./src/assets/GoF.png');

  return (
    <>
      <Animated.View style={[sidebarStyles.container, { transform: [{ translateX }] }]}>

        {/* Hamburger tab — always visible on left edge, pulses to draw attention */}
        <TouchableOpacity onPress={expanded ? collapse : expand} activeOpacity={0.7}>
          <Animated.View style={[sidebarStyles.hamburger, { opacity: pulseAnim }]}>
            <View style={sidebarStyles.hamburgerLine} />
            <View style={sidebarStyles.hamburgerLine} />
            <View style={sidebarStyles.hamburgerLine} />
          </Animated.View>
        </TouchableOpacity>

        {/* Icon buttons */}
        <View style={sidebarStyles.iconsContainer}>

          {/* GoF button — always default GoF.png in sidebar; seasonal icon lives inside the modal */}
          <TouchableOpacity style={sidebarStyles.iconBtn} onPress={handleGofPress} activeOpacity={0.8}>
            <Image source={require('./src/assets/GoF.png')} style={sidebarStyles.iconImage} resizeMode="contain" />
            <Text style={sidebarStyles.iconLabel} numberOfLines={1}>财神</Text>
          </TouchableOpacity>

          {/* Sifu button — label always in Chinese */}
          <TouchableOpacity style={sidebarStyles.iconBtn} onPress={handleSifuPress} activeOpacity={0.8}>
            <Image source={require('./src/assets/sifu.png')} style={sidebarStyles.iconImage} resizeMode="contain" />
            <Text style={sidebarStyles.iconLabel} numberOfLines={1}>师父</Text>
          </TouchableOpacity>

        </View>
      </Animated.View>

      {/* Teaser dialog (GoF not yet active) */}
      <TeaserDialog
        visible={teaserVisible}
        onClose={() => setTeaserVisible(false)}
        lang={lang}
        config={config}
      />

      {/* GoF Modal */}
      {config?.featureActive && (
        <GofModal
          visible={gofVisible}
          onClose={() => setGofVisible(false)}
          fabX={SCREEN_W - SIDEBAR_W - 10}
          fabY={SCREEN_H / 2 - 60}
          fabSize={56}
          lang={lang}
          config={config}
        />
      )}

      {/* Sifu Modal */}
      <SifuModal
        visible={sifuVisible}
        onClose={() => setSifuVisible(false)}
        lang={lang}
        sifuUnlocked={sifuUnlocked}
        onUnlock={() => setSifuUnlocked(true)}
      />
    </>
  );
}

// ── Lang Toggle ───────────────────────────────────────────────────────────────
function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <View style={styles.langContainer}>
      <TouchableOpacity style={[styles.langBtn, lang === 'EN' && styles.langActive]} onPress={() => setLang('EN')}>
        <Text style={[styles.langText, lang === 'EN' && styles.langTextActive]}>EN</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.langBtn, lang === 'ZH' && styles.langActive]} onPress={() => setLang('ZH')}>
        <Text style={[styles.langText, lang === 'ZH' && styles.langTextActive]}>中</Text>
      </TouchableOpacity>
    </View>
  );
}

function GameSwitcher({ game, setGame }) {
  return (
    <View style={styles.switcherContainer}>
      <TouchableOpacity style={[styles.switcherBtn, game === '4D' && styles.switcherActive]} onPress={() => setGame('4D')}>
        <Text style={[styles.switcherText, game === '4D' && styles.switcherTextActive]}>4D</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.switcherBtn, game === 'TOTO' && styles.switcherActive]} onPress={() => setGame('TOTO')}>
        <Text style={[styles.switcherText, game === 'TOTO' && styles.switcherTextActive]}>TOTO</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
const BANNER_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-6984775309510247/2111888204';

function MainApp() {
  const [game, setGame]           = useState('4D');
  const [gofConfig, setGofConfig] = useState<GofConfig | null>(null);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchGofConfig().then(setGofConfig).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.appHeader}>
          <View style={styles.headerTop}>
            <View style={styles.titleRow}>
              <Image source={require('./src/assets/applogo.png')} style={styles.logo} resizeMode="contain" />
              <View>
                <Text style={styles.appTitle}>{tr('appTitle', lang)}</Text>
                <Text style={styles.appSubtitle}>{tr('appSubtitle', lang)}</Text>
              </View>
            </View>
            <LangToggle />
          </View>
          <View style={styles.switcherRow}>
            <GameSwitcher game={game} setGame={setGame} />
          </View>
        </View>

        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              tabBarStyle: { backgroundColor: DARK },
              tabBarActiveTintColor: PURPLE,
              tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
              tabBarIndicatorStyle: { backgroundColor: PURPLE, height: 2 },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '500', textTransform: 'none' },
              tabBarPressColor: 'rgba(255,255,255,0.1)',
              tabBarScrollEnabled: false,
            }}
          >
            {game === '4D' ? (
              <>
                <Tab.Screen name="Results"   component={FourdResultsScreen} options={{ tabBarLabel: tr('results', lang) }} />
                <Tab.Screen name="History"   component={FourdHistoryScreen} options={{ tabBarLabel: tr('history', lang) }} />
                <Tab.Screen name="Generator" component={FourdGeneratorScreen} options={{ tabBarLabel: tr('generator', lang) }} />
                <Tab.Screen name="WhatIf"    children={() => <WhatIfScreen game="4D" />} options={{ tabBarLabel: tr('whatIf', lang) }} />
              </>
            ) : (
              <>
                <Tab.Screen name="Results"   component={ResultsScreen} options={{ tabBarLabel: tr('results', lang) }} />
                <Tab.Screen name="History"   component={HistoryScreen} options={{ tabBarLabel: tr('history', lang) }} />
                <Tab.Screen name="Generator" component={GeneratorScreen} options={{ tabBarLabel: tr('generator', lang) }} />
                <Tab.Screen name="WhatIf"    children={() => <WhatIfScreen game="TOTO" />} options={{ tabBarLabel: tr('whatIf', lang) }} />
              </>
            )}
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaView>

      {/* Global Banner Ad — loads once on app start */}
      <View style={[styles.bannerContainer, { paddingBottom: insets.bottom }]}>
        <BannerAd
          unitId={BANNER_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      {/* Feature Sidebar — GoF + Sifu (replaces old draggable FAB) */}
      {gofConfig !== null && gofConfig.active && (
        <FeatureSidebar lang={lang as 'EN' | 'ZH'} config={gofConfig} />
      )}

      {/* OLD GoF FAB — retired in v2.5.0, kept here for reference
      {gofConfig !== null && gofConfig.active && (
        <GofFAB lang={lang as 'EN' | 'ZH'} config={gofConfig} />
      )} */}
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
const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: DARK },
  appHeader:     { backgroundColor: DARK, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  headerTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo:          { width: 40, height: 40, borderRadius: 8 },
  appTitle:      { color: '#fff', fontSize: 20, fontWeight: '600' },
  appSubtitle:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  switcherRow:   { marginTop: 10, alignItems: 'center' },
  langContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 3 },
  langBtn:       { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 13 },
  langActive:    { backgroundColor: PURPLE },
  langText:      { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  langTextActive:{ color: '#fff' },
  switcherContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 3 },
  switcherBtn:        { paddingHorizontal: 24, paddingVertical: 5, borderRadius: 17 },
  switcherActive:     { backgroundColor: GOLD },
  switcherText:       { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  switcherTextActive: { color: '#fff' },
  bannerContainer:    { alignItems: 'center', backgroundColor: '#fff', borderTopWidth: 0.5, borderColor: '#eee' },
});

const sidebarStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: SCREEN_H / 2 - 100,   // vertically centred
    width: SIDEBAR_W,
    flexDirection: 'row',
    zIndex: 999,
  },
  hamburger: {
    width: HAMBURGER_W,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
    backgroundColor: GOLD,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  hamburgerLine: {
    width: 12,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  iconsContainer: {
    flex: 1,
    backgroundColor: 'rgba(13,13,26,0.92)',
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 12,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  iconBtn: {
    alignItems: 'center',
    gap: 4,
  },
  iconImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  iconLabel: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});

// Old GofFAB styles — retained for reference, FAB retired in v2.5.0
const gofStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog:  { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', width: '100%' },
  dialogImage:  { width: 120, height: 120, marginBottom: 12 },
  dialogTitle:  { fontSize: 22, fontWeight: '700', color: DARK, marginBottom: 12 },
  dialogMsg:    { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  closeBtn:     { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
