import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReportStatus } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme';

interface ParcelTrackerProps {
  status: ReportStatus;
  retryCount?: number;
}

export const ParcelTracker: React.FC<ParcelTrackerProps> = ({
  status,
  retryCount = 0,
}) => {
  const isDelivered = status === 'delivered';
  const isUploading = status === 'uploading';
  const isRetrying = status === 'in_queue' && retryCount > 0;
  const isWaiting = status === 'in_queue' && retryCount === 0;
  const isFailed = status === 'failed';

  const step2Active = isUploading || isRetrying || isDelivered;
  const step2NeedsAttention = isRetrying || isFailed;

  return (
    <View style={styles.container}>
      <View style={styles.trackRow}>
        {/* Step 1: Saved on phone */}
        <View style={styles.stepNode}>
          <View style={[styles.circle, styles.circleSaved]}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelSaved]}>
            Saved on phone
          </Text>
        </View>

        {/* Connector 1 */}
        <View
          style={[
            styles.line,
            step2Active
              ? step2NeedsAttention
                ? styles.lineAttention
                : styles.lineActive
              : styles.lineInactive,
          ]}
        />

        {/* Step 2: Sending */}
        <View style={styles.stepNode}>
          <View
            style={[
              styles.circle,
              isUploading && styles.circleActive,
              step2NeedsAttention && styles.circleAttention,
              isWaiting && styles.circleWaiting,
            ]}>
            {step2NeedsAttention ? (
              <Text style={styles.attentionIcon}>!</Text>
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  isUploading && styles.stepNumberActive,
                ]}>
                2
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              isUploading && styles.stepLabelActive,
              step2NeedsAttention && styles.stepLabelAttention,
              isWaiting && styles.stepLabelWaiting,
            ]}>
            {step2NeedsAttention
              ? 'Retrying'
              : isUploading
              ? 'Sending...'
              : 'Sending'}
          </Text>
        </View>

        {/* Connector 2 */}
        <View
          style={[
            styles.line,
            styles.lineInactive,
          ]}
        />

        {/* Step 3: On server */}
        <View style={styles.stepNode}>
          <View
            style={[
              styles.circle,
              styles.circleInactive,
            ]}>
            <Text style={styles.stepNumberInactive}>3</Text>
          </View>
          <Text
            style={[
              styles.stepLabel,
              styles.stepLabelInactive,
            ]}>
            On server
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    paddingVertical: spacing.xs,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepNode: {
    alignItems: 'center',
    width: 90,
  },
  line: {
    flex: 1,
    height: 2,
    marginTop: -14,
    marginHorizontal: spacing.xs,
  },
  lineActive: {
    backgroundColor: colors.accentLight,
  },
  lineAttention: {
    backgroundColor: colors.amber,
  },
  lineInactive: {
    backgroundColor: colors.border,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: 4,
  },
  circleSaved: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accentLight,
  },
  circleActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.textPrimary,
  },
  circleAttention: {
    backgroundColor: colors.amberMuted,
    borderColor: colors.amber,
  },
  circleWaiting: {
    borderColor: colors.borderHighlight,
    backgroundColor: colors.surface,
  },
  circleInactive: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  attentionIcon: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepNumberActive: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  stepNumberInactive: {
    fontSize: 10,
    color: colors.textMuted,
  },
  stepLabel: {
    ...typography.micro,
    fontSize: 10,
    textAlign: 'center',
  },
  stepLabelSaved: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stepLabelAttention: {
    color: colors.amber,
    fontWeight: '600',
  },
  stepLabelWaiting: {
    color: colors.textSecondary,
  },
  stepLabelInactive: {
    color: colors.textMuted,
  },
});
