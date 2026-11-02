import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card } from '../components/Card';
import { ServerReport } from '../domain/types';
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
  const [selectedReport, setSelectedReport] = React.useState<ServerReport | null>(null);

  const renderItem = ({ item }: { item: ServerReport }) => {
    return (
      <Pressable
        onPress={() => setSelectedReport(item)}
        accessibilityRole="button"
        accessibilityLabel="Inspect report findings and uploaded images">
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.serverTag}>Server Record #{item.id.slice(0, 8)}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Confirmed on server</Text>
            </View>
          </View>

          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.attachmentsRow}>
            <Text style={styles.attachmentsText}>
              {item.attachments.length} {item.attachments.length === 1 ? 'photo' : 'photos'} saved on server
            </Text>
            <Text style={styles.dateText}>
              {new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.inspectHintRow}>
            <Text style={styles.inspectHintText}>Tap card to view details &amp; photos</Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Ground Truth Strip */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerTitle}>Server Archive</Text>
          <Text style={styles.bannerSubtitle}>
            Reports confirmed by the server database
          </Text>
        </View>
        <Pressable
          onPress={onRefresh}
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
            onRefresh={onRefresh}
            tintColor={colors.accentLight}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Server Database Empty</Text>
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
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.surface,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  serverTag: {
    ...typography.bodySemibold,
    color: colors.textSecondary,
    fontSize: 12,
  },
  verifiedBadge: {
    backgroundColor: colors.emeraldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  verifiedText: {
    ...typography.caption,
    color: colors.emerald,
    fontSize: 10,
    fontWeight: '600',
  },
  description: {
    ...typography.body,
    color: colors.textPrimary,
    marginVertical: spacing.xs,
  },
  attachmentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachmentsText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  inspectHintRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inspectHintText: {
    ...typography.caption,
    color: colors.accentLight,
    fontSize: 11,
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
