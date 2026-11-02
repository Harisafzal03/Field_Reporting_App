import AsyncStorage from '@react-native-async-storage/async-storage';
import { Report } from '../domain/types';

export const QUEUE_STORAGE_KEY = '@field_reports_persistent_queue_v1';

class QueueStore {
  private reports: Report[] = [];
  private listeners = new Set<(reports: Report[]) => void>();
  private initialized = false;

  /**
   * Cold start hydration:
   * Loads the persistent reports array from device disk.
   * If any report was left in 'uploading' state when the app was killed/force-stopped,
   * it is safely reset to 'in_queue' so it will resume cleanly.
   */
  async loadQueueFromDisk(): Promise<Report[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed: Report[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Reset any in-flight uploading state that was interrupted by process kill
          this.reports = parsed.map(r => {
            if (r.status === 'uploading') {
              return {
                ...r,
                status: 'in_queue',
                progress: undefined,
              };
            }
            return r;
          });
          this.initialized = true;
          this.notify();
          return this.getReports();
        }
      }
    } catch (err) {
      console.warn('[QueueStore] Failed to read queue from disk:', err);
    }
    this.reports = [];
    this.initialized = true;
    this.notify();
    return [];
  }

  /**
   * Persists the current queue state to device disk (AsyncStorage)
   */
  async saveQueueToDisk(newReports: Report[]): Promise<void> {
    this.reports = newReports;
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.reports));
    } catch (err) {
      console.error('[QueueStore] Failed to write queue to disk:', err);
    }
    this.notify();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getReports(): Report[] {
    return [...this.reports];
  }

  async enqueueReport(report: Report): Promise<void> {
    const updated = [report, ...this.reports];
    await this.saveQueueToDisk(updated);
  }

  async updateReport(id: string, updates: Partial<Report>): Promise<void> {
    const updated = this.reports.map(r =>
      r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r,
    );
    await this.saveQueueToDisk(updated);
  }

  async removeReport(id: string): Promise<void> {
    const updated = this.reports.filter(r => r.id !== id);
    await this.saveQueueToDisk(updated);
  }

  async clearQueue(): Promise<void> {
    this.reports = [];
    try {
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    } catch (err) {
      console.error('[QueueStore] Failed to clear disk queue:', err);
    }
    this.notify();
  }

  subscribe(listener: (reports: Report[]) => void): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.getReports());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getReports();
    this.listeners.forEach(listener => {
      try {
        listener(current);
      } catch (err) {
        console.error('[QueueStore] Listener error:', err);
      }
    });
  }
}

export const queueStore = new QueueStore();
