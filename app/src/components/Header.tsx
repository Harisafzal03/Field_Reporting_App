import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NetworkSpeed } from '../domain/types';
import { colors, spacing, typography } from '../theme';
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
            onLongPress={onOpenChaos}
            delayLongPress={500}
            accessibilityRole="button"
            accessibilityLabel="Field Reports title"
            accessibilityHint="Long press to open settings and reset">
            <Text style={styles.title}>Field Reports</Text>
          </Pressable>
          <NetworkPill
            speed={networkSpeed}
            bandwidthLabel={bandwidthLabel}
            onPress={onToggleNetwork}
          />
        </View>
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
});
