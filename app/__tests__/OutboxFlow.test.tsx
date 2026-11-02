import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { OutboxScreen } from '../src/screens/OutboxScreen';
import { Report } from '../src/domain/types';

describe('End-User Outbox & Delivery Flow', () => {
  const mockOnRetry = jest.fn();

  const samplePendingReport: Report = {
    id: 'report_pending_1',
    description: 'Stairwell electrical conduit inspection',
    attachments: [
      {
        id: 'att_1',
        uri: 'file:///local/photo1.jpg',
        fileName: 'conduit.jpg',
        fileSizeBytes: 1.5 * 1024 * 1024,
      },
    ],
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000,
    status: 'in_queue',
    retryCount: 0,
  };

  const sampleRetryingReport: Report = {
    id: 'report_retrying_2',
    description: 'Basement sump pump test',
    attachments: [
      {
        id: 'att_2',
        uri: 'file:///local/photo2.jpg',
        fileName: 'pump.jpg',
        fileSizeBytes: 2.1 * 1024 * 1024,
      },
    ],
    createdAt: Date.now() - 20000,
    updatedAt: Date.now() - 5000,
    status: 'in_queue',
    retryCount: 2,
    errorMessage: 'Connection dropped mid-flight · Auto-retrying unattended...',
  };

  const sampleUploadingReport: Report = {
    id: 'report_uploading_3',
    description: 'Roof parapet flashing',
    attachments: [
      {
        id: 'att_3',
        uri: 'file:///local/photo3.jpg',
        fileName: 'flashing.jpg',
        fileSizeBytes: 1.8 * 1024 * 1024,
      },
    ],
    createdAt: Date.now() - 30000,
    updatedAt: Date.now(),
    status: 'uploading',
    retryCount: 0,
    progress: {
      bytesSent: 900000,
      totalBytes: 1800000,
      currentAttachmentIndex: 0,
      totalAttachments: 1,
      percent: 50,
    },
  };

  const sampleDeliveredReport: Report = {
    id: 'report_delivered_4',
    description: 'Completed corridor egress clearance verification',
    attachments: [
      {
        id: 'att_4',
        uri: 'file:///local/photo4.jpg',
        fileName: 'corridor.jpg',
        fileSizeBytes: 0.9 * 1024 * 1024,
      },
    ],
    createdAt: Date.now() - 60000,
    updatedAt: Date.now() - 50000,
    status: 'delivered',
    retryCount: 1,
    serverReportId: 'srv_rec_9999',
  };

  let root: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      ReactTestRenderer.act(() => {
        root?.unmount();
      });
      root = null;
    }
  });

  it('renders pending reports with three-step parcel tracker and photo thumbnails first', async () => {
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <OutboxScreen
          reports={[samplePendingReport]}
          onRetryReport={mockOnRetry}
        />,
      );
    });

    const allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Stairwell electrical conduit'))).toBe(true);
    expect(allText.some(t => t.includes('Saved on phone'))).toBe(true);
    expect(allText.some(t => t.includes('Sending'))).toBe(true);
    expect(allText.some(t => t.includes('On server'))).toBe(true);
    expect(allText.some(t => t.includes('Safe on this phone'))).toBe(true);
  });

  it('displays unattended retry attempt and enables immediate manual Retry Now', async () => {
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <OutboxScreen
          reports={[sampleRetryingReport]}
          onRetryReport={mockOnRetry}
        />,
      );
    });

    const allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Retrying'))).toBe(true);
    expect(allText.some(t => t.includes('Automatic retry #2 in progress'))).toBe(true);

    // Find and press the Retry Now button
    const retryNowBtn = root!.root.findByProps({ accessibilityLabel: 'Retry report upload immediately' });
    expect(retryNowBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      retryNowBtn.props.onPress();
    });

    expect(mockOnRetry).toHaveBeenCalledWith('report_retrying_2');
  });

  it('displays real upload progress during in-flight transmission', async () => {
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <OutboxScreen
          reports={[sampleUploadingReport]}
          onRetryReport={mockOnRetry}
        />,
      );
    });

    const allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('50%'))).toBe(true);
    expect(allText.some(t => t.includes('Sending...'))).toBe(true);
  });

  it('switches between pending and delivered tabs cleanly', async () => {
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <OutboxScreen
          reports={[samplePendingReport, sampleDeliveredReport]}
          onRetryReport={mockOnRetry}
        />,
      );
    });

    // In Pending tab: pending report should be present
    let allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Stairwell electrical conduit'))).toBe(true);
    expect(allText.some(t => t.includes('Completed corridor egress'))).toBe(false);

    // Switch to Delivered tab by clicking the tab
    const deliveredTab = root!.root.findByProps({ accessibilityLabel: 'Delivered reports tab' });
    expect(deliveredTab).toBeDefined();
    await ReactTestRenderer.act(async () => {
      deliveredTab.props.onPress();
    });

    // Now delivered report is visible
    allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Completed corridor egress'))).toBe(true);
  });

  it('opens ReportDetailModal when user taps an inspection card', async () => {
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <OutboxScreen
          reports={[samplePendingReport]}
          onRetryReport={mockOnRetry}
        />,
      );
    });

    // Tap report card to inspect
    const reportCard = root!.root.findByProps({ accessibilityLabel: 'Inspect report findings and photos' });
    await ReactTestRenderer.act(async () => {
      reportCard.props.onPress();
    });

    // Detail modal should be visible
    const allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Saved on phone'))).toBe(true);
    expect(allText.some(t => t.includes('Inspection notes'))).toBe(true);
  });
});
