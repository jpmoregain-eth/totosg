import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
} from 'react-native';

const DARK   = '#1a1a2e';
const GOLD   = '#C9A84C';
const PURPLE = '#7c6ff7';

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Pulse loop on the gold ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Hold for 1.8s then fade out
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => onDone());
      }, 1800);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Pulsing gold ring + logo */}
        <View style={styles.iconWrapper}>
          <Animated.View style={[styles.ring, { opacity: pulseAnim }]} />
          <Image
            source={require('./src/assets/god-of-fortune.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* App name */}
        <Text style={styles.appName}>SG LOTTERY</Text>
        <Text style={styles.subtitle}>4D · TOTO</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>HENG ONG HUAT 🎉</Text>
      </Animated.View>

      {/* Bottom credit */}
      <Animated.Text style={[styles.credit, { opacity: fadeAnim }]}>
        The JP Moregain Project
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },

  // Icon ring
  iconWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: GOLD,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  // Text
  appName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 6,
    marginBottom: 6,
  },
  subtitle: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 4,
    marginBottom: 28,
  },
  tagline: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },

  // Bottom
  credit: {
    position: 'absolute',
    bottom: 40,
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    letterSpacing: 1,
  },
});
