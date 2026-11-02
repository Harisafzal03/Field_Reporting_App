import { Platform } from 'react-native';
import { Attachment, ChaosConfig, ServerReport } from '../domain/types';

// For Android emulator, 10.0.2.2 maps to the host machine localhost.
// If using `adb reverse tcp:3000 tcp:3000`, 'http://localhost:3000' works directly.
const CANDIDATE_HOSTS =
  Platform.OS === 'android'
    ? ['http://localhost:3000', 'http://10.0.2.2:3000', 'http://127.0.0.1:3000']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const DEFAULT_HOST = CANDIDATE_HOSTS[0];

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
        const response = await fetch(`${host}/health`);
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
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return Boolean(data.ok);
    } catch {
      // Try resolving alternate host before returning false
      const found = await this.resolveActiveBaseUrl();
      if (found !== this.baseUrl) {
        try {
          const res = await fetch(`${this.baseUrl}/health`);
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
          } catch {}
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
          } catch {}

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

  async configureChaos(config: ChaosConfig): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/chaos/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const api = new ApiClient();
