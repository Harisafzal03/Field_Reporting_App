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
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          <Pressable
            onPress={onOpenChaos}
            onLongPress={onOpenChaos}
            delayLongPress={500}
            accessibilityRole="button"
            accessibilityLabel="Field Reports title"
            accessibilityHint="Tap or long press to open settings and reset">
            <Text style={styles.title}>Field Reports</Text>
          </Pressable>
          <NetworkPill
            speed={networkSpeed}
            bandwidthLabel={bandwidthLabel}
            onPress={onToggleNetwork}
          />
        </View>

        <Pressable
          onPress={onOpenChaos}
          style={({ pressed }) => [
            styles.resetBtn,
            pressed && styles.resetBtnPressed,
          ]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open reset and chaos settings">
          <Text style={styles.resetBtnText}>Reset</Text>
        </Pressable>
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
    paddingVertical: spacing.md,
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
  resetBtn: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  resetBtnPressed: {
    backgroundColor: colors.surfaceActive,
  },
  resetBtnText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
});
