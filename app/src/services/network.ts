import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { NetworkSpeed } from '../domain/types';

declare const process: any;

export interface HardwareNetworkStatus {
  speedCategory: NetworkSpeed; // 'online' | '2g_weak' | 'offline'
  connectionType: NetInfoStateType;
  cellularGeneration?: string | null;
  bandwidthLabel: string; // e.g. "WIFI · 610 KBPS" or "4G · 18.4 MBPS"
  measuredKbps?: number;
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

export function formatSpeedKbps(kbps: number, mediumPrefix: string): string {
  if (kbps <= 0) {
    return `${mediumPrefix} · 0 KBPS`;
  }
  if (kbps < 1000) {
    return `${mediumPrefix} · ${Math.round(kbps)} KBPS`;
  }
  const mbps = (kbps / 1000).toFixed(1);
  return `${mediumPrefix} · ${mbps.endsWith('.0') ? mbps.slice(0, -2) : mbps} MBPS`;
}

export function formatTransferRate(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KBPS';
  const kbps = (bytesPerSec * 8) / 1000;
  if (kbps < 1000) {
    return `${Math.round(kbps)} KBPS`;
  }
  return `${(kbps / 1000).toFixed(1)} MBPS`;
}

/**
 * Measures actual live Internet throughput in Kbps by downloading a lightweight 50KB payload.
 * Works across both Android and iOS over Cellular (2G/3G/4G/5G) and WiFi.
 */
export async function measureActualInternetSpeedKbps(timeoutMs: number = 3500): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://speed.cloudflare.com/__down?bytes=50000&_t=${Date.now()}`;

  try {
    const startTime = Date.now();
    const res = await fetch(url, {
      signal: controller.signal,
    });

    if (!res.ok) {
      clearTimeout(timer);
      return null;
    }

    const blob = await res.blob();
    clearTimeout(timer);

    const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.04);
    const bytes = blob.size || 50000;
    const bitsPerSec = (bytes * 8) / elapsedSec;
    return Math.round(bitsPerSec / 1000);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export function parseHardwareNetwork(
  state: NetInfoState,
  measuredKbps?: number | null,
): HardwareNetworkStatus {
  const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);

  if (!isConnected || state.type === 'none') {
    return {
      speedCategory: 'offline',
      connectionType: state.type,
      bandwidthLabel: 'OFFLINE · 0 KBPS',
      measuredKbps: 0,
      isConnected: false,
      isInternetReachable: false,
    };
  }

  // Derive connection medium label (WIFI, 2G, 3G, 4G, 5G, or CELL)
  let mediumLabel = 'LINK';
  let defaultCategory: NetworkSpeed = 'online';
  let cellularGen: string | null = null;

  if (state.type === 'cellular') {
    const gen = state.details?.cellularGeneration;
    cellularGen = gen ? gen.toUpperCase() : 'CELL';
    mediumLabel = cellularGen;
    if (gen === '2g' || gen === '3g') {
      defaultCategory = '2g_weak';
    }
  } else if (state.type === 'wifi') {
    mediumLabel = 'WIFI';
  }

  // If we have an actual measured Internet throughput (e.g. 610 Kbps from fast/real measurement)
  if (typeof measuredKbps === 'number' && measuredKbps > 0) {
    const isWeak = measuredKbps < 1000; // < 1 Mbps is 2G/weak speed tier
    return {
      speedCategory: isWeak ? '2g_weak' : 'online',
      connectionType: state.type,
      cellularGeneration: cellularGen,
      bandwidthLabel: formatSpeedKbps(measuredKbps, mediumLabel),
      measuredKbps,
      isConnected: true,
      isInternetReachable: true,
    };
  }

  // Initial estimate while first measurement is in flight
  return {
    speedCategory: defaultCategory,
    connectionType: state.type,
    cellularGeneration: cellularGen,
    bandwidthLabel: `${mediumLabel} · MEASURING...`,
    isConnected: true,
    isInternetReachable: true,
  };
}

let activeListener: ((status: HardwareNetworkStatus) => void) | null = null;
let lastKnownState: NetInfoState | null = null;
let lastKnownKbps: number | null = null;
let isMeasuring = false;

async function runSpeedMeasurement(): Promise<void> {
  if (isMeasuring || !activeListener || !lastKnownState) return;

  const isConnected = Boolean(lastKnownState.isConnected && lastKnownState.isInternetReachable !== false);
  if (!isConnected || lastKnownState.type === 'none') {
    lastKnownKbps = 0;
    activeListener(parseHardwareNetwork(lastKnownState, 0));
    return;
  }

  isMeasuring = true;
  const kbps = await measureActualInternetSpeedKbps();
  isMeasuring = false;

  if (typeof kbps === 'number' && kbps > 0) {
    lastKnownKbps = kbps;
    if (activeListener && lastKnownState) {
      activeListener(parseHardwareNetwork(lastKnownState, kbps));
    }
  } else if (lastKnownKbps && activeListener && lastKnownState) {
    activeListener(parseHardwareNetwork(lastKnownState, lastKnownKbps));
  }
}

export function triggerSpeedTest(): void {
  runSpeedMeasurement();
}

export function subscribeToHardwareNetwork(
  onChange: (status: HardwareNetworkStatus) => void,
): () => void {
  activeListener = onChange;

  // 1. Initial NetInfo fetch
  NetInfo.fetch().then(state => {
    lastKnownState = state;
    onChange(parseHardwareNetwork(state, lastKnownKbps));
    // Immediately test actual internet speed
    runSpeedMeasurement();
  });

  // 2. Hardware state listener
  const unsubscribeNetInfo = NetInfo.addEventListener(state => {
    lastKnownState = state;
    onChange(parseHardwareNetwork(state, lastKnownKbps));
    // Re-measure whenever network state changes
    runSpeedMeasurement();
  });

  // 3. Periodic measurement every 15 seconds to update real speed (disabled in unit tests)
  let interval: any = null;
  if (process.env.NODE_ENV !== 'test') {
    interval = setInterval(() => {
      runSpeedMeasurement();
    }, 15000);
    if (typeof interval?.unref === 'function') {
      interval.unref();
    }
  }

  return () => {
    activeListener = null;
    unsubscribeNetInfo();
    if (interval) {
      clearInterval(interval);
    }
  };
}
