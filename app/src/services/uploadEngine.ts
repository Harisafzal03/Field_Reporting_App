import { queueStore } from '../queue/queueStore';
import { api } from './api';

export class UploadEngine {
  private isUploading = false;
  private isOffline = false;
  private timer: any = null;
  private onDeliveryListeners = new Set<(reportId: string, serverId: string) => void>();

  constructor() {
    // Default initialized
  }

  start(intervalMs: number = 1000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);
    if (typeof this.timer?.unref === 'function') {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setOffline(offline: boolean): void {
    const changed = this.isOffline !== offline;
    this.isOffline = offline;
    if (changed && !offline) {
      // Came back online: immediately clear any retry delay and upload automatically
      const reports = queueStore.getReports();
      reports.forEach(r => {
        if (r.status === 'in_queue') {
          queueStore.updateReport(r.id, {
            nextRetryAt: undefined,
            errorMessage: undefined,
          });
        }
      });
      this.tick();
    }
  }

  getIsOffline(): boolean {
    return this.isOffline;
  }

  getIsUploading(): boolean {
    return this.isUploading;
  }

  onDelivery(listener: (reportId: string, serverId: string) => void): () => void {
    this.onDeliveryListeners.add(listener);
    return () => {
      this.onDeliveryListeners.delete(listener);
    };
  }

  /**
   * Deterministic tick: checks queue and triggers upload for due item
   */
  async tick(): Promise<void> {
    if (this.isOffline || this.isUploading) {
      return;
    }

    const reports = queueStore.getReports();
    const now = Date.now();

    // Find the next eligible report waiting in queue
    const target = reports.find(
      r => r.status === 'in_queue' && (!r.nextRetryAt || r.nextRetryAt <= now),
    );

    if (!target) {
      return;
    }

    await this.uploadReport(target.id);
  }

  /**
   * Uploads an individual report with full error classification & progress tracking
   */
  async uploadReport(reportId: string): Promise<boolean> {
    const report = queueStore.getReports().find(r => r.id === reportId);
    if (!report || this.isUploading) {
      return false;
    }

    this.isUploading = true;
    const totalBytes = report.attachments.reduce((acc, a) => acc + a.fileSizeBytes, 0);

    // Transition state to 'uploading'
    await queueStore.updateReport(reportId, {
      status: 'uploading',
      progress: {
        bytesSent: 0,
        totalBytes,
        currentAttachmentIndex: 0,
        totalAttachments: report.attachments.length,
        percent: 0,
      },
    });

    try {
      const res = await api.submitReport(
        report.id,
        report.description,
        report.attachments,
        percent => {
          const currentPercent = Math.min(Math.round(percent), 100);
          const bytesSent = Math.round((currentPercent / 100) * totalBytes);
          const currentAttachmentIndex = Math.min(
            report.attachments.length - 1,
            Math.floor((currentPercent / 100) * report.attachments.length),
          );

          queueStore.updateReport(reportId, {
            progress: {
              bytesSent,
              totalBytes,
              currentAttachmentIndex,
              totalAttachments: report.attachments.length,
              percent: currentPercent,
            },
          });
        },
      );

      // Successfully uploaded! Mark as delivered and clear retry timers
      await queueStore.updateReport(reportId, {
        status: 'delivered',
        progress: undefined,
        serverReportId: res.reportId,
        errorMessage: undefined,
        nextRetryAt: undefined,
        updatedAt: Date.now(),
      });

      this.isUploading = false;
      this.onDeliveryListeners.forEach(l => l(reportId, res.reportId));

      // Process next item in queue without waiting for next tick
      this.tick();
      return true;
    } catch (err: any) {
      this.isUploading = false;

      const isFatal =
        Boolean(err?.isFatal) ||
        (typeof err?.status === 'number' && err.status >= 400 && err.status < 500);

      if (isFatal) {
        // FATAL ERROR (e.g. 413 Payload Too Large, 400 Validation Failure)
        // Must stop retrying immediately and display a visible, human reason
        let userMessage = 'Upload rejected by server.';
        if (err?.status === 413) {
          userMessage =
            'Photo exceeds the 5.0 MB destination ceiling. Remove or replace the photo.';
        } else if (err?.status === 400) {
          userMessage =
            err.serverError ||
            err.message ||
            'Report rejected by server validation. Please check details.';
        } else if (err?.message) {
          userMessage = err.message;
        }

        await queueStore.updateReport(reportId, {
          status: 'failed',
          progress: undefined,
          errorMessage: userMessage,
          nextRetryAt: undefined,
          updatedAt: Date.now(),
        });
      } else {
        // TRANSIENT ERROR (Network dropped, Airplane Mode, 5xx server chaos)
        if (this.isOffline) {
          // In Airplane Mode / Offline: keep cleanly in queue ready to upload when signal returns
          await queueStore.updateReport(reportId, {
            status: 'in_queue',
            progress: undefined,
            errorMessage: undefined,
            nextRetryAt: undefined,
            updatedAt: Date.now(),
          });
        } else {
          // Transient error while online (e.g. server chaos 500, socket timeout)
          const newRetryCount = (report.retryCount || 0) + 1;
          const backoffMs = Math.min(3500 * newRetryCount, 30000);

          await queueStore.updateReport(reportId, {
            status: 'in_queue',
            progress: undefined,
            retryCount: newRetryCount,
            nextRetryAt: Date.now() + backoffMs,
            errorMessage:
              err?.message ||
              'Connection dropped mid-flight. Safe on this phone — auto-retrying when signal returns.',
            updatedAt: Date.now(),
          });
        }
      }

      return false;
    }
  }
}

export const uploadEngine = new UploadEngine();
