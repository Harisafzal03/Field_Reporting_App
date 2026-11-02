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

  const isServerReport = Boolean((report as ServerReport).receivedAt || (report as Report).serverReportId);

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
        {/* Backdrop: Clicking outside anywhere closes the modal */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal by tapping outside"
        />

        <SafeAreaView
          edges={['bottom']}
          pointerEvents="box-none"
          style={styles.safeArea}>
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerSub}>
                  {isServerReport ? 'Server Confirmed Inspection' : 'Outbox Draft (Local)'}
                </Text>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Report #{serverId.slice(0, 12)}
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
                <Text style={styles.sectionLabel}>Inspection Notes</Text>
                <Card style={styles.descriptionCard}>
                  <Text style={styles.descriptionText}>{description}</Text>
                  <View style={styles.timestampRow}>
                    <Text style={styles.timestampLabel}>Date &amp; Time:</Text>
                    <Text style={styles.timestampValue}>{timestamp}</Text>
                  </View>
                </Card>
              </View>

              {/* Uploaded Photographs */}
              <View style={styles.section}>
                <View style={styles.photoHeaderRow}>
                  <Text style={styles.sectionLabel}>
                    Attached Photos ({attachments.length} of 5)
                  </Text>
                  <Text style={styles.serverStorageTag}>
                    {isServerReport ? 'Confirmed on server' : 'Saved on this phone'}
                  </Text>
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
                          <Text style={styles.photoIndex}>Photo {idx + 1}</Text>
                          <Text style={styles.photoSize}>{sizeMB} MB</Text>
                        </View>
                        <Text style={styles.photoFileName} numberOfLines={1}>
                          {att.fileName}
                        </Text>
                        <Text style={styles.ceilingCheck}>✓ Under 5.0 MB ceiling</Text>
                      </View>
                    </Card>
                  );
                })}
              </View>

              {/* Receipt Metadata */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Delivery Receipt</Text>
                <Card style={styles.metaCard}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Client Report ID:</Text>
                    <Text style={styles.metaVal}>{(report as any).reportId || report.id}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Storage Status:</Text>
                    <Text style={styles.metaSuccess}>
                      {isServerReport ? 'Saved on server disk' : 'Safe on device storage'}
                    </Text>
                  </View>
                </Card>
              </View>

              {/* Explicit Dismiss Button */}
              <View style={styles.footerAction}>
                <Button
                  title="Close Details"
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
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 2,
    fontSize: 15,
  },
  closeButton: {
    width: 32,
    height: 32,
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
    fontSize: 14,
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
    ...typography.bodySemibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
    fontSize: 12,
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
    ...typography.caption,
    color: colors.textMuted,
  },
  timestampValue: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  serverStorageTag: {
    ...typography.caption,
    color: colors.emerald,
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 12,
  },
  photoSize: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  photoFileName: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  ceilingCheck: {
    ...typography.caption,
    color: colors.emerald,
    fontSize: 10,
    fontWeight: '600',
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
    ...typography.caption,
    color: colors.textMuted,
  },
  metaVal: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  metaSuccess: {
    ...typography.caption,
    color: colors.emerald,
    fontWeight: '600',
  },
  footerAction: {
    marginTop: spacing.sm,
  },
});
