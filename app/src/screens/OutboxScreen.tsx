import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

interface DeliveredStampProps {
  receivedTime: string;
  animate: boolean;
  onAnimated?: () => void;
}

const DeliveredStamp: React.FC<DeliveredStampProps> = ({
  receivedTime,
  animate,
  onAnimated,
}) => {
  const scale = useRef(new Animated.Value(animate ? 0.6 : 1)).current;
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (animate) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimated?.();
      });
    }
  }, [animate, opacity, scale, onAnimated]);

  return (
    <Animated.View
      style={[
        styles.deliveredStamp,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}>
      <Text style={styles.deliveredStampText}>
        Received{' '}
        <Text style={{ fontVariant: ['tabular-nums'] }}>{receivedTime}</Text>
      </Text>
    </Animated.View>
  );
};

export const OutboxScreen: React.FC<OutboxScreenProps> = ({
  reports,
  onRetryReport,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'delivered'>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const prevStatusesRef = useRef<Record<string, string>>({});
  const newlyDeliveredIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    reports.forEach(r => {
      const prev = prevStatusesRef.current[r.id];
      if (prev && prev !== 'delivered' && r.status === 'delivered') {
        newlyDeliveredIdsRef.current.add(r.id);
      }
      prevStatusesRef.current[r.id] = r.status;
    });
  }, [reports]);

  const pendingReports = reports.filter(r => r.status !== 'delivered');
  const deliveredReports = reports.filter(r => r.status === 'delivered');

  const currentList = activeTab === 'pending' ? pendingReports : deliveredReports;
  const pendingCount = pendingReports.length;

  const statusSentence =
    pendingCount > 0
      ? `${pendingCount} ${
          pendingCount === 1 ? 'report' : 'reports'
        } waiting for signal. Safe on this phone.`
      : 'Everything is on the server.';

  const renderItem = ({ item }: { item: Report }) => {
    const isDelivered = item.status === 'delivered';
    const isUploading = item.status === 'uploading';
    const isFailed = item.status === 'failed';
    const totalSize = item.attachments.reduce((acc, a) => acc + a.fileSizeBytes, 0);
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    const shortRef = '#' + (item.serverReportId || item.id).slice(0, 6).toUpperCase();
    const timeFormatted = new Date(item.createdAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    const receivedTimeStr = new Date(item.updatedAt || item.createdAt).toLocaleTimeString(
      [],
      { hour: 'numeric', minute: '2-digit' },
    );
    const isNewlyDelivered = newlyDeliveredIdsRef.current.has(item.id);

    if (isDelivered) {
      return (
        <Pressable
          onPress={() => setSelectedReport(item)}
          accessibilityRole="button"
          accessibilityLabel="Inspect delivered report details">
          <Card style={styles.card}>
            {/* 1. Description first on delivered cards */}
            <Text style={styles.deliveredDescription} numberOfLines={3}>
              {item.description}
            </Text>

            {/* 2. Received stamp (animated once if transitioned, static otherwise) */}
            <DeliveredStamp
              receivedTime={receivedTimeStr}
              animate={isNewlyDelivered}
              onAnimated={() => newlyDeliveredIdsRef.current.delete(item.id)}
            />

            {/* 3. Photos row */}
            <View style={styles.thumbnailRow}>
              {item.attachments.map((att, idx) => (
                <View key={att.id || idx} style={styles.thumbWrapper}>
                  <Image source={{ uri: att.uri }} style={styles.thumbImage} />
                  <View style={[styles.thumbStatusBadge, styles.thumbSuccess]}>
                    <Text style={styles.thumbStatusIcon}>✓</Text>
                  </View>
                </View>
              ))}
              <View style={styles.photoCountSummary}>
                <Text style={styles.photoCountText}>
                  {item.attachments.length}{' '}
                  {item.attachments.length === 1 ? 'photo' : 'photos'}
                </Text>
                <Text style={[styles.photoSizeText, { fontVariant: ['tabular-nums'] }]}>
                  {sizeInMB} MB
                </Text>
              </View>
            </View>

            {/* 4. Short reference and time */}
            <View style={styles.metaRow}>
              <Text style={[styles.reportId, { fontVariant: ['tabular-nums'] }]}>
                {shortRef}
              </Text>
              <Text style={[styles.timeText, { fontVariant: ['tabular-nums'] }]}>
                {timeFormatted}
              </Text>
            </View>
          </Card>
        </Pressable>
      );
    }

    // Moving report card (in_queue, uploading, failed)
    return (
      <Pressable
        onPress={() => setSelectedReport(item)}
        accessibilityRole="button"
        accessibilityLabel="Inspect report findings and photos">
        <Card style={styles.card} highlighted={isUploading}>
          {/* Photo Thumbnails First */}
          <View style={styles.thumbnailRow}>
            {item.attachments.map((att, idx) => {
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
                      isSentInBatch
                        ? styles.thumbNeutralDone
                        : isCurrentSending
                        ? styles.thumbSending
                        : styles.thumbPending,
                    ]}>
                    <Text style={styles.thumbStatusIcon}>
                      {isSentInBatch ? '✓' : isCurrentSending ? '↑' : '●'}
                    </Text>
                  </View>
                </View>
              );
            })}
            <View style={styles.photoCountSummary}>
              <Text style={styles.photoCountText}>
                {item.status === 'uploading' && item.progress
                  ? `${Math.min(
                      item.progress.currentAttachmentIndex ?? 0,
                      item.attachments.length,
                    )} of ${item.attachments.length} arrived`
                  : `${item.attachments.length} ${
                      item.attachments.length === 1 ? 'photo' : 'photos'
                    }`}
              </Text>
              <Text style={[styles.photoSizeText, { fontVariant: ['tabular-nums'] }]}>
                {sizeInMB} MB
              </Text>
            </View>
          </View>

          {/* Three-step Parcel Tracker shown ONLY on reports still moving */}
          <ParcelTracker status={item.status} retryCount={item.retryCount} />

          {/* Description */}
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Reference & time */}
          <View style={styles.metaRow}>
            <Text style={[styles.reportId, { fontVariant: ['tabular-nums'] }]}>
              {shortRef}
            </Text>
            <Text style={[styles.timeText, { fontVariant: ['tabular-nums'] }]}>
              {timeFormatted}
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
      {/* One-sentence status banner shown ONLY on Outbox screen */}
      <View style={styles.bannerRow}>
        <View
          style={[
            styles.statusDot,
            pendingCount > 0 ? styles.dotWaiting : styles.dotCalm,
          ]}
        />
        <Text
          style={[
            styles.bannerText,
            pendingCount > 0 ? styles.bannerWaiting : styles.bannerCalm,
          ]}>
          {statusSentence}
        </Text>
      </View>

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
              {activeTab === 'pending' ? 'Outbox is clear' : 'No delivered reports'}
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
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs + 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
  },
  dotWaiting: {
    backgroundColor: colors.amber,
  },
  dotCalm: {
    backgroundColor: colors.accentLight,
  },
  bannerText: {
    ...typography.caption,
    fontSize: 12,
  },
  bannerWaiting: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  bannerCalm: {
    color: colors.textSecondary,
    fontWeight: '500',
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
  deliveredDescription: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  deliveredStamp: {
    alignSelf: 'flex-start',
    backgroundColor: colors.emeraldMuted,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    marginBottom: spacing.sm,
  },
  deliveredStampText: {
    ...typography.caption,
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 11,
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
  thumbNeutralDone: {
    backgroundColor: colors.accentLight,
  },
  thumbSending: {
    backgroundColor: colors.accentLight,
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
    backgroundColor: colors.amberMuted,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.amber,
    flex: 1,
    marginRight: spacing.sm,
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: colors.amber,
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
