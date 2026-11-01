import { Platform } from 'react-native';
import { Attachment, ChaosConfig, ServerReport } from '../domain/types';

// For Android emulator, 10.0.2.2 maps to the host machine localhost.
// If using `adb reverse tcp:3000 tcp:3000`, 'http://localhost:3000' works directly.
const CANDIDATE_HOSTS =
  Platform.OS === 'android'
    ? ['http://localhost:3000', 'http://10.0.2.2:3000', 'http://127.0.0.1:3000']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const DEFAULT_HOST = CANDIDATE_HOSTS[0];

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
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    return data.reports || [];
  }

  async submitReport(
    reportId: string,
    description: string,
    attachments: Attachment[],
    onProgress?: (progressPercent: number) => void,
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

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve({ ok: true, reportId: res.reportId || reportId });
          } catch {
            resolve({ ok: true, reportId });
          }
        } else {
          reject(new Error(`Server error HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network request failed or socket connection dropped.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Request timed out.'));
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
