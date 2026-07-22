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
const FAB_SIZE = 72;

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

// ── GoF FAB ───────────────────────────────────────────────────────────────────
function GofFAB({ lang, config }: { lang: 'EN' | 'ZH'; config: GofConfig | null }) {
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [gofVisible,    setGofVisible]    = useState(false);
  const [showHint, setShowHint] = useState(true);
  const hintOpacity = useRef(new Animated.Value(1)).current;

  const initX = SCREEN_W / 2 - FAB_SIZE / 2;
  const initY = SCREEN_H / 2 - FAB_SIZE / 2;

  const pan     = useRef(new Animated.ValueXY({ x: initX, y: initY })).current;
  const lastPos = useRef({ x: initX, y: initY });
  const isDragging = useRef(false);

  // Hide hint after 5s
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(hintOpacity, { toValue: 0, duration: 500, useNativeDriver: false }).start(() => setShowHint(false));
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  // Bob
  const bobAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bobAnim, { toValue: -8, duration: 1000, useNativeDriver: false }),
      Animated.timing(bobAnim, { toValue: 0,  duration: 1000, useNativeDriver: false }),
    ])).start();
  }, []);

  // Pulse
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: false }),
    ])).start();
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,
    onPanResponderGrant: () => {
      isDragging.current = false;
      pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (_, gs) => {
      if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) isDragging.current = true;
      Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gs);
    },
    onPanResponderRelease: (_, gs) => {
      pan.flattenOffset();
      const currentX = lastPos.current.x + gs.dx;
      const currentY = lastPos.current.y + gs.dy;
      const snapX    = currentX + FAB_SIZE / 2 < SCREEN_W / 2 ? 16 : SCREEN_W - FAB_SIZE - 16;
      const clampedY = Math.max(16, Math.min(SCREEN_H - FAB_SIZE - 80, currentY));
      Animated.spring(pan, { toValue: { x: snapX, y: clampedY }, useNativeDriver: false, friction: 6 }).start();
      lastPos.current = { x: snapX, y: clampedY };
      if (!isDragging.current) {
        if (config?.featureActive) setGofVisible(true);
        else setTeaserVisible(true);
      }
    },
  })).current;

  const iconSource = config?.icon ?? require('./src/assets/GoF.png');

  return (
    <>
      <Animated.View
        style={[gofStyles.fab, { transform: [{ translateX: pan.x }, { translateY: Animated.add(pan.y, bobAnim) }] }]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[gofStyles.fabRing, { opacity: pulseAnim }]} />
        <Image source={iconSource} style={gofStyles.fabImage} resizeMode="contain" />
        {showHint && (
          <Animated.View style={[gofStyles.hint, { opacity: hintOpacity }]}>
            <Text style={gofStyles.hintText} numberOfLines={1}>{lang === 'ZH' ? '拖动/点击' : 'Drag/Tap'}</Text>
          </Animated.View>
        )}
      </Animated.View>

      <TeaserDialog
        visible={teaserVisible}
        onClose={() => setTeaserVisible(false)}
        lang={lang}
        config={config}
      />

      {config?.featureActive && (
        <GofModal
          visible={gofVisible}
          onClose={() => setGofVisible(false)}
          fabX={lastPos.current.x}
          fabY={lastPos.current.y}
          fabSize={FAB_SIZE}
          lang={lang}
          config={config}
        />
      )}
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
function MainApp() {
  const [game, setGame]       = useState('4D');
  const [gofConfig, setGofConfig] = useState<GofConfig | null>(null);
  const { lang } = useLang();

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

      {/* GoF FAB — only show when gof_active = true */}
      {gofConfig !== null && gofConfig.active && (
        <GofFAB lang={lang as 'EN' | 'ZH'} config={gofConfig} />
      )}
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
});

const gofStyles = StyleSheet.create({
  fab:     { position: 'absolute', width: FAB_SIZE, height: FAB_SIZE, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  fabRing: { position: 'absolute', width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2, borderWidth: 2, borderColor: GOLD },
  fabImage:{ width: FAB_SIZE - 8, height: FAB_SIZE - 8, borderRadius: (FAB_SIZE - 8) / 2 },
  hint:    { position: 'absolute', top: FAB_SIZE + 6, alignSelf: 'center', backgroundColor: DARK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: GOLD },
  hintText:{ color: GOLD, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog:  { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', width: '100%' },
  dialogImage:  { width: 120, height: 120, marginBottom: 12 },
  dialogTitle:  { fontSize: 22, fontWeight: '700', color: DARK, marginBottom: 12 },
  dialogMsg:    { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  closeBtn:     { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
