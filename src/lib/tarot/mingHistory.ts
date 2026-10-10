/**
 * Ming (命) reading history — AsyncStorage. Newest first, capped.
 * Every entry carries the engine version it was produced with.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENGINE_VERSION, type Reading } from './mingEngine';

const HISTORY_KEY = 'ming_history_v1';
const MAX_ENTRIES = 50;

export interface MingHistoryEntry {
  id: string;
  savedAt: number;
  /** Engine version stamp (also present on reading.version). */
  engineVersion: string;
  reading: Reading;
}

export async function loadMingHistory(): Promise<MingHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveMingReading(reading: Reading): Promise<MingHistoryEntry> {
  const entry: MingHistoryEntry = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, // id only, not security-relevant
    savedAt: Date.now(),
    engineVersion: ENGINE_VERSION,
    reading,
  };
  const existing = await loadMingHistory();
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...existing].slice(0, MAX_ENTRIES)));
  return entry;
}

export async function clearMingHistory(): Promise<void> {
  try { await AsyncStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}
