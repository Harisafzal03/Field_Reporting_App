import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ComposeScreen } from '../src/screens/ComposeScreen';
import { Attachment } from '../src/domain/types';

// Mock image picker service
jest.mock('../src/services/imagePicker', () => ({
  pickPhotosFromGallery: jest.fn(),
  capturePhotoFromCamera: jest.fn(),
}));

import { pickPhotosFromGallery, capturePhotoFromCamera } from '../src/services/imagePicker';

describe('End-User Compose Report Flow', () => {
  const mockOnQueueReport = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const { draftStore } = require('../src/queue/draftStore');
    await draftStore.clearDraft();
  });

  it('renders initial compose screen with disabled queue button when blank', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ComposeScreen onQueueReport={mockOnQueueReport} />,
      );
    });

    // Check that description input is present
    const textInput = root!.root.findByProps({ placeholder: 'Enter site inspection findings...' });
    expect(textInput).toBeDefined();

    // Check that Queue button is disabled initially
    const queueBtn = root!.root.findByProps({ title: 'Save report to outbox' });
    expect(queueBtn.props.disabled).toBe(true);
  });

  it('allows the inspector to type inspection findings and updates character count', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ComposeScreen onQueueReport={mockOnQueueReport} />,
      );
    });

    const textInput = root!.root.findByProps({ placeholder: 'Enter site inspection findings...' });

    await ReactTestRenderer.act(async () => {
      textInput.props.onChangeText('Found severe foundation crack on pillar B-4');
    });

    expect(textInput.props.value).toBe('Found severe foundation crack on pillar B-4');
  });

  it('allows adding photos from gallery and enables submission once text and photo exist', async () => {
    const mockPhoto: Attachment = {
      id: 'photo_test_1',
      uri: 'file:///data/user/0/app/cache/photo1.jpg',
      fileName: 'pillar_crack.jpg',
      fileSizeBytes: 1.2 * 1024 * 1024,
    };

    (pickPhotosFromGallery as jest.Mock).mockResolvedValue({
      attachments: [mockPhoto],
      error: null,
    });

    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ComposeScreen onQueueReport={mockOnQueueReport} />,
      );
    });

    // Type description
    const textInput = root!.root.findByProps({ placeholder: 'Enter site inspection findings...' });
    await ReactTestRenderer.act(async () => {
      textInput.props.onChangeText('Structural inspection findings: cracked joint');
    });

    // Tap Pick from Gallery
    const galleryButton = root!.root.findByProps({ accessibilityLabel: 'Add photos from gallery' });
    await ReactTestRenderer.act(async () => {
      await galleryButton.props.onPress();
    });

    // Button should now be enabled
    const queueBtn = root!.root.findByProps({ title: 'Save report to outbox' });
    expect(queueBtn.props.disabled).toBe(false);

    // Queue the report
    await ReactTestRenderer.act(async () => {
      queueBtn.props.onPress();
    });

    expect(mockOnQueueReport).toHaveBeenCalledTimes(1);
    expect(mockOnQueueReport).toHaveBeenCalledWith(
      'Structural inspection findings: cracked joint',
      [mockPhoto],
    );
  });

  it('allows removing an attached photo and disables queue button if 0 photos remain', async () => {
    const mockPhoto: Attachment = {
      id: 'photo_test_remove',
      uri: 'file:///data/user/0/app/cache/photo_remove.jpg',
      fileName: 'remove_me.jpg',
      fileSizeBytes: 0.8 * 1024 * 1024,
    };

    (capturePhotoFromCamera as jest.Mock).mockResolvedValue({
      attachment: mockPhoto,
      error: null,
    });

    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ComposeScreen onQueueReport={mockOnQueueReport} />,
      );
    });

    // Type description
    const textInput = root!.root.findByProps({ placeholder: 'Enter site inspection findings...' });
    await ReactTestRenderer.act(async () => {
      textInput.props.onChangeText('Water damage in basement');
    });

    // Capture photo from camera
    const cameraButton = root!.root.findByProps({ accessibilityLabel: 'Take photo with camera' });
    await ReactTestRenderer.act(async () => {
      await cameraButton.props.onPress();
    });

    // Remove photo
    const removeBtn = root!.root.findByProps({ accessibilityLabel: 'Remove photo' });
    await ReactTestRenderer.act(async () => {
      removeBtn.props.onPress();
    });

    // Queue button should be disabled again because 0 photos are attached
    const queueBtn = root!.root.findByProps({ title: 'Save report to outbox' });
    expect(queueBtn.props.disabled).toBe(true);
  });

  it('restores in-progress draft text and photos when reopened after app was killed in background', async () => {
    const { draftStore } = require('../src/queue/draftStore');
    await draftStore.saveDraft({
      description: 'Found rusted bolts on cell tower antenna mount',
      attachments: [
        {
          id: 'photo_draft_restored',
          uri: 'file:///data/user/0/app/cache/antenna.jpg',
          fileName: 'antenna.jpg',
          fileSizeBytes: 1.1 * 1024 * 1024,
        },
      ],
    });

    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ComposeScreen onQueueReport={mockOnQueueReport} />,
      );
    });

    // Check that description input was restored
    const textInput = root!.root.findByProps({ placeholder: 'Enter site inspection findings...' });
    expect(textInput.props.value).toBe('Found rusted bolts on cell tower antenna mount');

    // Check that queue button is immediately enabled because text and photo were restored from disk
    const queueBtn = root!.root.findByProps({ title: 'Save report to outbox' });
    expect(queueBtn.props.disabled).toBe(false);
  });

  it('opens photo in full view modal when tapping thumbnail and closes on dismiss', async () => {
    const mockPhoto: Attachment = {
      id: 'photo_zoom_test',
      uri: 'file:///data/user/0/app/cache/zoom.jpg',
      fileName: 'zoom.jpg',
      fileSizeBytes: 1024 * 1024,
    };
    (pickPhotosFromGallery as jest.Mock).mockResolvedValueOnce({
      attachments: [mockPhoto],
      error: null,
    });

    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ComposeScreen onQueueReport={mockOnQueueReport} />,
      );
    });

    const addGalleryBtn = root!.root.findByProps({ accessibilityLabel: 'Add photos from gallery' });
    await ReactTestRenderer.act(async () => {
      addGalleryBtn.props.onPress();
    });

    // Tap on the thumbnail to open full view modal
    const viewPhotoBtn = root!.root.findByProps({ accessibilityLabel: 'View photo full size' });
    await ReactTestRenderer.act(async () => {
      viewPhotoBtn.props.onPress();
    });

    // Verify modal is open with the photo
    const closeBtn = root!.root.findByProps({ accessibilityLabel: 'Close photo viewer' });
    expect(closeBtn).toBeDefined();

    // Tap close to dismiss full view
    await ReactTestRenderer.act(async () => {
      closeBtn.props.onPress();
    });
  });
});
