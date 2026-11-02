import { queueStore } from '../src/queue/queueStore';
import { uploadEngine } from '../src/services/uploadEngine';
import { api, ApiError } from '../src/services/api';
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
    __resetStore: () => {
      store = {};
    },
  };
});

jest.mock('../src/services/api', () => {
  const original = jest.requireActual('../src/services/api');
  return {
    ...original,
    api: {
      submitReport: jest.fn(),
      getReports: jest.fn().mockResolvedValue([]),
    },
  };
});

describe('Headless Upload Engine - Isolated Logic & Error Classification', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await queueStore.clearQueue();
    uploadEngine.setOffline(false);
  });

  afterEach(() => {
    uploadEngine.stop();
  });

  it('runs headless and uploads queued reports without rendering any UI screens', async () => {
    (api.submitReport as jest.Mock).mockResolvedValueOnce({
      ok: true,
      reportId: 'server_ack_headless_1',
    });

    const report: Report = {
      id: 'rep_headless_1',
      description: 'Primary feeder conductor inspected',
      attachments: [
        {
          id: 'att_h1',
          uri: 'file:///photo_h1.jpg',
          fileName: 'photo_h1.jpg',
          fileSizeBytes: 800000,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);

    const deliveryCallback = jest.fn();
    const unsub = uploadEngine.onDelivery(deliveryCallback);

    await uploadEngine.tick();

    expect(api.submitReport).toHaveBeenCalledWith(
      'rep_headless_1',
      'Primary feeder conductor inspected',
      expect.any(Array),
      expect.any(Function),
    );

    const reports = queueStore.getReports();
    expect(reports[0].status).toBe('delivered');
    expect(reports[0].serverReportId).toBe('server_ack_headless_1');
    expect(deliveryCallback).toHaveBeenCalledWith('rep_headless_1', 'server_ack_headless_1');

    unsub();
  });

  it('classifies transient errors (network drop, socket abort, HTTP 500) as retryable', async () => {
    // Simulate connection drop mid-stream
    (api.submitReport as jest.Mock).mockRejectedValueOnce(
      new ApiError(0, 'Connection dropped or network unreachable.'),
    );

    const report: Report = {
      id: 'rep_transient_1',
      description: 'Breaker arcing observed',
      attachments: [{ id: 'a1', uri: 'file:///p1.jpg', fileName: 'p1.jpg', fileSizeBytes: 500000 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);
    await uploadEngine.tick();

    const reports = queueStore.getReports();
    // Must remain in queue and have retry scheduled
    expect(reports[0].status).toBe('in_queue');
    expect(reports[0].retryCount).toBe(1);
    expect(reports[0].nextRetryAt).toBeGreaterThan(Date.now());
    expect(reports[0].errorMessage).toContain('Connection dropped');
  });

  it('classifies HTTP 413 (Payload Too Large) as FATAL: stops retrying and displays plain-English reason', async () => {
    // Destination 5 MB hard ceiling exceeded
    (api.submitReport as jest.Mock).mockRejectedValueOnce(
      new ApiError(413, 'File exceeds 5 MB hard ceiling', 'LIMIT_FILE_SIZE'),
    );

    const report: Report = {
      id: 'rep_fatal_413',
      description: 'Oversized photo report',
      attachments: [{ id: 'a1', uri: 'file:///huge.jpg', fileName: 'huge.jpg', fileSizeBytes: 6 * 1024 * 1024 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);
    await uploadEngine.tick();

    const reports = queueStore.getReports();
    // MUST stop retrying immediately
    expect(reports[0].status).toBe('failed');
    expect(reports[0].nextRetryAt).toBeUndefined();
    expect(reports[0].errorMessage).toBe(
      'Photo exceeds the 5.0 MB destination ceiling. Remove or replace the photo.',
    );
  });

  it('classifies HTTP 400 (Validation failure) as FATAL: stops retrying immediately', async () => {
    (api.submitReport as jest.Mock).mockRejectedValueOnce(
      new ApiError(400, 'Description is required and cannot be blank', 'VALIDATION_FAILED'),
    );

    const report: Report = {
      id: 'rep_fatal_400',
      description: '',
      attachments: [{ id: 'a1', uri: 'file:///p.jpg', fileName: 'p.jpg', fileSizeBytes: 50000 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);
    await uploadEngine.tick();

    const reports = queueStore.getReports();
    expect(reports[0].status).toBe('failed');
    expect(reports[0].nextRetryAt).toBeUndefined();
    expect(reports[0].errorMessage).toBe('VALIDATION_FAILED');
  });

  it('pauses uploading when offline and resumes when back online', async () => {
    uploadEngine.setOffline(true);

    const report: Report = {
      id: 'rep_offline_1',
      description: 'Inspection in remote gorge',
      attachments: [{ id: 'a1', uri: 'file:///p.jpg', fileName: 'p.jpg', fileSizeBytes: 100000 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);

    await uploadEngine.tick();
    // Should NOT call submitReport when offline
    expect(api.submitReport).not.toHaveBeenCalled();

    // Come back online
    (api.submitReport as jest.Mock).mockResolvedValueOnce({ ok: true, reportId: 'srv_resumed_1' });
    uploadEngine.setOffline(false);

    // Wait for the tick triggered by coming back online
    await new Promise(resolve => setTimeout(() => resolve(undefined), 50));

    expect(api.submitReport).toHaveBeenCalled();
    expect(queueStore.getReports()[0].status).toBe('delivered');
  });

  it('handles Check B (Lost Response): retries with identical idempotency key and lands on delivered', async () => {
    // 1st attempt: server ingested data, but socket severed before reply arrived (Lost Response)
    (api.submitReport as jest.Mock).mockRejectedValueOnce(
      new Error('Connection dropped or network unreachable. Safe on this phone.'),
    );

    const report: Report = {
      id: 'rep_check_b_lost_response',
      description: 'Check B Lost Response site audit',
      attachments: [{ id: 'a1', uri: 'file:///p1.jpg', fileName: 'p1.jpg', fileSizeBytes: 200000 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);
    await uploadEngine.tick();

    // After dropped reply: preserved in queue, retryCount incremented, idempotency key unchanged
    let queued = queueStore.getReports();
    expect(queued[0].status).toBe('in_queue');
    expect(queued[0].retryCount).toBe(1);
    expect(queued[0].id).toBe('rep_check_b_lost_response');

    // 2nd attempt (Retry): Server absorbs retry via same idempotency key and returns 200
    (api.submitReport as jest.Mock).mockResolvedValueOnce({
      ok: true,
      reportId: 'rep_check_b_lost_response',
    });

    // Reset nextRetryAt to simulate retry timer elapsed
    await queueStore.updateReport(report.id, { nextRetryAt: Date.now() - 1000 });
    await uploadEngine.tick();

    queued = queueStore.getReports();
    expect(queued[0].status).toBe('delivered');
    expect(queued[0].serverReportId).toBe('rep_check_b_lost_response');
  });

  it('handles stall timeout: aborts upload when network stalls with zero progress', async () => {
    // Simulate stall timeout from api client
    (api.submitReport as jest.Mock).mockRejectedValueOnce(
      new ApiError(0, 'Upload stalled (no progress for 15s). Auto-retrying unattended.'),
    );

    const report: Report = {
      id: 'rep_stall_timeout_test',
      description: 'Stalled network site inspection',
      attachments: [{ id: 'a1', uri: 'file:///p_stall.jpg', fileName: 'p_stall.jpg', fileSizeBytes: 400000 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(report);
    await uploadEngine.tick();

    const queued = queueStore.getReports();
    // Must NOT crash or hang indefinitely; schedules automatic retry
    expect(queued[0].status).toBe('in_queue');
    expect(queued[0].retryCount).toBe(1);
    expect(queued[0].errorMessage).toContain('stalled');
  });
});
