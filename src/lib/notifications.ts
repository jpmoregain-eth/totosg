import { Alert } from 'react-native';

let messagingModule: any = null;

function getMessaging() {
  if (!messagingModule) {
    try {
      const { getMessaging } = require('@react-native-firebase/messaging');
      const { getApp } = require('@react-native-firebase/app');
      messagingModule = getMessaging(getApp());
    } catch (e) {
      console.warn('[FCM] Failed to get messaging module:', e);
    }
  }
  return messagingModule;
}

// ── Request notification permission ───────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { requestPermission, AuthorizationStatus } = require('@react-native-firebase/messaging');
    const messaging = getMessaging();
    if (!messaging) return false;
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    console.log('[FCM] Permission:', authStatus, enabled);
    return enabled;
  } catch (e) {
    console.warn('[FCM] Permission error:', e);
    return false;
  }
}

// ── Get FCM token ─────────────────────────────────────────────────────────────
export async function getFCMToken(): Promise<string | null> {
  try {
    const { getToken } = require('@react-native-firebase/messaging');
    const messaging = getMessaging();
    if (!messaging) return null;
    const token = await getToken(messaging);
    console.log('[FCM] Token:', token);
    return token;
  } catch (e) {
    console.warn('[FCM] Token error:', e);
    return null;
  }
}

// ── Foreground message handler ────────────────────────────────────────────────
export function setupForegroundHandler() {
  try {
    const { onMessage } = require('@react-native-firebase/messaging');
    const messaging = getMessaging();
    if (!messaging) return () => {};
    return onMessage(messaging, async (remoteMessage: any) => {
      const title = remoteMessage.notification?.title ?? 'SG Lottery';
      const body  = remoteMessage.notification?.body  ?? '';
      Alert.alert(title, body);
    });
  } catch (e) {
    console.warn('[FCM] Foreground handler error:', e);
    return () => {};
  }
}

// ── Background handler ────────────────────────────────────────────────────────
export function setupBackgroundHandler() {
  try {
    const { setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
    const messaging = getMessaging();
    if (!messaging) return;
    setBackgroundMessageHandler(messaging, async (remoteMessage: any) => {
      console.log('[FCM] Background message:', remoteMessage);
    });
  } catch (e) {
    console.warn('[FCM] Background handler error:', e);
  }
}

