import { PermissionsAndroid, Platform } from 'react-native';
import {
  Asset,
  ImageLibraryOptions,
  CameraOptions,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { Attachment } from '../domain/types';

// Hard 5 MB ceiling at destination
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const DEFAULT_OPTIONS: ImageLibraryOptions & CameraOptions = {
  mediaType: 'photo',
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.8, // Downscale camera raw 18 MB photos down to ~1.2-2.5 MB
  includeBase64: false,
};

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (alreadyGranted) {
      return true;
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission Required',
        message:
          'Field Reports requires access to the device camera to take site inspection photos.',
        buttonPositive: 'ALLOW',
        buttonNegative: 'DENY',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function resolveAssetSize(uri: string, reportedSize?: number): Promise<number> {
  if (reportedSize && reportedSize > 0) {
    return reportedSize;
  }
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    if (blob.size > 0) {
      return blob.size;
    }
  } catch {
    // If blob cannot be read, attempt size approximation or return 0
  }
  return 0;
}

async function assetToAttachment(asset: Asset, index: number): Promise<Attachment | null> {
  if (!asset.uri) return null;

  const fileSize = await resolveAssetSize(asset.uri, asset.fileSize);
  const ext =
    asset.type?.split('/')[1] ||
    (asset.fileName?.includes('.') ? asset.fileName.split('.').pop() : 'jpg');
  const fileName =
    asset.fileName ||
    `inspection_${Date.now()}_${index + 1}.${ext}`;

  return {
    id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    uri: asset.uri,
    fileName,
    fileSizeBytes: fileSize,
    originalSizeBytes: asset.fileSize && asset.fileSize > fileSize ? asset.fileSize : undefined,
    width: asset.width,
    height: asset.height,
  };
}

export async function pickPhotosFromGallery(
  remainingSlots: number,
): Promise<{ attachments: Attachment[]; error?: string }> {
  try {
    const result = await launchImageLibrary({
      ...DEFAULT_OPTIONS,
      selectionLimit: Math.min(5, remainingSlots),
    });

    if (result.didCancel || !result.assets || result.assets.length === 0) {
      return { attachments: [] };
    }

    if (result.errorMessage) {
      return { attachments: [], error: result.errorMessage };
    }

    const attachments: Attachment[] = [];
    for (let i = 0; i < result.assets.length; i++) {
      const asset = result.assets[i];
      if (!asset.uri) continue;

      const realSize = await resolveAssetSize(asset.uri, asset.fileSize);
      if (realSize > MAX_FILE_SIZE_BYTES) {
        return {
          attachments: [],
          error: `Selected image "${asset.fileName || i + 1}" exceeds the 5.0 MB destination ceiling (${(realSize / (1024 * 1024)).toFixed(2)} MB).`,
        };
      }
      const att = await assetToAttachment(asset, i);
      if (att) attachments.push(att);
    }

    return { attachments };
  } catch (err: any) {
    return { attachments: [], error: err.message || 'Failed to open gallery' };
  }
}

export async function capturePhotoFromCamera(): Promise<{
  attachment: Attachment | null;
  error?: string;
}> {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return {
        attachment: null,
        error:
          'Camera permission is required to take inspection photos. Please grant camera access.',
      };
    }

    const result = await launchCamera({
      ...DEFAULT_OPTIONS,
      saveToPhotos: false, // Prevents public DCIM permission blocks on Android
      cameraType: 'back',
    });

    if (result.didCancel) {
      return { attachment: null };
    }

    if (result.errorCode) {
      return {
        attachment: null,
        error: `Camera unavailable (${result.errorCode}): ${result.errorMessage || 'Unable to open camera app'}`,
      };
    }

    if (!result.assets || result.assets.length === 0) {
      return { attachment: null };
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return { attachment: null };
    }

    const realSize = await resolveAssetSize(asset.uri, asset.fileSize);
    if (realSize > MAX_FILE_SIZE_BYTES) {
      return {
        attachment: null,
        error: `Captured photo exceeds 5.0 MB ceiling (${(realSize / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }

    const attachment = await assetToAttachment(asset, 0);
    return { attachment };
  } catch (err: any) {
    return { attachment: null, error: err.message || 'Failed to launch camera' };
  }
}
