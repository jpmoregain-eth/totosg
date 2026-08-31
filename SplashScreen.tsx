import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
} from 'react-native';

const RED   = '#ED2939';
const PAPER = '#FFFFFF';
const INK   = '#1A1A1A';
const MUTE  = '#7C7C7C';

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Pulse loop on the white ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // Fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      // Hold for 1.8s then fade out
      setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true })
          .start(() => onDone());
      }, 1800);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

        {/* Pulsing white ring + app logo */}
        <View style={styles.iconWrapper}>
          <Animated.View style={[styles.ring, { opacity: pulseAnim }]} />
          <Image
            source={require('./src/assets/GoF.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* App name */}
        <Text style={styles.appName}>SG LOTTERY</Text>
        <Text style={styles.subtitle}>NOTICE BOARD · SINGAPORE POOLS</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>HENG ONG HUAT 🎉</Text>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },

  // Icon ring
  iconWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: RED,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  // Text
  appName: {
    fontFamily: 'ArchivoNarrow-Bold',
    color: INK,
    fontSize: 32,
    letterSpacing: 4,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'IBMPlexMono-Medium',
    color: MUTE,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 28,
  },
  tagline: {
    fontFamily: 'IBMPlexMono-SemiBold',
    color: RED,
    fontSize: 14,
    letterSpacing: 2,
  },
});
