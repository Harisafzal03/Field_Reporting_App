import AsyncStorage from '@react-native-async-storage/async-storage';
import { QUEUE_STORAGE_KEY, queueStore } from '../src/queue/queueStore';
import { Report } from '../src/domain/types';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
    __getStore: () => store,
    __resetStore: () => {
      store = {};
    },
  };
});

describe('Persistent Queue Store - Restart Survival & Crash Resilience', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__resetStore();
    jest.clearAllMocks();
    await queueStore.clearQueue();
  });

  it('persists queued reports to device disk (AsyncStorage)', async () => {
    const report: Report = {
      id: 'rep_disk_test_1',
      description: 'Corrosion detected on north pipeline segment',
      attachments: [
        {
          id: 'att_1',
          uri: 'file:///data/user/0/com.fieldreports/cache/pipeline_1.jpg',
          fileName: 'pipeline_1.jpg',
          fileSizeBytes: 1024 * 1024,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      QUEUE_STORAGE_KEY,
      expect.stringContaining('rep_disk_test_1'),
    );
    expect(queueStore.getReports()).toHaveLength(1);
    expect(queueStore.getReports()[0].id).toBe('rep_disk_test_1');
  });

  it('hydrates queue from disk on cold start (simulating app relaunch after adb force-stop)', async () => {
    // 1. Pre-seed disk with 3 reports (simulating reports created in Airplane mode before app killed)
    const existingReports: Report[] = [
      {
        id: 'rep_cold_1',
        description: 'Feeder breaker tripped',
        attachments: [{ id: 'a1', uri: 'file:///p1.jpg', fileName: 'p1.jpg', fileSizeBytes: 500000 }],
        createdAt: 1000,
        updatedAt: 1000,
        status: 'in_queue',
        retryCount: 0,
      },
      {
        id: 'rep_cold_2',
        description: 'Substation fence compromised',
        attachments: [
          { id: 'a2', uri: 'file:///p2.jpg', fileName: 'p2.jpg', fileSizeBytes: 800000 },
          { id: 'a3', uri: 'file:///p3.jpg', fileName: 'p3.jpg', fileSizeBytes: 900000 },
        ],
        createdAt: 2000,
        updatedAt: 2000,
        status: 'in_queue',
        retryCount: 0,
      },
      {
        id: 'rep_cold_3',
        description: 'Transformer cooling fan bearing noise with 5 camera photos',
        attachments: [
          { id: 'a4', uri: 'file:///p4.jpg', fileName: 'p4.jpg', fileSizeBytes: 1200000 },
          { id: 'a5', uri: 'file:///p5.jpg', fileName: 'p5.jpg', fileSizeBytes: 1300000 },
          { id: 'a6', uri: 'file:///p6.jpg', fileName: 'p6.jpg', fileSizeBytes: 1100000 },
          { id: 'a7', uri: 'file:///p7.jpg', fileName: 'p7.jpg', fileSizeBytes: 1400000 },
          { id: 'a8', uri: 'file:///p8.jpg', fileName: 'p8.jpg', fileSizeBytes: 1500000 },
        ],
        createdAt: 3000,
        updatedAt: 3000,
        status: 'in_queue',
        retryCount: 0,
      },
    ];

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(existingReports));

    // 2. Perform cold start hydration
    const loaded = await queueStore.loadQueueFromDisk();

    expect(loaded).toHaveLength(3);
    expect(loaded[0].id).toBe('rep_cold_1');
    expect(loaded[2].attachments).toHaveLength(5);
    expect(queueStore.getReports()).toHaveLength(3);
  });

  it('resets interrupted in-flight uploading status back to in_queue upon restart', async () => {
    // If the OS killed the app while a report was in mid-upload
    const interruptedReports: Report[] = [
      {
        id: 'rep_interrupted_1',
        description: 'Oil level gauge low',
        attachments: [{ id: 'a1', uri: 'file:///p1.jpg', fileName: 'p1.jpg', fileSizeBytes: 500000 }],
        createdAt: 1000,
        updatedAt: 1000,
        status: 'uploading',
        retryCount: 1,
        progress: {
          bytesSent: 250000,
          totalBytes: 500000,
          currentAttachmentIndex: 0,
          totalAttachments: 1,
          percent: 50,
        },
      },
    ];

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(interruptedReports));

    const reloaded = await queueStore.loadQueueFromDisk();

    expect(reloaded[0].status).toBe('in_queue');
    expect(reloaded[0].progress).toBeUndefined();
  });

  it('notifies subscribers reactively when reports are enqueued, updated, or cleared', async () => {
    const listener = jest.fn();
    const unsubscribe = queueStore.subscribe(listener);

    const report: Report = {
      id: 'rep_notify_1',
      description: 'Valve pressure stable',
      attachments: [{ id: 'a1', uri: 'file:///v1.jpg', fileName: 'v1.jpg', fileSizeBytes: 300000 }],
      createdAt: 1000,
      updatedAt: 1000,
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);
    expect(listener).toHaveBeenCalled();

    await queueStore.updateReport('rep_notify_1', { status: 'delivered' });
    expect(queueStore.getReports()[0].status).toBe('delivered');

    await queueStore.clearQueue();
    expect(queueStore.getReports()).toHaveLength(0);

    unsubscribe();
  });
});
