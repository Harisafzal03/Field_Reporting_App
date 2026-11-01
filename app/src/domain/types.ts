export type NetworkSpeed = 'online' | '2g_weak' | 'offline';

export type ReportStatus =
  | 'saved_local'
  | 'in_queue'
  | 'uploading'
  | 'delivered'
  | 'failed';

export interface Attachment {
  id: string;
  uri: string;
  fileName: string;
  fileSizeBytes: number;
  originalSizeBytes?: number;
  width?: number;
  height?: number;
}

export interface UploadProgress {
  bytesSent: number;
  totalBytes: number;
  currentAttachmentIndex: number;
  totalAttachments: number;
  percent: number;
}

export interface Report {
  id: string; // Client UUID v4 for idempotency
  description: string;
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
  status: ReportStatus;
  retryCount: number;
  nextRetryAt?: number;
  progress?: UploadProgress;
  errorMessage?: string;
  serverReportId?: string;
}

export interface ServerReport {
  id: string;
  reportId: string;
  description: string;
  attachments: {
    id: string;
    fileName: string;
    fileSizeBytes: number;
    url: string;
  }[];
  receivedAt: string;
}

export type BlastRadius = 'local_queue_only' | 'full_system_wipe';

export interface ChaosConfig {
  latencyMs: number;
  dropConnection: boolean;
  simulate500: boolean;
  hangRequest: boolean;
}
