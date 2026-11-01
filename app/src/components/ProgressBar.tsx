import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UploadProgress } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme';

interface ProgressBarProps {
  progress?: UploadProgress;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (!progress) return null;

  const { percent, currentAttachmentIndex, totalAttachments, bytesSent, totalBytes } = progress;
  const safePercent = Math.min(100, Math.max(0, percent));

  const formatMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.metaText}>
          PHOTO {currentAttachmentIndex + 1}/{totalAttachments} · {formatMB(bytesSent)} OF {formatMB(totalBytes)}
        </Text>
        <Text style={styles.percentText}>{Math.round(safePercent)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safePercent}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metaText: {
    ...typography.micro,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  percentText: {
    ...typography.micro,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  track: {
    height: 4,
    backgroundColor: colors.surfaceActive,
    borderRadius: radii.none,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accentLight,
  },
});
