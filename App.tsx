import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

import SplashScreen from './SplashScreen';
import { LangProvider, useLang } from './src/lib/LangContext';
import { tr } from './src/lib/i18n';
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

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <View style={styles.langContainer}>
      <TouchableOpacity
        style={[styles.langBtn, lang === 'EN' && styles.langActive]}
        onPress={() => setLang('EN')}
      >
        <Text style={[styles.langText, lang === 'EN' && styles.langTextActive]}>EN</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.langBtn, lang === 'ZH' && styles.langActive]}
        onPress={() => setLang('ZH')}
      >
        <Text style={[styles.langText, lang === 'ZH' && styles.langTextActive]}>中</Text>
      </TouchableOpacity>
    </View>
  );
}

function GameSwitcher({ game, setGame }) {
  return (
    <View style={styles.switcherContainer}>
      <TouchableOpacity
        style={[styles.switcherBtn, game === '4D' && styles.switcherActive]}
        onPress={() => setGame('4D')}
      >
        <Text style={[styles.switcherText, game === '4D' && styles.switcherTextActive]}>4D</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.switcherBtn, game === 'TOTO' && styles.switcherActive]}
        onPress={() => setGame('TOTO')}
      >
        <Text style={[styles.switcherText, game === 'TOTO' && styles.switcherTextActive]}>TOTO</Text>
      </TouchableOpacity>
    </View>
  );
}

function MainApp() {
  const [game, setGame] = useState('4D');
  const { lang } = useLang();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.appHeader}>
        {/* Row 1: Logo + Title + Lang toggle */}
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <Image
              source={require('./src/assets/applogo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.appTitle}>{tr('appTitle', lang)}</Text>
              <Text style={styles.appSubtitle}>{tr('appSubtitle', lang)}</Text>
            </View>
          </View>
          <LangToggle />
        </View>
        {/* Row 2: Game switcher */}
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
              <Tab.Screen name={tr('results', lang)}   component={FourdResultsScreen} />
              <Tab.Screen name={tr('history', lang)}   component={FourdHistoryScreen} />
              <Tab.Screen name={tr('generator', lang)} component={FourdGeneratorScreen} />
              <Tab.Screen name={tr('whatIf', lang)}    children={() => <WhatIfScreen game="4D" />} />
            </>
          ) : (
            <>
              <Tab.Screen name={tr('results', lang)}   component={ResultsScreen} />
              <Tab.Screen name={tr('history', lang)}   component={HistoryScreen} />
              <Tab.Screen name={tr('generator', lang)} component={GeneratorScreen} />
              <Tab.Screen name={tr('whatIf', lang)}    children={() => <WhatIfScreen game="TOTO" />} />
            </>
          )}
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaView>
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
  safeArea:  { flex: 1, backgroundColor: DARK },
  appHeader: { backgroundColor: DARK, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },

  // Row 1
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo:      { width: 40, height: 40, borderRadius: 8 },
  appTitle:  { color: '#fff', fontSize: 20, fontWeight: '600' },
  appSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },

  // Row 2
  switcherRow: { marginTop: 10, alignItems: 'center' },

  // Lang toggle
  langContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 3,
  },
  langBtn:        { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 13 },
  langActive:     { backgroundColor: PURPLE },
  langText:       { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  langTextActive: { color: '#fff' },

  // Game switcher
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 3,
  },
  switcherBtn:        { paddingHorizontal: 24, paddingVertical: 5, borderRadius: 17 },
  switcherActive:     { backgroundColor: GOLD },
  switcherText:       { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  switcherTextActive: { color: '#fff' },
});
