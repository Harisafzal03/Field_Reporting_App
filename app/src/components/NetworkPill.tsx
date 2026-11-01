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
      label: '4G/WIFI · FAST',
      dotColor: colors.textPrimary,
      bgColor: colors.surfaceElevated,
      borderColor: colors.borderHighlight,
    },
    '2g_weak': {
      label: '2G LINK · SLOW',
      dotColor: colors.amber,
      bgColor: colors.amberMuted,
      borderColor: 'rgba(234, 179, 8, 0.35)',
    },
    offline: {
      label: 'OFFLINE · PAUSED',
      dotColor: colors.red,
      bgColor: colors.redMuted,
      borderColor: 'rgba(239, 68, 68, 0.35)',
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
      accessibilityLabel={`Network mode: ${config.label}. Tap to toggle.`}>
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
    ...typography.micro,
    color: colors.textPrimary,
  },
});
