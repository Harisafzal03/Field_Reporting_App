jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { linkSpeed: 72 },
  }),
  addEventListener: jest.fn().mockReturnValue(jest.fn()),
  NetInfoStateType: {
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
    unknown: 'unknown',
  },
}));

import { parseHardwareNetwork } from '../src/services/network';
import { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

describe('Network & Hardware Connectivity Parser (Zero Data Overhead)', () => {
  describe('parseHardwareNetwork', () => {
    it('categorizes disconnected state as offline with paused label', () => {
      const offlineState: NetInfoState = {
        type: NetInfoStateType.none,
        isConnected: false,
        isInternetReachable: false,
        details: null,
      };

      const result = parseHardwareNetwork(offlineState);
      expect(result.speedCategory).toBe('offline');
      expect(result.isConnected).toBe(false);
      expect(result.bandwidthLabel).toBe('Offline · Paused');
    });

    it('identifies 2G cellular generation as 2g_weak without downloading extra test bytes', () => {
      const cell2gState: NetInfoState = {
        type: NetInfoStateType.cellular,
        isConnected: true,
        isInternetReachable: true,
        details: {
          cellularGeneration: '2g',
        } as any,
      };

      const result = parseHardwareNetwork(cell2gState);
      expect(result.speedCategory).toBe('2g_weak');
      expect(result.bandwidthLabel).toBe('2G · Weak signal');
    });

    it('identifies 3G cellular generation as 2g_weak tier', () => {
      const cell3gState: NetInfoState = {
        type: NetInfoStateType.cellular,
        isConnected: true,
        isInternetReachable: true,
        details: {
          cellularGeneration: '3g',
        } as any,
      };

      const result = parseHardwareNetwork(cell3gState);
      expect(result.speedCategory).toBe('2g_weak');
      expect(result.bandwidthLabel).toBe('3G · Weak signal');
    });

    it('categorizes 4G and 5G cellular generation as online', () => {
      const cell4gState: NetInfoState = {
        type: NetInfoStateType.cellular,
        isConnected: true,
        isInternetReachable: true,
        details: {
          cellularGeneration: '4g',
        } as any,
      };

      const result = parseHardwareNetwork(cell4gState);
      expect(result.speedCategory).toBe('online');
      expect(result.bandwidthLabel).toBe('4G · Connected');
    });

    it('categorizes Wi-Fi as online', () => {
      const wifiState: NetInfoState = {
        type: NetInfoStateType.wifi,
        isConnected: true,
        isInternetReachable: true,
        details: null as any,
      };

      const result = parseHardwareNetwork(wifiState);
      expect(result.speedCategory).toBe('online');
      expect(result.bandwidthLabel).toBe('Wi-Fi · Connected');
    });
  });
});
