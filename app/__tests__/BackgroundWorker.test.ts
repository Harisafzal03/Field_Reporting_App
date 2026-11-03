import { NativeModules, Platform } from 'react-native';
import { queueStore } from '../src/queue/queueStore';
import { backgroundWorker } from '../src/services/backgroundWorker';
import { Report } from '../src/domain/types';

describe('Background Headless Service & WorkManager Integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await queueStore.clearQueue();
  });

  it('schedules Android WorkManager when reports are in the queue', async () => {
    // Mock Android platform and native UploadWorkManager module
    Platform.OS = 'android';
    const mockSchedule = jest.fn().mockResolvedValue(true);
    const mockCancel = jest.fn().mockResolvedValue(true);

    NativeModules.UploadWorkManager = {
      scheduleUploadWork: mockSchedule,
      cancelUploadWork: mockCancel,
    };

    const scheduled = await backgroundWorker.scheduleBackgroundWork();
    expect(scheduled).toBe(true);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('cancels Android WorkManager when queue is empty or cleared', async () => {
    Platform.OS = 'android';
    const mockCancel = jest.fn().mockResolvedValue(true);

    NativeModules.UploadWorkManager = {
      scheduleUploadWork: jest.fn().mockResolvedValue(true),
      cancelUploadWork: mockCancel,
    };

    const cancelled = await backgroundWorker.cancelBackgroundWork();
    expect(cancelled).toBe(true);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('automatically triggers WorkManager schedule on report enqueue and cancel on clearQueue', async () => {
    Platform.OS = 'android';
    const mockSchedule = jest.fn().mockResolvedValue(true);
    const mockCancel = jest.fn().mockResolvedValue(true);

    NativeModules.UploadWorkManager = {
      scheduleUploadWork: mockSchedule,
      cancelUploadWork: mockCancel,
    };

    const testReport: Report = {
      id: 'rep_workmanager_test',
      description: 'Hazard on site',
      attachments: [{ id: 'att_1', uri: 'file:///photo.jpg', fileName: 'photo.jpg', fileSizeBytes: 1000 }],
      status: 'in_queue',
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Enqueue report -> should schedule WorkManager for unattended process termination survival
    await queueStore.enqueueReport(testReport);
    expect(mockSchedule).toHaveBeenCalled();

    // Clear queue -> should cancel WorkManager
    await queueStore.clearQueue();
    expect(mockCancel).toHaveBeenCalled();
  });
});
