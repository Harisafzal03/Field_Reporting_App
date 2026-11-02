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
      isFull ? 'Confirm Full System Wipe' : 'Confirm Local Queue Reset',
      isFull
        ? 'This will clear all outbox reports on this phone AND permanently purge all server database records and uploaded photos. Continue?'
        : 'This will clear pending reports on this phone only. Server records remain untouched. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isFull ? 'Purge Entire System' : 'Wipe Local Only',
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
  if (chaosConfig.latencyMs > 0) activeChaos.push(`+${chaosConfig.latencyMs}ms delay`);
  if (chaosConfig.dropConnection) activeChaos.push('Connection drop');
  if (chaosConfig.simulate500) activeChaos.push('HTTP 500 error');
  if (chaosConfig.hangRequest) activeChaos.push('Gateway timeout');
  if (chaosConfig.lostResponse) activeChaos.push('Lost response (reply killed)');
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
                <Text style={styles.title}>Diagnostics &amp; Fault Simulation</Text>
                <Text style={styles.subtitle}>Test network faults and system resets</Text>
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
              {/* Section 1: Reset Blast Radius */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reset Boundaries</Text>
                <Text style={styles.sectionSubtitle}>
                  Select the scope of data to clear:
                </Text>

                {/* Option 1: Local Queue Only */}
                <Pressable
                  onPress={() => setSelectedRadius('local_queue_only')}
                  style={[
                    styles.optionCard,
                    selectedRadius === 'local_queue_only' && styles.selectedOption,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel="Radio Local Queue Only"
                  accessibilityState={{ selected: selectedRadius === 'local_queue_only' }}>
                  <View style={styles.radioRow}>
                    <View style={styles.radioOuter}>
                      {selectedRadius === 'local_queue_only' ? (
                        <View style={styles.radioInner} />
                      ) : null}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>Local Queue Only</Text>
                      <Text style={styles.optionDesc}>
                        Wipes in-flight queue and drafts on this phone. Server records remain untouched.
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* Option 2: Full System Wipe */}
                <Pressable
                  onPress={() => setSelectedRadius('full_system_wipe')}
                  style={[
                    styles.optionCard,
                    styles.dangerOption,
                    selectedRadius === 'full_system_wipe' && styles.selectedDangerOption,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel="Radio Full System Wipe"
                  accessibilityState={{ selected: selectedRadius === 'full_system_wipe' }}>
                  <View style={styles.radioRow}>
                    <View style={[styles.radioOuter, styles.radioDangerOuter]}>
                      {selectedRadius === 'full_system_wipe' ? (
                        <View style={[styles.radioInner, styles.radioDangerInner]} />
                      ) : null}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, styles.dangerTitle]}>
                        Full System Wipe (Local + Server)
                      </Text>
                      <Text style={styles.optionDesc}>
                        Wipes local phone outbox AND issues HTTP DELETE /reports to purge all server records and stored photos.
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Button
                  title={
                    selectedRadius === 'full_system_wipe'
                      ? 'Execute Full System Wipe'
                      : 'Execute Local Queue Reset'
                  }
                  variant={selectedRadius === 'full_system_wipe' ? 'danger' : 'secondary'}
                  onPress={handleConfirmReset}
                  style={styles.resetButton}
                />
              </View>

              {/* Section 2: Preset Fault Conditions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preset Test Conditions</Text>
                <Text style={styles.sectionSubtitle}>
                  Simulate field connectivity conditions:
                </Text>

                {/* Status Bar */}
                <View style={[styles.statusBanner, isHealthy ? styles.statusHealthy : styles.statusChaos]}>
                  <Text style={[styles.statusBannerText, isHealthy ? styles.textHealthy : styles.textChaos]}>
                    Link condition: {isHealthy ? 'Healthy (no faults injected)' : `Fault active: ${activeChaos.join(', ')}`}
                  </Text>
                </View>

                <View style={styles.presetGrid}>
                  <Pressable
                    onPress={() => applyPreset('latency')}
                    style={[styles.presetButton, chaosConfig.latencyMs > 0 && styles.activePresetButton]}
                    accessibilityRole="button"
                    accessibilityLabel="Test Case 1 2G Latency Preset">
                    <Text style={styles.presetButtonTitle}>Test 1: 2G Latency (+3000ms delay)</Text>
                    <Text style={styles.presetButtonDesc}>Simulates slow 2G cell connection</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('drop')}
                    style={[styles.presetButton, chaosConfig.dropConnection && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Test Case 2 Drop Socket Preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.dropConnection && styles.textRed]}>
                      Test 2: Drop Connection (Sever TCP stream)
                    </Text>
                    <Text style={styles.presetButtonDesc}>Simulates signal drop mid-flight</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('error500')}
                    style={[styles.presetButton, chaosConfig.simulate500 && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Test Case 3 HTTP 500 Error Preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.simulate500 && styles.textRed]}>
                      Test 3: HTTP 500 Error (Server failure)
                    </Text>
                    <Text style={styles.presetButtonDesc}>Simulates server side errors</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('hang')}
                    style={[styles.presetButton, chaosConfig.hangRequest && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Test Case 4 Hang Timeout Preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.hangRequest && styles.textRed]}>
                      Test 4: Hang / Timeout (Unresponsive)
                    </Text>
                    <Text style={styles.presetButtonDesc}>Simulates frozen gateway</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('lostResponse')}
                    style={[styles.presetButton, chaosConfig.lostResponse && styles.activeDangerPreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Test Case B Lost Response Preset">
                    <Text style={[styles.presetButtonTitle, chaosConfig.lostResponse && styles.textRed]}>
                      Test B: Lost Response (Save report, kill reply)
                    </Text>
                    <Text style={styles.presetButtonDesc}>Saves to disk &amp; DB, then severs socket before 201 reply</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('clean')}
                    style={[styles.presetButton, styles.restorePresetButton, isHealthy && styles.activeRestorePreset]}
                    accessibilityRole="button"
                    accessibilityLabel="Restore Healthy Network Preset">
                    <Text style={styles.restorePresetText}>✓ Restore Healthy Network</Text>
                    <Text style={styles.presetButtonDesc}>Clear all simulated faults</Text>
                  </Pressable>
                </View>
              </View>

              {/* Section 3: Fine-grained Chaos Switches */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Manual Fault Switches</Text>
                <Text style={styles.sectionSubtitle}>
                  Toggle individual backend conditions:
                </Text>

                <Card style={styles.chaosCard}>
                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>2G Latency (+3000ms)</Text>
                      <Text style={styles.switchSublabel}>Delays POST /reports response</Text>
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
                      <Text style={styles.switchLabel}>Drop Connection Mid-Upload</Text>
                      <Text style={styles.switchSublabel}>Abruptly closes socket during upload</Text>
                    </View>
                    <Switch
                      value={chaosConfig.dropConnection}
                      onValueChange={() => toggleChaos('dropConnection')}
                      trackColor={{ false: colors.surfaceActive, true: colors.red }}
                      thumbColor={chaosConfig.dropConnection ? '#FFFFFF' : colors.textMuted}
                    />
                  </View>

                  <View style={styles.switchDivider} />

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Return HTTP 500 Error</Text>
                      <Text style={styles.switchSublabel}>Server responds with HTTP 500</Text>
                    </View>
                    <Switch
                      value={chaosConfig.simulate500}
                      onValueChange={() => toggleChaos('simulate500')}
                      trackColor={{ false: colors.surfaceActive, true: colors.red }}
                      thumbColor={chaosConfig.simulate500 ? '#FFFFFF' : colors.textMuted}
                    />
                  </View>

                  <View style={styles.switchDivider} />

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Hang Request / Gateway Timeout</Text>
                      <Text style={styles.switchSublabel}>Never replies to upload request</Text>
                    </View>
                    <Switch
                      value={chaosConfig.hangRequest}
                      onValueChange={() => toggleChaos('hangRequest')}
                      trackColor={{ false: colors.surfaceActive, true: colors.red }}
                      thumbColor={chaosConfig.hangRequest ? '#FFFFFF' : colors.textMuted}
                    />
                  </View>

                  <View style={styles.switchDivider} />

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Lost Response (Kill Reply Socket)</Text>
                      <Text style={styles.switchSublabel}>Saves report to disk, then closes socket without sending 201</Text>
                    </View>
                    <Switch
                      value={chaosConfig.lostResponse}
                      onValueChange={() => toggleChaos('lostResponse')}
                      trackColor={{ false: colors.surfaceActive, true: colors.red }}
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
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  selectedDangerOption: {
    borderColor: colors.red,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
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
    borderColor: colors.red,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accentLight,
  },
  radioDangerInner: {
    backgroundColor: colors.red,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  dangerTitle: {
    color: colors.red,
  },
  optionDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  resetButton: {
    marginTop: spacing.md,
  },
  chaosCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
  },
  switchDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  statusBanner: {
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.md,
    borderRadius: radii.xs,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  statusHealthy: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusChaos: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusBannerText: {
    ...typography.caption,
    fontSize: 11,
  },
  textHealthy: {
    color: colors.emerald,
    fontWeight: '600',
  },
  textChaos: {
    color: colors.red,
    fontWeight: '600',
  },
  presetGrid: {
    gap: spacing.xs + 2,
  },
  presetButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  activePresetButton: {
    borderColor: colors.accentLight,
    backgroundColor: colors.surfaceElevated,
  },
  activeDangerPreset: {
    borderColor: colors.red,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  restorePresetButton: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    marginTop: spacing.xs,
  },
  activeRestorePreset: {
    borderColor: colors.emerald,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  presetButtonTitle: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  restorePresetText: {
    ...typography.bodySemibold,
    color: colors.emerald,
    fontSize: 12,
  },
  textRed: {
    color: colors.red,
  },
  presetButtonDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 11,
  },
});
