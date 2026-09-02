/**
 * Shared rewarded-ad manager.
 *
 * Why this exists: every screen/modal used to create its own RewardedAd at
 * module scope and call load() from a useEffect. That meant ads were requested
 * on app start (before the user showed any interest) and re-requested on every
 * effect re-run — lots of filled requests that were never shown, which is what
 * drags the AdMob show rate down.
 *
 * Rules here:
 *   - one ad instance per ad unit, shared by every caller
 *   - a request only goes out when the user is actually inside the feature
 *   - never two requests in flight for the same unit
 *   - a cached ad older than the TTL is refreshed instead of shown (rewarded
 *     ads expire ~1h after load; show() on an expired ad silently fails)
 *   - failed loads retry with backoff, so the button isn't dead if the first
 *     request misses
 */
import { useCallback, useEffect, useState } from 'react';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';

/** Google expires rewarded ads about an hour after load; refresh before that. */
const AD_TTL_MS = 50 * 60 * 1000;
const RETRY_DELAYS_MS = [2000, 8000, 30000];

type ShowHandlers = { onReward?: () => void; onClosed?: () => void };

type Slot = {
  ad: RewardedAd;
  loaded: boolean;
  loading: boolean;
  loadedAt: number;
  failures: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  /** components currently inside the feature that shows this unit */
  active: number;
  watchers: Set<(ready: boolean) => void>;
  pending: ShowHandlers | null;
};

const slots = new Map<string, Slot>();

function isFresh(slot: Slot): boolean {
  return slot.loaded && Date.now() - slot.loadedAt < AD_TTL_MS;
}

function notify(slot: Slot) {
  const ready = isFresh(slot);
  slot.watchers.forEach(w => w(ready));
}

function clearRetry(slot: Slot) {
  if (slot.retryTimer) {
    clearTimeout(slot.retryTimer);
    slot.retryTimer = null;
  }
}

function getSlot(unitId: string): Slot {
  const existing = slots.get(unitId);
  if (existing) return existing;

  const slot: Slot = {
    ad: RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true }),
    loaded: false,
    loading: false,
    loadedAt: 0,
    failures: 0,
    retryTimer: null,
    active: 0,
    watchers: new Set(),
    pending: null,
  };

  // Listeners are attached once for the life of the app, so mounting a screen
  // never re-subscribes (and never re-triggers a load).
  slot.ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    slot.loaded = true;
    slot.loading = false;
    slot.loadedAt = Date.now();
    slot.failures = 0;
    notify(slot);
  });

  slot.ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    slot.pending?.onReward?.();
  });

  slot.ad.addAdEventListener(AdEventType.CLOSED, () => {
    const handlers = slot.pending;
    slot.pending = null;
    slot.loaded = false;
    slot.loading = false;
    slot.loadedAt = 0;
    notify(slot);
    handlers?.onClosed?.();
    // Only line up another ad if the user is still in the feature.
    if (slot.active > 0) ensureLoaded(unitId);
  });

  slot.ad.addAdEventListener(AdEventType.ERROR, () => {
    slot.loaded = false;
    slot.loading = false;
    notify(slot);
    if (slot.active > 0 && slot.failures < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[slot.failures];
      slot.failures += 1;
      clearRetry(slot);
      slot.retryTimer = setTimeout(() => {
        slot.retryTimer = null;
        if (slot.active > 0) ensureLoaded(unitId);
      }, delay);
    }
  });

  slots.set(unitId, slot);
  return slot;
}

/** Request an ad only if we don't already have a fresh one or a request in flight. */
export function ensureLoaded(unitId: string) {
  const slot = getSlot(unitId);
  if (slot.loading || isFresh(slot)) return;
  slot.loading = true;
  slot.loaded = false;
  try {
    slot.ad.load();
  } catch {
    slot.loading = false;
  }
}

/**
 * Show the ad if one is ready and unexpired.
 * Returns false when there's nothing to show, so callers can fall back.
 */
export function showRewarded(unitId: string, handlers: ShowHandlers = {}): boolean {
  const slot = getSlot(unitId);
  if (!isFresh(slot)) {
    // Stale or missing — drop it and line up a fresh one for next time.
    if (slot.loaded) {
      slot.loaded = false;
      slot.loadedAt = 0;
      notify(slot);
    }
    ensureLoaded(unitId);
    return false;
  }
  slot.pending = handlers;
  try {
    slot.ad.show();
    return true;
  } catch {
    slot.pending = null;
    slot.loaded = false;
    slot.loadedAt = 0;
    notify(slot);
    ensureLoaded(unitId);
    return false;
  }
}

/**
 * @param unitId  ad unit to use
 * @param active  true while the user is inside the feature that can show it.
 *                Loading starts only then — not on app start.
 */
export function useRewardedAd(unitId: string, active: boolean) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const slot = getSlot(unitId);
    slot.watchers.add(setReady);
    setReady(isFresh(slot));

    if (!active) return () => { slot.watchers.delete(setReady); };

    slot.active += 1;
    slot.failures = 0;
    ensureLoaded(unitId);

    return () => {
      slot.watchers.delete(setReady);
      slot.active = Math.max(0, slot.active - 1);
      if (slot.active === 0) clearRetry(slot);
    };
  }, [unitId, active]);

  const show = useCallback(
    (handlers?: ShowHandlers) => showRewarded(unitId, handlers),
    [unitId],
  );

  return { ready, show };
}
