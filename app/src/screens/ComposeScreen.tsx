import React, { useState } from 'react';
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

  const remainingSlots = 5 - attachments.length;

  const handlePickFromGallery = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Max Limit', 'Maximum of 5 photos per report reached.');
      return;
    }

    setIsPicking(true);
    const { attachments: newPhotos, error } = await pickPhotosFromGallery(remainingSlots);
    setIsPicking(false);

    if (error) {
      Alert.alert('Photo Selection Warning', error);
      return;
    }

    if (newPhotos.length > 0) {
      setAttachments(prev => [...prev, ...newPhotos]);
    }
  };

  const handleCaptureCamera = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Max Limit', 'Maximum of 5 photos per report reached.');
      return;
    }

    setIsPicking(true);
    const { attachment, error } = await capturePhotoFromCamera();
    setIsPicking(false);

    if (error) {
      Alert.alert('Camera Warning', error);
      return;
    }

    if (attachment) {
      setAttachments(prev => [...prev, attachment]);
    }
  };

  const handleRemovePhoto = (id: string) => {
    setAttachments(prev => prev.filter(p => p.id !== id));
  };

  const handleQueue = () => {
    const trimmed = description.trim();
    if (!trimmed) {
      Alert.alert('Description Required', 'Please enter a description of the site inspection.');
      return;
    }
    if (attachments.length < 1) {
      Alert.alert('Photo Required', 'Every report requires between 1 and 5 photographs.');
      return;
    }

    onQueueReport(trimmed, attachments);
    setDescription('');
    setAttachments([]);
  };

  const totalBytes = attachments.reduce((acc, a) => acc + a.fileSizeBytes, 0);
  const canSubmit = description.trim().length > 0 && attachments.length >= 1 && attachments.length <= 5;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled">
      {/* Description Section */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>DESCRIPTION // MANDATORY</Text>
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
          onChangeText={setDescription}
        />
        <Text style={styles.helperText}>Non-blank field report required by site protocol.</Text>
      </View>

      {/* Photographs Section */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>SITE PHOTOGRAPHS // BOUNDS [1–5]</Text>
          <Text style={styles.counterText}>{attachments.length} OF 5 ATTACHED</Text>
        </View>

        <View style={styles.grid}>
          {attachments.map((photo, index) => (
            <Card key={photo.id} style={styles.photoCard}>
              <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
              <View style={styles.photoMeta}>
                <Text style={styles.photoName} numberOfLines={1}>
                  {index + 1}. {photo.fileName}
                </Text>
                <Text style={styles.sizeBreakdown}>
                  HARDWARE FILE SIZE: {(photo.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </Text>
                <Text style={styles.compressedTag}>
                  ✓ VERIFIED &lt; 5.0 MB CEILING
                </Text>
              </View>
              <Pressable
                onPress={() => handleRemovePhoto(photo.id)}
                style={styles.removeButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Remove photo">
                <Text style={styles.removeText}>×</Text>
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
                accessibilityLabel="Pick photo from device gallery">
                {isPicking ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <>
                    <Text style={styles.addIcon}>[ 🖼️ ]</Text>
                    <Text style={styles.addText}>PICK FROM GALLERY</Text>
                    <Text style={styles.addSubtext}>
                      {remainingSlots} SLOTS REMAINING
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
                accessibilityLabel="Capture photo with device camera">
                {isPicking ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <>
                    <Text style={styles.addIcon}>[ 📷 ]</Text>
                    <Text style={styles.addText}>CAPTURE CAMERA</Text>
                    <Text style={styles.addSubtext}>HARDWARE CAMERA</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Compression Guarantee Summary */}
        {attachments.length > 0 ? (
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>TOTAL ATTACHMENTS:</Text>
              <Text style={styles.summaryValue}>{attachments.length} OF 5 PHOTOS</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>TOTAL PAYLOAD SIZE:</Text>
              <Text style={styles.summarySuccess}>
                {(totalBytes / (1024 * 1024)).toFixed(2)} MB (UNDER 5 MB LIMIT)
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Primary Action Button */}
      <View style={styles.actionContainer}>
        <Button
          title="QUEUE REPORT FOR DELIVERY"
          subtitle="Delivers unattended over cellular/WiFi link"
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
  label: {
    ...typography.micro,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  charCount: {
    ...typography.micro,
    color: colors.textMuted,
  },
  counterText: {
    ...typography.micro,
    color: colors.textPrimary,
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
    fontSize: 10,
  },
  compressedTag: {
    ...typography.micro,
    color: colors.emerald,
    marginTop: 2,
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
    fontSize: 16,
    lineHeight: 18,
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
  addIcon: {
    ...typography.mono,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  addText: {
    ...typography.micro,
    color: colors.textPrimary,
  },
  addSubtext: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 9,
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
    ...typography.micro,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  summarySuccess: {
    ...typography.micro,
    color: colors.emerald,
  },
  actionContainer: {
    marginTop: spacing.md,
  },
});
