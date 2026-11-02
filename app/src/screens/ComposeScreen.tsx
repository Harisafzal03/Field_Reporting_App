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
import { Card } from '../components/Card';
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
            <Text style={styles.label}>Inspection Notes (Required)</Text>
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
          <Text style={styles.label}>Site Photos (1 to 5 required)</Text>
          <Text style={styles.counterText}>{attachments.length} of 5 attached</Text>
        </View>

        <View style={styles.grid}>
          {attachments.map((photo, index) => (
            <Card key={photo.id} style={styles.photoCard}>
              <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
              <View style={styles.photoMeta}>
                <Text style={styles.photoName} numberOfLines={1}>
                  Photo {index + 1}: {photo.fileName}
                </Text>
                <Text style={styles.sizeBreakdown}>
                  File size: {(photo.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </Text>
                <Text style={styles.compressedTag}>
                  ✓ Under 5.0 MB limit
                </Text>
              </View>
              <Pressable
                onPress={() => handleRemovePhoto(photo.id)}
                style={styles.removeButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Remove photo">
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </Card>
          ))}

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
                  <>
                    <Text style={styles.addText}>Add from Gallery</Text>
                    <Text style={styles.addSubtext}>
                      {remainingSlots} slots available
                    </Text>
                  </>
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
                  <>
                    <Text style={styles.addText}>Take Photo</Text>
                    <Text style={styles.addSubtext}>Device camera</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        {attachments.length > 0 ? (
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total photos:</Text>
              <Text style={styles.summaryValue}>{attachments.length} of 5</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total payload:</Text>
              <Text style={styles.summarySuccess}>
                {(totalBytes / (1024 * 1024)).toFixed(2)} MB (Safe on phone)
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Primary Action Button */}
      <View style={styles.actionContainer}>
        <Button
          title="Save Report to Outbox"
          subtitle="Saved to phone disk · Delivers automatically when signal returns"
          variant="primary"
          onPress={handleQueue}
          disabled={!canSubmit}
        />
      </View>
    </ScrollView>
  );
};

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
    color: colors.emerald,
    fontSize: 10,
    fontWeight: '600',
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
  grid: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceElevated,
  },
  photoMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  photoName: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  sizeBreakdown: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 11,
  },
  compressedTag: {
    ...typography.caption,
    color: colors.emerald,
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
  },
  removeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 14,
  },
  attachButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addSlot: {
    flex: 1,
    minHeight: 70,
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
    marginTop: spacing.md,
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radii.sm,
    gap: 4,
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
  },
  summarySuccess: {
    ...typography.caption,
    color: colors.emerald,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: spacing.md,
  },
});
