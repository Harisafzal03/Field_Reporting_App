import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReportStatus } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme';

interface StatusBadgeProps {
  status: ReportStatus;
  retryCount?: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, retryCount = 0 }) => {
  const config = {
    saved_local: {
      label: 'SAVED LOCALLY',
      textColor: colors.textSecondary,
      bgColor: colors.surfaceElevated,
      borderColor: colors.border,
    },
    in_queue: {
      label: retryCount > 0 ? `IN QUEUE · RETRY #${retryCount}` : 'QUEUED · AWAITING SIGNAL',
      textColor: colors.amber,
      bgColor: colors.amberMuted,
      borderColor: 'rgba(234, 179, 8, 0.3)',
    },
    uploading: {
      label: 'UPLOADING IN FLIGHT',
      textColor: colors.accentDark,
      bgColor: colors.accentLight,
      borderColor: colors.accentLight,
    },
    delivered: {
      label: 'SERVER CONFIRMED',
      textColor: colors.emerald,
      bgColor: colors.emeraldMuted,
      borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    failed: {
      label: 'FAILED · RETRYING',
      textColor: colors.red,
      bgColor: colors.redMuted,
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
  }[status];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        },
      ]}>
      <Text style={[styles.text, { color: config.textColor }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
    borderRadius: radii.xs,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.micro,
  },
});
