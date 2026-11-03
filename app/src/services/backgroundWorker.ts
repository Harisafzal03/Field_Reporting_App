import { NativeModules, Platform } from 'react-native';

export class BackgroundWorkerService {
  /**
   * Schedules Android WorkManager to wake up and process queue uploads
   * even if app process is terminated or swiped away from Recents.
   */
  async scheduleBackgroundWork(queueJson?: string, baseUrl?: string): Promise<boolean> {
    const UploadWorkManager = NativeModules?.UploadWorkManager;
    if (Platform.OS === 'android' && UploadWorkManager) {
      try {
        if (queueJson && baseUrl && typeof UploadWorkManager.scheduleUploadWorkWithConfig === 'function') {
          await UploadWorkManager.scheduleUploadWorkWithConfig(queueJson, baseUrl);
        } else {
          await UploadWorkManager.scheduleUploadWork();
        }
        return true;
      } catch (err) {
        console.warn('[BACKGROUND WORKER] Failed to schedule WorkManager:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Retrieves pending queue file updated by native WorkManager while app was killed.
   */
  async getPendingQueue(): Promise<string | null> {
    const UploadWorkManager = NativeModules?.UploadWorkManager;
    if (Platform.OS === 'android' && UploadWorkManager && typeof UploadWorkManager.getPendingQueue === 'function') {
      try {
        return await UploadWorkManager.getPendingQueue();
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Cancels WorkManager background tasks when all pending reports are delivered.
   */
  async cancelBackgroundWork(): Promise<boolean> {
    const UploadWorkManager = NativeModules?.UploadWorkManager;
    if (Platform.OS === 'android' && UploadWorkManager) {
      try {
        await UploadWorkManager.cancelUploadWork();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const backgroundWorker = new BackgroundWorkerService();
