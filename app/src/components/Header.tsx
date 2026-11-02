import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NetworkSpeed } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme';
import { NetworkPill } from './NetworkPill';

interface HeaderProps {
  networkSpeed: NetworkSpeed;
  bandwidthLabel?: string;
  onToggleNetwork?: () => void;
  onOpenChaos: () => void;
  pendingCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  networkSpeed,
  bandwidthLabel,
  onToggleNetwork,
  onOpenChaos,
  pendingCount = 0,
}) => {
  const statusSentence =
    pendingCount > 0
      ? `${pendingCount} ${
          pendingCount === 1 ? 'report' : 'reports'
        } waiting for signal. Safe on this phone.`
      : 'Everything is on the server.';

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          <Text style={styles.title}>Field Reports</Text>
          <NetworkPill
            speed={networkSpeed}
            bandwidthLabel={bandwidthLabel}
            onPress={onToggleNetwork}
          />
        </View>
        <Pressable
          onPress={onOpenChaos}
          hitSlop={12}
          style={({ pressed }) => [
            styles.diagButton,
            pressed && styles.diagButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open Chaos and Reset controller">
          <Text style={styles.diagText}>Tools</Text>
          {pendingCount > 0 ? (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{pendingCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Ground-truth sentence banner at top of screen */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  diagButton: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    position: 'relative',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diagButtonPressed: {
    backgroundColor: colors.surfaceActive,
  },
  diagText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 11,
  },
  badgeCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.amber,
    borderRadius: radii.full,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    backgroundColor: colors.emerald,
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
    color: colors.emerald,
    fontWeight: '500',
  },
});
