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
  return (
    <View style={styles.header}>
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
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
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
    ...typography.micro,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  badgeCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.accentLight,
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
    color: colors.accentDark,
  },
});
