import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NetworkSpeed } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme';

interface NetworkPillProps {
  speed: NetworkSpeed;
  bandwidthLabel?: string;
  onPress?: () => void;
}

export const NetworkPill: React.FC<NetworkPillProps> = ({
  speed,
  bandwidthLabel,
  onPress,
}) => {
  const config = {
    online: {
      label: 'Connected',
      dotColor: colors.emerald,
      bgColor: colors.surfaceElevated,
      borderColor: colors.borderHighlight,
    },
    '2g_weak': {
      label: '2G · Weak signal',
      dotColor: colors.amber,
      bgColor: colors.amberMuted,
      borderColor: 'rgba(234, 179, 8, 0.35)',
    },
    offline: {
      label: 'Offline · Paused',
      dotColor: '#9CA3AF',
      bgColor: colors.surfaceElevated,
      borderColor: colors.borderHighlight,
    },
  }[speed];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Network mode: ${config.label}. Tap to inspect status.`}>
      <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      <Text style={styles.label}>{bandwidthLabel || config.label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    marginRight: spacing.xs + 2,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 11,
  },
});
