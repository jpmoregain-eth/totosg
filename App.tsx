import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';

import ResultsScreen from './src/screens/ResultsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GeneratorScreen from './src/screens/GeneratorScreen';

const Tab = createMaterialTopTabNavigator();
const DARK = '#1a1a2e';
const PURPLE = '#7c6ff7';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.appHeader}>
          <Text style={styles.appTitle}>TOTO SG</Text>
          <Text style={styles.appSubtitle}>Singapore Pools Results</Text>
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
            }}
          >
            <Tab.Screen name="Results" component={ResultsScreen} />
            <Tab.Screen name="History" component={HistoryScreen} />
            <Tab.Screen name="Generator" component={GeneratorScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DARK },
  appHeader: { backgroundColor: DARK, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  appTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  appSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
});
