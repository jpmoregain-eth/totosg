/**
 * @format
 */
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Firebase background handler — wrapped safely
try {
  const { setupBackgroundHandler } = require('./src/lib/notifications');
  setupBackgroundHandler();
} catch (e) {
  console.warn('[FCM] Background handler setup failed:', e);
}

AppRegistry.registerComponent(appName, () => App);
