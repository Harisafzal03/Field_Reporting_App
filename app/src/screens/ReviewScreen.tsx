import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card } from '../components/Card';
import { ServerReport } from '../domain/types';
import { api } from '../services/api';
import { colors, radii, spacing, typography } from '../theme';
import { ReportDetailModal } from './ReportDetailModal';

interface ReviewScreenProps {
  serverReports: ServerReport[];
  loading: boolean;
  onRefresh: () => void;
}

export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  serverReports,
  loading,
  onRefresh,
}) => {
  const [selectedReport, setSelectedReport] = useState<ServerReport | null>(null);
  const [lastFetchedTime, setLastFetchedTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  );

  useEffect(() => {
    setLastFetchedTime(
      new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    );
  }, [serverReports]);

  const handleManualRefresh = () => {
    setLastFetchedTime(
      new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    );
    onRefresh();
  };

  const renderItem = ({ item }: { item: ServerReport }) => {
    const shortRef = '#' + (item.reportId || item.id).slice(0, 6).toUpperCase();
    const receivedTime = new Date(item.receivedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

    const firstPhoto = item.attachments && item.attachments.length > 0 ? item.attachments[0] : null;
    const photoUri = firstPhoto
      ? firstPhoto.url.startsWith('http://') || firstPhoto.url.startsWith('https://')
        ? firstPhoto.url
        : `${api.getBaseUrl()}${firstPhoto.url}`
      : null;

    return (
      <Pressable
        onPress={() => setSelectedReport(item)}
        accessibilityRole="button"
        accessibilityLabel="Inspect report findings and uploaded images">
        <Card style={styles.card}>
          <View style={styles.cardContentRow}>
            {/* 1. First photo as thumbnail loaded from the server */}
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Text style={styles.placeholderText}>No photo</Text>
              </View>
            )}

            <View style={styles.cardDetails}>
              {/* 2. Description as title */}
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.description}
              </Text>

              {/* 3. Short reference and 4. Received <time> */}
              <View style={styles.metaRow}>
                <Text style={[styles.shortRef, { fontVariant: ['tabular-nums'] }]}>
                  {shortRef}
                </Text>
                <Text style={styles.receivedStamp}>
                  Received{' '}
                  <Text style={{ fontVariant: ['tabular-nums'] }}>{receivedTime}</Text>
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Server Review Header Banner with dynamic fetch time */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerTitle}>Server review</Text>
          <Text style={[styles.bannerSubtitle, { fontVariant: ['tabular-nums'] }]}>
            Fetched from the server at {lastFetchedTime}
          </Text>
        </View>
        <Pressable
          onPress={handleManualRefresh}
          style={({ pressed }) => [
            styles.refreshBtn,
            pressed && styles.refreshBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Refresh server reports">
          {loading ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.refreshText}>Sync</Text>
          )}
        </Pressable>
      </View>

      <FlatList
        data={serverReports}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleManualRefresh}
            tintColor={colors.accentLight}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Server database empty</Text>
            <Text style={styles.emptySubtitle}>
              Pull down to refresh or check once an outbox report completes uploading.
            </Text>
          </View>
        }
      />

      {/* Inspect Uploaded Report Modal */}
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
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bannerLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  bannerTitle: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  bannerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  refreshBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  refreshBtnPressed: {
    backgroundColor: colors.surfaceActive,
  },
  refreshText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    marginBottom: spacing.xs,
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 9,
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shortRef: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  receivedStamp: {
    ...typography.caption,
    color: colors.emerald,
    fontSize: 11,
    fontWeight: '600',
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
