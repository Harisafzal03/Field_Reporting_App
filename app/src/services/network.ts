import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { NetworkSpeed } from '../domain/types';

export interface HardwareNetworkStatus {
  speedCategory: NetworkSpeed; // 'online' | '2g_weak' | 'offline'
  connectionType: NetInfoStateType;
  cellularGeneration?: string | null;
  bandwidthLabel: string; // e.g. "Wi-Fi · Connected", "2G · Weak signal", "Offline"
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

export function parseHardwareNetwork(state: NetInfoState): HardwareNetworkStatus {
  const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);

  if (!isConnected || state.type === 'none') {
    return {
      speedCategory: 'offline',
      connectionType: state.type,
      bandwidthLabel: 'Offline · Paused',
      isConnected: false,
      isInternetReachable: false,
    };
  }

  let cellularGen: string | null = null;
  let speedCategory: NetworkSpeed = 'online';
  let label = 'Connected';

  if (state.type === 'cellular') {
    const gen = state.details?.cellularGeneration;
    cellularGen = gen ? gen.toUpperCase() : 'CELL';
    if (gen === '2g' || gen === '3g') {
      speedCategory = '2g_weak';
      label = `${cellularGen} · Weak signal`;
    } else {
      label = `${cellularGen} · Connected`;
    }
  } else if (state.type === 'wifi') {
    label = 'Wi-Fi · Connected';
  } else {
    label = 'Network active';
  }

  return {
    speedCategory,
    connectionType: state.type,
    cellularGeneration: cellularGen,
    bandwidthLabel: label,
    isConnected: true,
    isInternetReachable: true,
  };
}

export function subscribeToHardwareNetwork(
  onChange: (status: HardwareNetworkStatus) => void,
): () => void {
  // 1. Initial hardware query
  NetInfo.fetch().then(state => {
    onChange(parseHardwareNetwork(state));
  });

  // 2. Hardware state listener
  const unsubscribeNetInfo = NetInfo.addEventListener(state => {
    onChange(parseHardwareNetwork(state));
  });

  return () => {
    unsubscribeNetInfo();
  };
}
