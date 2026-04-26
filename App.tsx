import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

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

export default function App() {
  const [game, setGame] = useState('4D');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.appHeader}>
          <View style={styles.headerTop}>
            {/* Logo + Title */}
            <View style={styles.titleRow}>
              <Image
                source={require('./src/assets/applogo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.appTitle}>SG Lottery</Text>
                <Text style={styles.appSubtitle}>Singapore Pools Results</Text>
              </View>
            </View>
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
                <Tab.Screen name="Results"   component={FourdResultsScreen} />
                <Tab.Screen name="History"   component={FourdHistoryScreen} />
                <Tab.Screen name="Generator" component={FourdGeneratorScreen} />
                <Tab.Screen name="What If?"  children={() => <WhatIfScreen game="4D" />} />
              </>
            ) : (
              <>
                <Tab.Screen name="Results"   component={ResultsScreen} />
                <Tab.Screen name="History"   component={HistoryScreen} />
                <Tab.Screen name="Generator" component={GeneratorScreen} />
                <Tab.Screen name="What If?"  children={() => <WhatIfScreen game="TOTO" />} />
              </>
            )}
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: DARK },
  appHeader:   { backgroundColor: DARK, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Logo + title row
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo:        { width: 40, height: 40, borderRadius: 8 },
  appTitle:    { color: '#fff', fontSize: 20, fontWeight: '600' },
  appSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },

  // Game switcher
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 3,
  },
  switcherBtn:        { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 17 },
  switcherActive:     { backgroundColor: GOLD },
  switcherText:       { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  switcherTextActive: { color: '#fff' },
});
