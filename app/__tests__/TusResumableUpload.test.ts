import { ApiClient } from '../src/services/api';
import { Attachment } from '../src/domain/types';

describe('Tus Protocol & Resumable Byte-Offset Uploads', () => {
  let client: ApiClient;
  const originalFetch = (globalThis as any).fetch;

  beforeEach(() => {
    client = new ApiClient('http://localhost:3000');
    jest.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('initializes a Tus upload session and queries current server byte offset', async () => {
    const mockAttachment: Attachment = {
      id: 'att_1',
      uri: 'file:///photo_1.jpg',
      fileName: 'foundation_crack.jpg',
      fileSizeBytes: 2000000, // 2.0 MB
    };

    (globalThis as any).fetch = jest.fn().mockImplementation((url, options) => {
      if (url.includes('/uploads/tus') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            uploadId: 'tus_rep_123_0',
            location: '/uploads/tus/tus_rep_123_0',
            offset: 0,
            length: 2000000,
          }),
        });
      }
      if (url.includes('/uploads/tus/tus_rep_123_0') && options?.method === 'HEAD') {
        return Promise.resolve({
          ok: true,
          headers: {
            get: (h: string) => (h.toLowerCase() === 'upload-offset' ? '0' : null),
          },
        });
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    const session = await client.createTusSession('rep_123', 0, mockAttachment);
    expect(session.uploadId).toBe('tus_rep_123_0');
    expect(session.offset).toBe(0);

    const offset = await client.getTusOffset('tus_rep_123_0');
    expect(offset).toBe(0);
  });

  it('resumes from 80% byte-offset when socket drops mid-upload rather than restarting from 0%', async () => {
    const reportId = 'report_tus_resumption_test';
    const attachments: Attachment[] = [
      { id: 'p1', uri: 'file:///p1.jpg', fileName: 'p1.jpg', fileSizeBytes: 1000000 },
      { id: 'p2', uri: 'file:///p2.jpg', fileName: 'p2.jpg', fileSizeBytes: 1000000 },
      { id: 'p3', uri: 'file:///p3.jpg', fileName: 'p3.jpg', fileSizeBytes: 1000000 },
    ];

    // Simulate server state where Photo 1 & 2 are 100% complete, and Photo 3 dropped at 80% (800,000 bytes)
    const serverOffsets: Record<string, number> = {
      [`tus_${reportId}_0`]: 1000000, // 100%
      [`tus_${reportId}_1`]: 1000000, // 100%
      [`tus_${reportId}_2`]: 800000,  // 80% (resumes from 800KB!)
    };

    (globalThis as any).fetch = jest.fn().mockImplementation((url, options) => {
      // POST session initialization
      if (url.includes('/uploads/tus') && options?.method === 'POST') {
        const reportHeader = options.headers['X-Report-Id'];
        const indexHeader = options.headers['X-Attachment-Index'];
        const uploadId = `tus_${reportHeader}_${indexHeader}`;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            uploadId,
            location: `/uploads/tus/${uploadId}`,
            offset: serverOffsets[uploadId] || 0,
            length: 1000000,
          }),
        });
      }

      // HEAD offset query
      if (options?.method === 'HEAD') {
        const uploadId = url.split('/').pop()!;
        const currentOffset = serverOffsets[uploadId] ?? 0;
        return Promise.resolve({
          ok: true,
          headers: {
            get: (h: string) => (h.toLowerCase() === 'upload-offset' ? currentOffset.toString() : null),
          },
        });
      }

      // POST finalize report
      if (url.includes('/reports/finalize') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            report: {
              reportId,
              description: 'Inspected rusted tower',
              receivedAt: new Date().toISOString(),
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    // Spy on uploadTusChunk to verify how many bytes are actually transferred
    const chunkUploadSpy = jest.spyOn(client, 'uploadTusChunk').mockImplementation(
      async (uploadId, attachment, startOffset) => {
        // Only photo 3 should be called, starting strictly from 800,000 bytes!
        expect(uploadId).toBe(`tus_${reportId}_2`);
        expect(startOffset).toBe(800000); // 80% resume offset!
        return attachment.fileSizeBytes; // completed to 1,000,000
      },
    );

    const progressUpdates: any[] = [];
    const result = await client.submitReportResumable(
      reportId,
      'Inspected rusted tower',
      attachments,
      prog => progressUpdates.push(prog),
    );

    expect(result.ok).toBe(true);
    // Verified: uploadTusChunk was ONLY invoked for Photo 3 (photos 1 & 2 were skipped because server already had 100%)
    expect(chunkUploadSpy).toHaveBeenCalledTimes(1);
    expect(chunkUploadSpy).toHaveBeenCalledWith(
      `tus_${reportId}_2`,
      attachments[2],
      800000,
      expect.any(Function),
      15000,
    );

    // Final progress reaches 100%
    const lastProgress = progressUpdates[progressUpdates.length - 1];
    expect(lastProgress.percent).toBe(100);
    expect(lastProgress.bytesSent).toBe(3000000);
  });
});
