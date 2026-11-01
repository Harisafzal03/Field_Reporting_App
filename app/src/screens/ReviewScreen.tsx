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
            <Text style={styles.serverTag}>SERVER_ID // {item.id.slice(0, 8).toUpperCase()}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>DB_COMMITTED</Text>
            </View>
          </View>

          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.attachmentsRow}>
            <Text style={styles.attachmentsText}>
              PHOTOS: {item.attachments.length} STORED ON DISK
            </Text>
            <Text style={styles.dateText}>
              {new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.inspectHintRow}>
            <Text style={styles.inspectHintText}>[ TAP CARD TO VIEW UPLOADED IMAGES &amp; MESSAGE ]</Text>
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
          <Text style={styles.bannerTitle}>GROUND TRUTH ARCHIVE</Text>
          <Text style={styles.bannerSubtitle}>
            Direct query via GET /reports · Bypasses all local device state
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
            <Text style={styles.refreshText}>SYNC</Text>
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
            <Text style={styles.emptyIcon}>[ 0 ]</Text>
            <Text style={styles.emptyTitle}>SERVER DATABASE EMPTY</Text>
            <Text style={styles.emptySubtitle}>
              Pull down to refresh or check once an outbox job completes its transmission pass.
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
  inspectHintRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inspectHintText: {
    ...typography.micro,
    color: colors.accentLight,
    letterSpacing: 0.5,
  },
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
    ...typography.micro,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  bannerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
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
    ...typography.micro,
    color: colors.textPrimary,
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
    ...typography.mono,
    color: colors.textMuted,
    fontSize: 11,
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
    ...typography.micro,
    color: colors.emerald,
    fontSize: 9,
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
    ...typography.micro,
    color: colors.textSecondary,
  },
  dateText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyIcon: {
    ...typography.mono,
    fontSize: 24,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 280,
  },
});
