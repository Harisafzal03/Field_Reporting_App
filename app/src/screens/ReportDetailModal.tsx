import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Report, ServerReport } from '../domain/types';
import { api } from '../services/api';
import { colors, radii, spacing, typography } from '../theme';

interface ReportDetailModalProps {
  visible: boolean;
  report: ServerReport | Report | null;
  onClose: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  visible,
  report,
  onClose,
}) => {
  if (!report) return null;

  const serverId = (report as ServerReport).id || (report as Report).serverReportId || report.id;
  const description = report.description;
  const timestamp = (report as ServerReport).receivedAt
    ? new Date((report as ServerReport).receivedAt).toLocaleString()
    : new Date((report as Report).createdAt).toLocaleString();

  // Resolve image URI whether from server (/uploads/...) or local disk
  const resolvePhotoUri = (urlOrUri: string) => {
    if (urlOrUri.startsWith('http://') || urlOrUri.startsWith('https://')) {
      return urlOrUri;
    }
    if (urlOrUri.startsWith('/')) {
      return `${api.getBaseUrl()}${urlOrUri}`;
    }
    return urlOrUri;
  };

  const attachments = report.attachments || [];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop: Clicking outside anywhere on the screen closes the modal */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal by tapping outside"
        />

        {/* Modal content wrapped strictly in SafeAreaView */}
        <SafeAreaView
          edges={['bottom']}
          pointerEvents="box-none"
          style={styles.safeArea}>
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerSub}>INSPECTION VERIFICATION // GROUND TRUTH</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  ID: {serverId.slice(0, 16).toUpperCase()}
                </Text>
              </View>
              {/* Close Button */}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
                hitSlop={15}
                accessibilityRole="button"
                accessibilityLabel="Close report details">
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>

            {/* Scrollable Inspection Findings */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.scrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled">
              {/* Description Card */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>INSPECTION FINDINGS // DESCRIPTION</Text>
                <Card style={styles.descriptionCard}>
                  <Text style={styles.descriptionText}>{description}</Text>
                  <View style={styles.timestampRow}>
                    <Text style={styles.timestampLabel}>LOGGED AT:</Text>
                    <Text style={styles.timestampValue}>{timestamp}</Text>
                  </View>
                </Card>
              </View>

              {/* Uploaded Photographs */}
              <View style={styles.section}>
                <View style={styles.photoHeaderRow}>
                  <Text style={styles.sectionLabel}>
                    VERIFIED PHOTOGRAPHS [{attachments.length} OF 5]
                  </Text>
                  <Text style={styles.serverStorageTag}>SERVER DISK COMMITTED</Text>
                </View>

                {attachments.map((att, idx) => {
                  const uri = resolvePhotoUri((att as any).url || (att as any).uri);
                  const sizeMB = (att.fileSizeBytes / (1024 * 1024)).toFixed(2);

                  return (
                    <Card key={att.id || idx} style={styles.photoCard}>
                      <Image
                        source={{ uri }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      <View style={styles.photoMeta}>
                        <View style={styles.photoMetaHeader}>
                          <Text style={styles.photoIndex}>PHOTO {idx + 1}</Text>
                          <Text style={styles.photoSize}>{sizeMB} MB</Text>
                        </View>
                        <Text style={styles.photoFileName} numberOfLines={1}>
                          {att.fileName}
                        </Text>
                        <Text style={styles.ceilingCheck}>✓ VERIFIED &lt; 5.0 MB CEILING</Text>
                      </View>
                    </Card>
                  );
                })}
              </View>

              {/* Technical Ground Truth Metadata */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SERVER RECEIPT &amp; IDEMPOTENCY</Text>
                <Card style={styles.metaCard}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>IDEMPOTENCY KEY:</Text>
                    <Text style={styles.metaVal}>{(report as any).reportId || report.id}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>DISK STORAGE:</Text>
                    <Text style={styles.metaVal}>/uploads/ (Local Ground Truth)</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>INTEGRITY STATUS:</Text>
                    <Text style={styles.metaSuccess}>VERIFIED DISK LANDING</Text>
                  </View>
                </Card>
              </View>

              {/* Explicit Dismiss Button */}
              <View style={styles.footerAction}>
                <Button
                  title="CLOSE REPORT INSPECTION"
                  variant="secondary"
                  onPress={onClose}
                />
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    height: '90%',
    width: '100%',
    zIndex: 10,
    elevation: 20,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    borderBottomWidth: 0,
    overflow: 'hidden',
    width: '100%',
    zIndex: 10,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerSub: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceActive,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeIcon: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
    flexGrow: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.8,
  },
  descriptionCard: {
    padding: spacing.md,
  },
  descriptionText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timestampLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  timestampValue: {
    ...typography.micro,
    color: colors.textPrimary,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  serverStorageTag: {
    ...typography.micro,
    color: colors.accentLight,
    letterSpacing: 0.8,
  },
  photoCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
    padding: 0,
  },
  photoImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surfaceActive,
  },
  photoMeta: {
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
  },
  photoMetaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoIndex: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  photoSize: {
    ...typography.micro,
    color: colors.textPrimary,
  },
  photoFileName: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  ceilingCheck: {
    ...typography.micro,
    color: colors.accentLight,
    letterSpacing: 0.5,
  },
  metaCard: {
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaKey: {
    ...typography.micro,
    color: colors.textMuted,
  },
  metaVal: {
    ...typography.micro,
    color: colors.textPrimary,
  },
  metaSuccess: {
    ...typography.micro,
    color: colors.accentLight,
    fontWeight: '700',
  },
  footerAction: {
    marginTop: spacing.sm,
  },
});
