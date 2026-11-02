import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { BlastRadius, ChaosConfig } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme';

interface ChaosResetModalProps {
  visible: boolean;
  onClose: () => void;
  chaosConfig: ChaosConfig;
  onUpdateChaos: (config: ChaosConfig) => void;
  onExecuteReset: (radius: BlastRadius) => void;
}

export const ChaosResetModal: React.FC<ChaosResetModalProps> = ({
  visible,
  onClose,
  chaosConfig,
  onUpdateChaos,
  onExecuteReset,
}) => {
  const [selectedRadius, setSelectedRadius] = useState<BlastRadius>('local_queue_only');

  const toggleChaos = (key: keyof ChaosConfig) => {
    onUpdateChaos({
      ...chaosConfig,
      [key]: !chaosConfig[key],
    });
  };

  const handleConfirmReset = () => {
    const isFull = selectedRadius === 'full_system_wipe';
    Alert.alert(
      isFull ? 'Confirm complete reset' : 'Confirm phone outbox reset',
      isFull
        ? 'This will clear all reports on this phone and permanently purge all server records and photos. Continue?'
        : 'This will clear waiting reports on this phone only. Server records remain untouched. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isFull ? 'Clear phone and server' : 'Clear phone outbox',
          style: 'destructive',
          onPress: () => onExecuteReset(selectedRadius),
        },
      ],
    );
  };

  const applyPreset = (preset: 'latency' | 'drop' | 'error500' | 'hang' | 'lostResponse' | 'clean') => {
    switch (preset) {
      case 'latency':
        onUpdateChaos({ latencyMs: 3000, dropConnection: false, simulate500: false, hangRequest: false, lostResponse: false });
        break;
      case 'drop':
        onUpdateChaos({ latencyMs: 0, dropConnection: true, simulate500: false, hangRequest: false, lostResponse: false });
        break;
      case 'error500':
        onUpdateChaos({ latencyMs: 0, dropConnection: false, simulate500: true, hangRequest: false, lostResponse: false });
        break;
      case 'hang':
        onUpdateChaos({ latencyMs: 0, dropConnection: false, simulate500: false, hangRequest: true, lostResponse: false });
        break;
      case 'lostResponse':
        onUpdateChaos({ latencyMs: 0, dropConnection: false, simulate500: false, hangRequest: false, lostResponse: true });
        break;
      case 'clean':
        onUpdateChaos({ latencyMs: 0, dropConnection: false, simulate500: false, hangRequest: false, lostResponse: false });
        break;
    }
  };

  const activeChaos: string[] = [];
  if (chaosConfig.latencyMs > 0) activeChaos.push('+3s delay');
  if (chaosConfig.dropConnection) activeChaos.push('Connection drop');
  if (chaosConfig.simulate500) activeChaos.push('HTTP 500 error');
  if (chaosConfig.hangRequest) activeChaos.push('Server never answers');
  if (chaosConfig.lostResponse) activeChaos.push('Lost reply');
  const isHealthy = activeChaos.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal by tapping outside"
        />

        <SafeAreaView
          edges={['bottom']}
          pointerEvents="box-none"
          style={styles.safeAreaContainer}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={styles.sheetContainer}
            pointerEvents="auto">
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.title}>Settings &amp; Network Simulation</Text>
                <Text style={styles.subtitle}>Simulate field network conditions and manage data</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={15}
                accessibilityRole="button"
                accessibilityLabel="Close modal">
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled">
              {/* Section 1: Reset Options */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reset data</Text>
                <Text style={styles.sectionSubtitle}>
                  Choose data to clear:
                </Text>

                <Pressable
                  onPress={() => setSelectedRadius('local_queue_only')}
                  style={[
                    styles.optionCard,
                    selectedRadius === 'local_queue_only' && styles.selectedOption,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedRadius === 'local_queue_only' }}
                  accessibilityLabel="Clear phone outbox only">
                  <View style={styles.radioRow}>
                    <View style={styles.radioOuter}>
                      {selectedRadius === 'local_queue_only' ? (
                        <View style={styles.radioInner} />
                      ) : null}
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionTitle}>Clear phone outbox only</Text>
                      <Text style={styles.optionDesc}>
                        Clears unsubmitted drafts and waiting reports on this phone only. Server reports remain untouched.
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedRadius('full_system_wipe')}
                  style={[
                    styles.optionCard,
                    styles.dangerOption,
                    selectedRadius === 'full_system_wipe' && styles.selectedDangerOption,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedRadius === 'full_system_wipe' }}
                  accessibilityLabel="Clear phone and server">
                  <View style={styles.radioRow}>
                    <View style={[styles.radioOuter, styles.radioDangerOuter]}>
                      {selectedRadius === 'full_system_wipe' ? (
                        <View style={styles.radioDangerInner} />
                      ) : null}
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionTitle, styles.textRed]}>
                        Clear phone and server
                      </Text>
                      <Text style={styles.optionDesc}>
                        Removes all reports and photos from this phone and permanently purges the server archive.
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Button
                  title={selectedRadius === 'full_system_wipe' ? 'Clear phone and server' : 'Clear phone outbox'}
                  variant={selectedRadius === 'full_system_wipe' ? 'danger' : 'secondary'}
                  onPress={handleConfirmReset}
                  style={styles.resetButton}
                />
              </View>

              {/* Section 2: Preset Network Conditions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Simulate network conditions</Text>
                <Text style={styles.sectionSubtitle}>
                  Choose a condition to simulate:
                </Text>

                {/* Status Bar */}
                <View style={[styles.statusBanner, isHealthy ? styles.statusHealthy : styles.statusChaos]}>
                  <Text style={[styles.statusBannerText, isHealthy ? styles.textHealthy : styles.textChaos]}>
                    Status: {isHealthy ? 'Normal connection' : `Active condition: ${activeChaos.join(', ')}`}
                  </Text>
                </View>

                <View style={styles.presetGrid}>
                  <Pressable
                    onPress={() => applyPreset('latency')}
                    style={[styles.presetButton, chaosConfig.latencyMs > 0 && styles.activePresetButton]}
                    accessibilityRole="button"
                    accessibilityLabel="Slow network preset">
                    <Text style={styles.presetButtonTitle}>Slow network (2G delay)</Text>
                    <Text style={styles.presetButtonDesc}>Adds 3 seconds latency to uploads</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('drop')}
                    style={[styles.presetButton, chaosConfig.dropConnection && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Connection drops preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.dropConnection && styles.textRed]}>
                      Connection drops mid-upload
                    </Text>
                    <Text style={styles.presetButtonDesc}>Cuts socket stream during upload</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('error500')}
                    style={[styles.presetButton, chaosConfig.simulate500 && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Server error preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.simulate500 && styles.textRed]}>
                      Server error (HTTP 500)
                    </Text>
                    <Text style={styles.presetButtonDesc}>Server returns a 500 error</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('hang')}
                    style={[styles.presetButton, chaosConfig.hangRequest && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Server never answers preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.hangRequest && styles.textRed]}>
                      Server never answers
                    </Text>
                    <Text style={styles.presetButtonDesc}>Request hangs indefinitely with no response</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('lostResponse')}
                    style={[styles.presetButton, chaosConfig.lostResponse && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Server saves then loses reply preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.lostResponse && styles.textRed]}>
                      Server saves the report, then loses the reply
                    </Text>
                    <Text style={styles.presetButtonDesc}>Server saves report and photos, then severs the socket</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('clean')}
                    style={[styles.presetButton, styles.restorePresetButton, isHealthy && styles.activeRestorePreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Restore normal connection preset">
                    <Text style={styles.restorePresetText}>✓ Restore normal connection</Text>
                    <Text style={styles.presetButtonDesc}>Turn off all simulated conditions</Text>
                  </Pressable>
                </View>
              </View>

              {/* Section 3: Fine-grained switches */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Manual switches</Text>
                <Text style={styles.sectionSubtitle}>
                  Toggle individual conditions:
                </Text>

                <Card style={styles.chaosCard}>
                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Slow network (+3s delay)</Text>
                      <Text style={styles.switchSublabel}>Delays upload response</Text>
                    </View>
                    <Switch
                      value={chaosConfig.latencyMs > 0}
                      onValueChange={() => {
                        onUpdateChaos({
                          ...chaosConfig,
                          latencyMs: chaosConfig.latencyMs > 0 ? 0 : 3000,
                        });
                      }}
                      trackColor={{ false: colors.surfaceActive, true: colors.accentLight }}
                      thumbColor={chaosConfig.latencyMs > 0 ? colors.accentDark : colors.textMuted}
                    />
                  </View>

                  <View style={styles.switchDivider} />

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Connection drops mid-upload</Text>
                      <Text style={styles.switchSublabel}>Closes connection during upload</Text>
                    </View>
                    <Switch
                      value={chaosConfig.dropConnection}
                      onValueChange={() => toggleChaos('dropConnection')}
                      trackColor={{ false: colors.surfaceActive, true: colors.amber }}
                      thumbColor={chaosConfig.dropConnection ? '#FFFFFF' : colors.textMuted}
                    />
                  </View>

                  <View style={styles.switchDivider} />

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Server error (HTTP 500)</Text>
                      <Text style={styles.switchSublabel}>Server returns an error response</Text>
                    </View>
                    <Switch
                      value={chaosConfig.simulate500}
                      onValueChange={() => toggleChaos('simulate500')}
                      trackColor={{ false: colors.surfaceActive, true: colors.amber }}
                      thumbColor={chaosConfig.simulate500 ? '#FFFFFF' : colors.textMuted}
                    />
                  </View>

                  <View style={styles.switchDivider} />

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Server never answers</Text>
                      <Text style={styles.switchSublabel}>Never replies to upload request</Text>
                    </View>
                    <Switch
                      value={chaosConfig.hangRequest}
                      onValueChange={() => toggleChaos('hangRequest')}
                      trackColor={{ false: colors.surfaceActive, true: colors.amber }}
                      thumbColor={chaosConfig.hangRequest ? '#FFFFFF' : colors.textMuted}
                    />
                  </View>

                  <View style={styles.switchDivider} />

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Server saves the report, then loses the reply</Text>
                      <Text style={styles.switchSublabel}>Saves report to disk, then closes socket</Text>
                    </View>
                    <Switch
                      value={chaosConfig.lostResponse}
                      onValueChange={() => toggleChaos('lostResponse')}
                      trackColor={{ false: colors.surfaceActive, true: colors.amber }}
                      thumbColor={chaosConfig.lostResponse ? '#FFFFFF' : colors.textMuted}
                    />
                  </View>
                </Card>
              </View>
            </ScrollView>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  safeAreaContainer: {
    width: '100%',
    maxHeight: '90%',
    zIndex: 10,
    elevation: 20,
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    borderBottomWidth: 0,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 15,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceActive,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderHighlight,
  },
  closeText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  body: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginVertical: spacing.xs,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xs,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  selectedOption: {
    borderColor: colors.accentLight,
    backgroundColor: colors.surfaceElevated,
  },
  dangerOption: {
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  selectedDangerOption: {
    borderColor: colors.amber,
    backgroundColor: colors.amberMuted,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginRight: spacing.md,
  },
  radioDangerOuter: {
    borderColor: colors.amber,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accentLight,
  },
  radioDangerInner: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.amber,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  optionDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  textRed: {
    color: colors.textPrimary,
  },
  resetButton: {
    marginTop: spacing.md,
  },
  statusBanner: {
    padding: spacing.sm,
    borderRadius: radii.xs,
    marginVertical: spacing.xs,
    borderWidth: 1,
  },
  statusHealthy: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderHighlight,
  },
  statusChaos: {
    backgroundColor: colors.amberMuted,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  statusBannerText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  textHealthy: {
    color: colors.textPrimary,
  },
  textChaos: {
    color: colors.amber,
  },
  presetGrid: {
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  presetButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radii.xs,
  },
  activePresetButton: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accentLight,
  },
  activeDangerPreset: {
    backgroundColor: colors.amberMuted,
    borderColor: colors.amber,
  },
  restorePresetButton: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderHighlight,
    marginTop: spacing.xs,
  },
  activeRestorePreset: {
    borderColor: colors.accentLight,
    backgroundColor: colors.surface,
  },
  presetButtonTitle: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  presetButtonDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 10,
  },
  restorePresetText: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  chaosCard: {
    backgroundColor: colors.surface,
    padding: 0,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  switchInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchLabel: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  switchSublabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 10,
  },
  switchDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
