/**
 * @format
 */

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn().mockResolvedValue({ assets: [] }),
  launchImageLibrary: jest.fn().mockResolvedValue({ assets: [] }),
}));

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

// Mock the API client
jest.mock('../src/services/api', () => {
  class MockApiError extends Error {
    status: number;
    isFatal: boolean;
    serverError?: string;
    constructor(status: number, message: string, serverError?: string) {
      super(message);
      this.status = status;
      this.serverError = serverError;
      this.isFatal = status >= 400 && status < 500;
    }
  }
  return {
    ApiError: MockApiError,
    api: {
      resolveActiveBaseUrl: jest.fn().mockResolvedValue('http://localhost:3000'),
      getBaseUrl: jest.fn().mockReturnValue('http://localhost:3000'),
      getReports: jest.fn().mockResolvedValue([]),
      submitReport: jest.fn(),
      configureChaos: jest.fn().mockResolvedValue({ ok: true }),
      resetServer: jest.fn().mockResolvedValue({ ok: true }),
    },
  };
});

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import App from '../App';
import { api } from '../src/services/api';
import { queueStore } from '../src/queue/queueStore';

describe('End-to-End User Experience & Navigation Journey', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeAll(() => {
    globalThis.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ reports: [] }),
        blob: () => Promise.resolve({ size: 50000 }),
      }),
    ) as any;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await queueStore.clearQueue();
  });

  afterEach(() => {
    if (renderer) {
      ReactTestRenderer.act(() => {
        renderer?.unmount();
      });
      renderer = null;
    }
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders initial application with Compose screen, Header, and Bottom Tabs', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    const allText = renderer!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Field Reports'))).toBe(true);
    expect(allText.some(t => t.includes('COMPOSE'))).toBe(true);
    expect(allText.some(t => t.includes('OUTBOX'))).toBe(true);
    expect(allText.some(t => t.includes('SERVER REVIEW'))).toBe(true);
  });

  it('allows user to navigate smoothly between bottom navigation tabs', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    // Tap Outbox tab
    const outboxTab = renderer!.root.findByProps({ accessibilityLabel: 'Outbox queue' });
    await ReactTestRenderer.act(async () => {
      outboxTab.props.onPress();
    });

    let allText = renderer!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Outbox is Clear'))).toBe(true);

    // Tap Server Review tab
    const reviewTab = renderer!.root.findByProps({ accessibilityLabel: 'Server review' });
    await ReactTestRenderer.act(async () => {
      reviewTab.props.onPress();
    });

    allText = renderer!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Server Archive'))).toBe(true);

    // Tap Compose tab to return
    const composeTab = renderer!.root.findByProps({ accessibilityLabel: 'Compose report' });
    await ReactTestRenderer.act(async () => {
      composeTab.props.onPress();
    });

    allText = renderer!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Inspection Notes (Required)'))).toBe(true);
  });

  it('opens Chaos modal when evaluator taps Tools button in header', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    const chaosButton = renderer!.root.findByProps({ accessibilityLabel: 'Open Chaos and Reset controller' });
    await ReactTestRenderer.act(async () => {
      chaosButton.props.onPress();
    });

    const allText = renderer!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Diagnostics & Fault Simulation'))).toBe(true);
    expect(allText.some(t => t.includes('Preset Test Conditions'))).toBe(true);
  });

  it('triggers network info alert when inspector taps network pill', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    const networkPill = renderer!.root.findByType(require('../src/components/NetworkPill').NetworkPill);
    await ReactTestRenderer.act(async () => {
      networkPill.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('queuing a report adds it to persistent outbox and triggers unattended upload flow', async () => {
    let resolveUpload: any;
    (api.submitReport as jest.Mock).mockImplementation(() => new Promise(resolve => {
      resolveUpload = resolve;
    }));

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    // Enter description and trigger onQueueReport on ComposeScreen
    const composeInstance = renderer!.root.findByType(require('../src/screens/ComposeScreen').ComposeScreen);
    await ReactTestRenderer.act(async () => {
      await composeInstance.props.onQueueReport('Transformer oil level normal', [
        {
          id: 'photo_trans_1',
          uri: 'file:///local/photo_trans.jpg',
          fileName: 'transformer.jpg',
          fileSizeBytes: 1.5 * 1024 * 1024,
        },
      ]);
    });

    // Should automatically switch to Outbox screen and show pending report
    let allText = renderer!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Transformer oil level normal'))).toBe(true);
    expect(api.submitReport).toHaveBeenCalled();

    // Now resolve upload -> transitions to delivered
    await ReactTestRenderer.act(async () => {
      resolveUpload({ ok: true, reportId: 'srv_test_confirmed_1' });
    });
  });

  it('retains report in queue and schedules auto-retry when upload connection drops', async () => {
    // Simulate connection drop mid-flight
    (api.submitReport as jest.Mock).mockRejectedValue(new Error('Connection dropped mid-flight'));

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    const composeInstance = renderer!.root.findByType(require('../src/screens/ComposeScreen').ComposeScreen);
    await ReactTestRenderer.act(async () => {
      await composeInstance.props.onQueueReport('HVAC unit fan belt slipped', [
        {
          id: 'photo_fan_1',
          uri: 'file:///local/photo_fan.jpg',
          fileName: 'fan.jpg',
          fileSizeBytes: 1.1 * 1024 * 1024,
        },
      ]);
    });

    // Report should remain in outbox queue with retry status (NOT abandoned)
    const allText = renderer!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('HVAC unit fan belt slipped'))).toBe(true);
    expect(allText.some(t => t.includes('retry #1') || t.includes('Retrying'))).toBe(true);
    expect(allText.some(t => t.includes('Safe on this phone'))).toBe(true);
  });
});
