import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card } from '../components/Card';
import { ParcelTracker } from '../components/ParcelTracker';
import { ProgressBar } from '../components/ProgressBar';
import { Report } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme';
import { ReportDetailModal } from './ReportDetailModal';

interface OutboxScreenProps {
  reports: Report[];
  onRetryReport?: (id: string) => void;
}

export const OutboxScreen: React.FC<OutboxScreenProps> = ({
  reports,
  onRetryReport,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'delivered'>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const pendingReports = reports.filter(r => r.status !== 'delivered');
  const deliveredReports = reports.filter(r => r.status === 'delivered');

  const currentList = activeTab === 'pending' ? pendingReports : deliveredReports;

  const renderItem = ({ item }: { item: Report }) => {
    const isUploading = item.status === 'uploading';
    const isFailed = item.status === 'failed';
    const totalSize = item.attachments.reduce((acc, a) => acc + a.fileSizeBytes, 0);
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);

    return (
      <Pressable
        onPress={() => setSelectedReport(item)}
        accessibilityRole="button"
        accessibilityLabel="Inspect report findings and photos">
        <Card style={styles.card} highlighted={isUploading}>
          {/* Photo Thumbnails First with individual status dots */}
          <View style={styles.thumbnailRow}>
            {item.attachments.map((att, idx) => {
              const isDeliveredPhoto = item.status === 'delivered';
              const isSentInBatch =
                item.status === 'uploading' &&
                item.progress &&
                idx < (item.progress.currentAttachmentIndex ?? 0);
              const isCurrentSending =
                item.status === 'uploading' &&
                item.progress &&
                idx === (item.progress.currentAttachmentIndex ?? 0);

              return (
                <View key={att.id || idx} style={styles.thumbWrapper}>
                  <Image source={{ uri: att.uri }} style={styles.thumbImage} />
                  <View
                    style={[
                      styles.thumbStatusBadge,
                      isDeliveredPhoto || isSentInBatch
                        ? styles.thumbSuccess
                        : isCurrentSending
                        ? styles.thumbSending
                        : styles.thumbPending,
                    ]}>
                    <Text style={styles.thumbStatusIcon}>
                      {isDeliveredPhoto || isSentInBatch
                        ? '✓'
                        : isCurrentSending
                        ? '↑'
                        : '●'}
                    </Text>
                  </View>
                </View>
              );
            })}
            <View style={styles.photoCountSummary}>
              <Text style={styles.photoCountText}>
                {item.status === 'delivered'
                  ? `${item.attachments.length} of ${item.attachments.length} arrived`
                  : item.status === 'uploading' && item.progress
                  ? `${Math.min(item.progress.currentAttachmentIndex ?? 0, item.attachments.length)} of ${item.attachments.length} arrived`
                  : `${item.attachments.length} ${item.attachments.length === 1 ? 'photo' : 'photos'}`}
              </Text>
              <Text style={styles.photoSizeText}>{sizeInMB} MB</Text>
            </View>
          </View>

          {/* Three-step Parcel Tracker */}
          <ParcelTracker status={item.status} retryCount={item.retryCount} />

          {/* Description & metadata */}
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.reportId}>Report #{item.id.slice(0, 8)}</Text>
            <Text style={styles.timeText}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {isUploading && item.progress ? (
            <ProgressBar progress={item.progress} />
          ) : null}

          {item.status === 'in_queue' ? (
            <View style={styles.queueNoticeContainer}>
              <View style={styles.offlineNotice}>
                <Text style={styles.noticeText}>
                  {item.retryCount > 0
                    ? `Safe on this phone. Automatic retry #${item.retryCount} in progress.`
                    : 'Safe on this phone. Delivers automatically once signal returns.'}
                </Text>
              </View>
              {item.errorMessage ? (
                <View style={styles.retryBanner}>
                  <Text style={styles.retryBannerText} numberOfLines={2}>
                    {item.errorMessage}
                  </Text>
                  {onRetryReport ? (
                    <Pressable
                      onPress={() => onRetryReport(item.id)}
                      style={styles.retryNowButton}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Retry report upload immediately">
                      <Text style={styles.retryNowText}>Retry Now</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {isFailed ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {item.errorMessage || 'Upload stopped. Action required.'}
              </Text>
              {onRetryReport ? (
                <Pressable
                  onPress={() => onRetryReport(item.id)}
                  style={styles.retryButton}
                  accessibilityRole="button">
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Segmented Tabs */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
          accessibilityRole="tab"
          accessibilityLabel="Pending outbox reports tab">
          <Text
            style={[
              styles.tabText,
              activeTab === 'pending' && styles.activeTabText,
            ]}>
            Outbox ({pendingReports.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'delivered' && styles.activeTab]}
          onPress={() => setActiveTab('delivered')}
          accessibilityRole="tab"
          accessibilityLabel="Delivered reports tab">
          <Text
            style={[
              styles.tabText,
              activeTab === 'delivered' && styles.activeTabText,
            ]}>
            Delivered ({deliveredReports.length})
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={currentList}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'Outbox is Clear' : 'No Delivered Reports'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'pending'
                ? 'All field reports have been delivered to the server.'
                : 'Reports confirmed by the server will appear here.'}
            </Text>
          </View>
        }
      />

      {/* Report Inspection Modal */}
      <ReportDetailModal
        visible={Boolean(selectedReport)}
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderHighlight,
  },
  tabText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    marginBottom: spacing.xs,
  },
  thumbnailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumbImage: {
    width: 44,
    height: 44,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceElevated,
  },
  thumbStatusBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  thumbSuccess: {
    backgroundColor: colors.emerald,
  },
  thumbSending: {
    backgroundColor: colors.blue,
  },
  thumbPending: {
    backgroundColor: colors.textMuted,
  },
  thumbStatusIcon: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  photoCountSummary: {
    marginLeft: spacing.xs,
  },
  photoCountText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  photoSizeText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  description: {
    ...typography.body,
    color: colors.textPrimary,
    marginVertical: spacing.xs,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  reportId: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  timeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  queueNoticeContainer: {
    marginTop: spacing.sm,
  },
  offlineNotice: {
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noticeText: {
    ...typography.caption,
    color: colors.amber,
    fontSize: 12,
  },
  retryBanner: {
    marginTop: spacing.xs,
    padding: spacing.xs + 4,
    backgroundColor: colors.amberMuted,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retryBannerText: {
    ...typography.caption,
    color: colors.amber,
    fontSize: 11,
    flex: 1,
  },
  retryNowButton: {
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs - 2,
    borderRadius: radii.xs,
  },
  retryNowText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  errorContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.redMuted,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.red,
    flex: 1,
    marginRight: spacing.sm,
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: colors.red,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
  },
  retryText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 280,
    fontSize: 12,
  },
});
