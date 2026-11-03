import { Attachment, ChaosConfig, ServerReport } from '../domain/types';

// Active public ngrok backend URL for remote and outdoor testing
export const NGROK_HOST = 'https://dd97-103-163-254-137.ngrok-free.app';

// The app is configured to use the ngrok link exclusively
const CANDIDATE_HOSTS = [NGROK_HOST];

const DEFAULT_HOST = NGROK_HOST;

const NGROK_HEADER = { 'ngrok-skip-browser-warning': 'true' };

export class ApiError extends Error {
  status: number;
  isFatal: boolean;
  serverError?: string;

  constructor(status: number, message: string, serverError?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.serverError = serverError;
    // Client errors (400 Bad Request, 413 Payload Too Large, 401, 403, 404, 422)
    // are non-transient and will not succeed on automated retries.
    this.isFatal = status >= 400 && status < 500;
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_HOST) {
    this.baseUrl = baseUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  async resolveActiveBaseUrl(): Promise<string> {
    for (const host of CANDIDATE_HOSTS) {
      try {
        const response = await fetch(`${host}/health`, {
          headers: NGROK_HEADER,
        });
        const data = await response.json();
        if (data.ok) {
          this.baseUrl = host;
          return host;
        }
      } catch {
        // try next candidate
      }
    }
    return this.baseUrl;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: NGROK_HEADER,
      });
      const data = await response.json();
      return Boolean(data.ok);
    } catch {
      // Try resolving alternate host before returning false
      const found = await this.resolveActiveBaseUrl();
      if (found !== this.baseUrl) {
        try {
          const res = await fetch(`${this.baseUrl}/health`, {
            headers: NGROK_HEADER,
          });
          const d = await res.json();
          return Boolean(d.ok);
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async getReports(): Promise<ServerReport[]> {
    const response = await fetch(`${this.baseUrl}/reports`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...NGROK_HEADER,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Server returned status ${response.status}`);
    }

    const data = await response.json();
    return data.reports || [];
  }

  async submitReport(
    reportId: string,
    description: string,
    attachments: Attachment[],
    onProgress?: (progressPercent: number) => void,
    stallTimeoutMs: number = 15000,
  ): Promise<{ ok: boolean; reportId: string }> {
    // Uses FormData for multipart/form-data upload
    const formData = new FormData();
    formData.append('reportId', reportId);
    formData.append('description', description);

    attachments.forEach((att, idx) => {
      formData.append('images', {
        uri: att.uri,
        name: att.fileName || `photo_${idx}.jpg`,
        type: 'image/jpeg',
      } as any);
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/reports`);

      // Idempotency key guarantee: prevents duplicate landings on server
      xhr.setRequestHeader('Idempotency-Key', reportId);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

      let stallTimer: any = null;

      // Stall Timeout rule: Slow is fine, stopped is not.
      // Every time bytes transfer, we reset the timer. Only 15s of 0 progress triggers an abort.
      const resetStallTimer = () => {
        if (stallTimer) {
          clearTimeout(stallTimer);
        }
        stallTimer = setTimeout(() => {
          try {
            xhr.abort();
          } catch { }
          reject(new ApiError(0, 'Upload stalled (no progress for 15s). Auto-retrying unattended.'));
        }, stallTimeoutMs);
      };

      resetStallTimer();

      if (xhr.upload) {
        xhr.upload.onprogress = event => {
          resetStallTimer();
          if (event.lengthComputable && onProgress) {
            const percent = (event.loaded / event.total) * 100;
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (stallTimer) clearTimeout(stallTimer);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve({ ok: true, reportId: res.reportId || reportId });
          } catch {
            resolve({ ok: true, reportId });
          }
        } else {
          let serverMsg = '';
          try {
            const parsed = JSON.parse(xhr.responseText);
            serverMsg = parsed.error || parsed.message || '';
          } catch { }

          const errorText = serverMsg || `Server error HTTP ${xhr.status}: ${xhr.statusText}`;
          reject(new ApiError(xhr.status, errorText, serverMsg));
        }
      };

      xhr.onerror = () => {
        if (stallTimer) clearTimeout(stallTimer);
        reject(new ApiError(0, 'Connection dropped or network unreachable. Safe on this phone.'));
      };

      xhr.onabort = () => {
        if (stallTimer) clearTimeout(stallTimer);
        reject(new ApiError(0, 'Upload stalled with no data transfer. Auto-retrying unattended.'));
      };

      xhr.send(formData);
    });
  }

  // --- Tus Resumable Byte-Offset Methods ---

  async createTusSession(
    reportId: string,
    attachmentIndex: number,
    attachment: Attachment,
  ): Promise<{ uploadId: string; offset: number; length: number }> {
    const response = await fetch(`${this.baseUrl}/uploads/tus`, {
      method: 'POST',
      headers: {
        'Upload-Length': attachment.fileSizeBytes.toString(),
        'X-Report-Id': reportId,
        'X-Attachment-Index': attachmentIndex.toString(),
        'X-File-Name': attachment.fileName || `photo_${attachmentIndex + 1}.jpg`,
        'Tus-Resumable': '1.0.0',
        ...NGROK_HEADER,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Failed to initialize Tus session: ${response.status}`);
    }

    const data = await response.json();
    return {
      uploadId: data.uploadId,
      offset: typeof data.offset === 'number' ? data.offset : 0,
      length: data.length,
    };
  }

  async getTusOffset(uploadId: string): Promise<number> {
    const response = await fetch(`${this.baseUrl}/uploads/tus/${uploadId}`, {
      method: 'HEAD',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Cache-Control': 'no-store',
        ...NGROK_HEADER,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Failed to query Tus offset: ${response.status}`);
    }

    const offsetHeader = response.headers.get('upload-offset');
    return offsetHeader ? parseInt(offsetHeader, 10) : 0;
  }

  async uploadTusChunk(
    uploadId: string,
    attachment: Attachment,
    startOffset: number,
    onChunkProgress?: (bytesTransferred: number) => void,
    stallTimeoutMs: number = 15000,
  ): Promise<number> {
    const totalBytes = attachment.fileSizeBytes;
    if (startOffset >= totalBytes) {
      return totalBytes;
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PATCH', `${this.baseUrl}/uploads/tus/${uploadId}`);
      xhr.setRequestHeader('Upload-Offset', startOffset.toString());
      xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');
      xhr.setRequestHeader('Tus-Resumable', '1.0.0');
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

      let stallTimer: any = null;
      const resetStallTimer = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          try { xhr.abort(); } catch { }
          reject(new ApiError(0, 'Upload stalled (no progress for 15s). Auto-retrying unattended.'));
        }, stallTimeoutMs);
      };

      resetStallTimer();

      if (xhr.upload) {
        xhr.upload.onprogress = (event: any) => {
          resetStallTimer();
          if (event.lengthComputable && onChunkProgress) {
            onChunkProgress(startOffset + event.loaded);
          }
        };
      }

      xhr.onload = () => {
        if (stallTimer) clearTimeout(stallTimer);
        if (xhr.status === 204 || (xhr.status >= 200 && xhr.status < 300)) {
          const offsetHeader = xhr.getResponseHeader('Upload-Offset');
          const newOffset = offsetHeader ? parseInt(offsetHeader, 10) : totalBytes;
          resolve(newOffset);
        } else if (xhr.status === 409) {
          const offsetHeader = xhr.getResponseHeader('Upload-Offset');
          const serverOffset = offsetHeader ? parseInt(offsetHeader, 10) : startOffset;
          reject(new ApiError(409, `Byte-offset conflict. Server at ${serverOffset}`, String(serverOffset)));
        } else {
          reject(new ApiError(xhr.status, `Server error HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        if (stallTimer) clearTimeout(stallTimer);
        reject(new ApiError(0, 'Connection dropped or network unreachable. Safe on this phone.'));
      };

      xhr.onabort = () => {
        if (stallTimer) clearTimeout(stallTimer);
        reject(new ApiError(0, 'Upload stalled with no data transfer. Auto-retrying unattended.'));
      };

      try {
        const remainingBytes = Math.max(0, totalBytes - startOffset);
        const chunk = new Uint8Array(remainingBytes);
        xhr.send(chunk);
      } catch {
        xhr.send(null);
      }
    });
  }

  async finalizeTusReport(
    reportId: string,
    description: string,
    uploadIds: string[],
  ): Promise<{ ok: boolean; reportId: string }> {
    const response = await fetch(`${this.baseUrl}/reports/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': reportId,
        ...NGROK_HEADER,
      },
      body: JSON.stringify({
        reportId,
        description,
        uploadIds,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new ApiError(response.status, errJson.error || `Finalize failed with status ${response.status}`);
    }

    const data = await response.json();
    return { ok: true, reportId: data.report?.reportId || reportId };
  }

  async submitReportResumable(
    reportId: string,
    description: string,
    attachments: Attachment[],
    onProgress?: (overall: {
      bytesSent: number;
      totalBytes: number;
      currentAttachmentIndex: number;
      percent: number;
    }) => void,
    stallTimeoutMs: number = 15000,
  ): Promise<{ ok: boolean; reportId: string }> {
    const totalBytes = attachments.reduce((sum, a) => sum + a.fileSizeBytes, 0);
    const uploadIds: string[] = [];
    const photoOffsets: number[] = new Array(attachments.length).fill(0);

    const reportOverall = (currentPhotoIdx: number) => {
      const bytesSent = photoOffsets.reduce((sum, o) => sum + o, 0);
      const percent = totalBytes > 0 ? Math.min(100, Math.round((bytesSent / totalBytes) * 100)) : 100;
      if (onProgress) {
        onProgress({
          bytesSent,
          totalBytes,
          currentAttachmentIndex: currentPhotoIdx,
          percent,
        });
      }
    };

    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const session = await this.createTusSession(reportId, i, att);
      uploadIds.push(session.uploadId);

      const serverOffset = await this.getTusOffset(session.uploadId);
      photoOffsets[i] = serverOffset;
      reportOverall(i);

      if (serverOffset < att.fileSizeBytes) {
        const newOffset = await this.uploadTusChunk(
          session.uploadId,
          att,
          serverOffset,
          (bytesThisPhoto) => {
            photoOffsets[i] = bytesThisPhoto;
            reportOverall(i);
          },
          stallTimeoutMs,
        );
        photoOffsets[i] = newOffset;
        reportOverall(i);
      }
    }

    return await this.finalizeTusReport(reportId, description, uploadIds);
  }

  async configureChaos(config: ChaosConfig): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/chaos/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADER },
        body: JSON.stringify(config),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async resetServer(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/reports`, {
        method: 'DELETE',
        headers: NGROK_HEADER,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const api = new ApiClient();
