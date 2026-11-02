import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { Attachment } from '../domain/types';
import { draftStore } from '../queue/draftStore';
import {
  capturePhotoFromCamera,
  pickPhotosFromGallery,
} from '../services/imagePicker';
import { colors, radii, spacing, typography } from '../theme';

interface ComposeScreenProps {
  onQueueReport: (description: string, attachments: Attachment[]) => void;
}

export const ComposeScreen: React.FC<ComposeScreenProps> = ({
  onQueueReport,
}) => {
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ uri: string; title?: string } | null>(null);

  // Load existing in-progress draft on cold start (recovers after app killed in background)
  useEffect(() => {
    let isMounted = true;
    draftStore.loadDraft().then(draft => {
      if (isMounted && draft) {
        if (draft.description) {
          setDescription(draft.description);
        }
        if (draft.attachments && draft.attachments.length > 0) {
          setAttachments(draft.attachments);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const remainingSlots = 5 - attachments.length;

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    draftStore.saveDraft({ description: text, attachments });
  };

  const handlePickFromGallery = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', 'Maximum of 5 photos per report allowed.');
      return;
    }

    setIsPicking(true);
    const { attachments: newPhotos, error } = await pickPhotosFromGallery(remainingSlots);
    setIsPicking(false);

    if (error) {
      Alert.alert('Photo Selection', error);
      return;
    }

    if (newPhotos.length > 0) {
      const updated = [...attachments, ...newPhotos];
      setAttachments(updated);
      draftStore.saveDraft({ description, attachments: updated });
    }
  };

  const handleCaptureCamera = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', 'Maximum of 5 photos per report allowed.');
      return;
    }

    setIsPicking(true);
    const { attachment, error } = await capturePhotoFromCamera();
    setIsPicking(false);

    if (error) {
      Alert.alert('Camera', error);
      return;
    }

    if (attachment) {
      const updated = [...attachments, attachment];
      setAttachments(updated);
      draftStore.saveDraft({ description, attachments: updated });
    }
  };

  const handleRemovePhoto = (id: string) => {
    const updated = attachments.filter(p => p.id !== id);
    setAttachments(updated);
    draftStore.saveDraft({ description, attachments: updated });
  };

  const handleQueue = async () => {
    const trimmed = description.trim();
    if (!trimmed) {
      Alert.alert('Description Required', 'Please enter inspection findings.');
      return;
    }
    if (attachments.length < 1) {
      Alert.alert('Photos Required', 'Please attach between 1 and 5 photos.');
      return;
    }

    onQueueReport(trimmed, attachments);
    setDescription('');
    setAttachments([]);
    await draftStore.clearDraft();
  };

  const totalBytes = attachments.reduce((acc, a) => acc + a.fileSizeBytes, 0);
  const canSubmit = description.trim().length > 0 && attachments.length >= 1 && attachments.length <= 5;
  const hasDraft = description.length > 0 || attachments.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled">
      {/* Description Section */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <View style={styles.labelGroup}>
            <Text style={styles.label}>Inspection notes (required)</Text>
            {hasDraft ? (
              <Text style={styles.draftBadge}>Draft saved on phone</Text>
            ) : null}
          </View>
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>
        <TextInput
          style={styles.textArea}
          placeholder="Enter site inspection findings..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          maxLength={500}
          value={description}
          onChangeText={handleDescriptionChange}
        />
        <Text style={styles.helperText}>Required notes describing equipment, hazard, or site condition.</Text>
      </View>

      {/* Photographs Section */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Site photos (1 to 5 required)</Text>
          <Text style={styles.counterText}>{attachments.length} of 5 photos</Text>
        </View>

        {/* Attached Photos Thumbnail Grid */}
        {attachments.length > 0 ? (
          <View style={styles.thumbnailGrid}>
            {attachments.map((photo) => (
              <View key={photo.id} style={styles.gridItem}>
                <Pressable
                  onPress={() => setPreviewPhoto({ uri: photo.uri, title: photo.fileName })}
                  accessibilityRole="button"
                  accessibilityLabel="View photo full size">
                  <Image source={{ uri: photo.uri }} style={styles.gridThumbnail} />
                </Pressable>
                <Pressable
                  onPress={() => handleRemovePhoto(photo.id)}
                  style={styles.gridRemoveBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo">
                  <Text style={styles.gridRemoveText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {remainingSlots > 0 ? (
          <View style={styles.attachButtonsRow}>
            <Pressable
              onPress={handlePickFromGallery}
              disabled={isPicking}
              style={({ pressed }) => [
                styles.addSlot,
                pressed && styles.addSlotPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add photos from gallery">
              {isPicking ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <View style={styles.slotContent}>
                  <GalleryIcon />
                  <Text style={styles.addText}>Add from gallery</Text>
                  <Text style={styles.addSubtext}>
                    {remainingSlots} slots available
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={handleCaptureCamera}
              disabled={isPicking}
              style={({ pressed }) => [
                styles.addSlot,
                pressed && styles.addSlotPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Take photo with camera">
              {isPicking ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <View style={styles.slotContent}>
                  <CameraIcon />
                  <Text style={styles.addText}>Take photo</Text>
                  <Text style={styles.addSubtext}>Device camera</Text>
                </View>
              )}
            </Pressable>
          </View>
        ) : null}

        {attachments.length > 0 ? (
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total payload:</Text>
              <Text style={styles.summaryValue}>
                {(totalBytes / (1024 * 1024)).toFixed(2)} MB
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Primary Action Button */}
      <View style={styles.actionContainer}>
        <Button
          title="Save report to outbox"
          variant="primary"
          onPress={handleQueue}
          disabled={!canSubmit}
        />
        {!canSubmit ? (
          <Text style={styles.missingHint}>
            {!description.trim() && attachments.length === 0
              ? 'Add notes and at least 1 photo'
              : !description.trim()
              ? 'Add notes'
              : 'Add at least 1 photo'}
          </Text>
        ) : null}
      </View>

      <ImageViewerModal
        visible={Boolean(previewPhoto)}
        imageUri={previewPhoto?.uri || null}
        title={previewPhoto?.title}
        onClose={() => setPreviewPhoto(null)}
      />
    </ScrollView>
  );
};

/* Drawn Icons using plain Views (no extra icon libraries) */
const GalleryIcon = () => (
  <View style={iconStyles.galleryFrame}>
    <View style={iconStyles.gallerySun} />
    <View style={iconStyles.galleryHills}>
      <View style={iconStyles.galleryPeak1} />
      <View style={iconStyles.galleryPeak2} />
    </View>
  </View>
);

const CameraIcon = () => (
  <View style={iconStyles.cameraWrapper}>
    <View style={iconStyles.cameraFlash} />
    <View style={iconStyles.cameraBody}>
      <View style={iconStyles.cameraLens} />
    </View>
  </View>
);

const iconStyles = StyleSheet.create({
  galleryFrame: {
    width: 24,
    height: 20,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
    backgroundColor: colors.surfaceElevated,
  },
  gallerySun: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textPrimary,
    position: 'absolute',
    top: 3,
    right: 4,
  },
  galleryHills: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  galleryPeak1: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.textPrimary,
  },
  galleryPeak2: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.textPrimary,
    marginLeft: -5,
  },
  cameraWrapper: {
    width: 24,
    height: 20,
    alignItems: 'center',
    marginBottom: 4,
  },
  cameraFlash: {
    width: 7,
    height: 3,
    backgroundColor: colors.textPrimary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  cameraBody: {
    width: 24,
    height: 16,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLens: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  draftBadge: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '500',
  },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  counterText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  textArea: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  gridItem: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridThumbnail: {
    width: '100%',
    height: '100%',
  },
  gridRemoveBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridRemoveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  attachButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addSlot: {
    flex: 1,
    minHeight: 76,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderHighlight,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  addSlotPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  slotContent: {
    alignItems: 'center',
  },
  addText: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  addSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 11,
  },
  summaryBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.caption,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  actionContainer: {
    marginTop: spacing.md,
  },
  missingHint: {
    ...typography.caption,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: spacing.xs + 2,
    fontSize: 12,
  },
});
