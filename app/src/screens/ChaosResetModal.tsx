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
      isFull ? 'CONFIRM COMPLETE SYSTEM WIPE' : 'CONFIRM LOCAL QUEUE RESET',
      isFull
        ? 'DANGER: This will wipe all device outbox reports AND permanently purge the server database and all uploaded photographs from disk. Continue?'
        : 'This will clear all pending in-flight reports and drafts on this device. Server records remain untouched. Continue?',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: isFull ? 'PURGE ENTIRE SYSTEM' : 'WIPE LOCAL ONLY',
          style: 'destructive',
          onPress: () => onExecuteReset(selectedRadius),
        },
      ],
    );
  };

  const applyPreset = (preset: 'latency' | 'drop' | 'error500' | 'hang' | 'clean') => {
    switch (preset) {
      case 'latency':
        onUpdateChaos({ latencyMs: 3000, dropConnection: false, simulate500: false, hangRequest: false });
        break;
      case 'drop':
        onUpdateChaos({ latencyMs: 0, dropConnection: true, simulate500: false, hangRequest: false });
        break;
      case 'error500':
        onUpdateChaos({ latencyMs: 0, dropConnection: false, simulate500: true, hangRequest: false });
        break;
      case 'hang':
        onUpdateChaos({ latencyMs: 0, dropConnection: false, simulate500: false, hangRequest: true });
        break;
      case 'clean':
        onUpdateChaos({ latencyMs: 0, dropConnection: false, simulate500: false, hangRequest: false });
        break;
    }
  };

  const activeChaos: string[] = [];
  if (chaosConfig.latencyMs > 0) activeChaos.push(`+${chaosConfig.latencyMs}ms LATENCY`);
  if (chaosConfig.dropConnection) activeChaos.push('SOCKET DROP');
  if (chaosConfig.simulate500) activeChaos.push('HTTP 500');
  if (chaosConfig.hangRequest) activeChaos.push('HANG REQUEST');
  const isHealthy = activeChaos.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop: Clicking outside anywhere on the darkened screen closes the modal */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal by tapping outside"
        />

        {/* Sheet layer: Elevated above backdrop with Safe Area protection */}
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
                <Text style={styles.title}>CHAOS // SYSTEM PROTOCOLS</Text>
                <Text style={styles.subtitle}>Fault injection &amp; blast radius controls</Text>
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
                <Text style={styles.sectionTitle}>DELIBERATE RESET // BLAST RADIUS</Text>
                <Text style={styles.sectionSubtitle}>
                  Choose the boundary blast radius before executing reset:
                </Text>

                {/* Option 1: Local Queue Only */}
                <Pressable
                  onPress={() => setSelectedRadius('local_queue_only')}
                  style={[
                    styles.optionCard,
                    selectedRadius === 'local_queue_only' && styles.selectedOption,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedRadius === 'local_queue_only' }}>
                  <View style={styles.radioRow}>
                    <View style={styles.radioOuter}>
                      {selectedRadius === 'local_queue_only' ? (
                        <View style={styles.radioInner} />
                      ) : null}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>LOCAL QUEUE ONLY</Text>
                      <Text style={styles.optionDesc}>
                        Wipes in-flight queue, drafts, and temp cache on this device. Verified server records remain untouched.
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
                  accessibilityState={{ selected: selectedRadius === 'full_system_wipe' }}>
                  <View style={styles.radioRow}>
                    <View style={[styles.radioOuter, styles.radioDangerOuter]}>
                      {selectedRadius === 'full_system_wipe' ? (
                        <View style={[styles.radioInner, styles.radioDangerInner]} />
                      ) : null}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, styles.dangerTitle]}>
                        FULL SYSTEM WIPE (LOCAL + SERVER DISK)
                      </Text>
                      <Text style={styles.optionDesc}>
                        Wipes local device queue AND issues HTTP DELETE /reports to purge all server records and delete uploaded images from disk.
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Button
                  title={
                    selectedRadius === 'full_system_wipe'
                      ? 'EXECUTE COMPLETE SYSTEM WIPE'
                      : 'EXECUTE LOCAL QUEUE RESET'
                  }
                  variant={selectedRadius === 'full_system_wipe' ? 'danger' : 'secondary'}
                  onPress={handleConfirmReset}
                  style={styles.resetButton}
                />
              </View>

              {/* Section 2: Evaluator Quick Test Presets */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>EVALUATOR TEST CASES // 1-TAP PRESETS</Text>
                <Text style={styles.sectionSubtitle}>
                  Select a test case to automatically simulate field conditions:
                </Text>

                {/* Status Bar */}
                <View style={[styles.statusBanner, isHealthy ? styles.statusHealthy : styles.statusChaos]}>
                  <Text style={[styles.statusBannerText, isHealthy ? styles.textHealthy : styles.textChaos]}>
                    CURRENT LINK: {isHealthy ? '● HEALTHY (NO FAULTS)' : `⚡ FAULT INJECTED: [${activeChaos.join(' · ')}]`}
                  </Text>
                </View>

                <View style={styles.presetGrid}>
                  <Pressable
                    onPress={() => applyPreset('latency')}
                    style={[styles.presetButton, chaosConfig.latencyMs > 0 && styles.activePresetButton]}
                    accessibilityRole="button">
                    <Text style={styles.presetButtonTitle}>TEST CASE 1: 2G LATENCY</Text>
                    <Text style={styles.presetButtonDesc}>+3000ms delay per upload</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('drop')}
                    style={[styles.presetButton, chaosConfig.dropConnection && styles.activeDangerPreset]}
                    accessibilityRole="button">
                    <Text style={[styles.presetButtonTitle, chaosConfig.dropConnection && styles.textRed]}>
                      TEST CASE 2: DROP SOCKET
                    </Text>
                    <Text style={styles.presetButtonDesc}>Sever connection mid-flight</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('error500')}
                    style={[styles.presetButton, chaosConfig.simulate500 && styles.activeDangerPreset]}
                    accessibilityRole="button">
                    <Text style={[styles.presetButtonTitle, chaosConfig.simulate500 && styles.textRed]}>
                      TEST CASE 3: HTTP 500 ERROR
                    </Text>
                    <Text style={styles.presetButtonDesc}>Simulate backend flapping</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('hang')}
                    style={[styles.presetButton, chaosConfig.hangRequest && styles.activeDangerPreset]}
                    accessibilityRole="button">
                    <Text style={[styles.presetButtonTitle, chaosConfig.hangRequest && styles.textRed]}>
                      TEST CASE 4: HANG / TIMEOUT
                    </Text>
                    <Text style={styles.presetButtonDesc}>Simulate frozen gateway</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => applyPreset('clean')}
                    style={[styles.presetButton, styles.restorePresetButton, isHealthy && styles.activeRestorePreset]}
                    accessibilityRole="button">
                    <Text style={styles.restorePresetText}>✓ RESTORE HEALTHY NETWORK</Text>
                    <Text style={styles.presetButtonDesc}>Clear all chaos &amp; flush outbox queue</Text>
                  </Pressable>
                </View>
              </View>

              {/* Section 3: Fine-grained Chaos Switches */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>MANUAL FAULT CONTROLS // SWITCHES</Text>
                <Text style={styles.sectionSubtitle}>
                  Toggle individual backend failure conditions:
                </Text>

                <Card style={styles.chaosCard}>
                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>2G Latency Simulation</Text>
                      <Text style={styles.switchSublabel}>Adds 3000ms delay to POST /reports</Text>
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
                      <Text style={styles.switchLabel}>Drop Socket Mid-Upload</Text>
                      <Text style={styles.switchSublabel}>Abruptly sever TCP stream on POST /reports</Text>
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
                      <Text style={styles.switchSublabel}>Server rejects POST /reports with 500 error</Text>
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
                      <Text style={styles.switchSublabel}>Never answer POST /reports request</Text>
                    </View>
                    <Switch
                      value={chaosConfig.hangRequest}
                      onValueChange={() => toggleChaos('hangRequest')}
                      trackColor={{ false: colors.surfaceActive, true: colors.red }}
                      thumbColor={chaosConfig.hangRequest ? '#FFFFFF' : colors.textMuted}
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
    letterSpacing: 1,
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
    ...typography.micro,
    color: colors.textPrimary,
    letterSpacing: 1,
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
    ...typography.micro,
    color: colors.textPrimary,
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
    paddingVertical: spacing.xs + 2,
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
    ...typography.micro,
    letterSpacing: 0.8,
  },
  textHealthy: {
    color: colors.emerald,
  },
  textChaos: {
    color: colors.red,
    fontWeight: 'bold',
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
    ...typography.micro,
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  restorePresetText: {
    ...typography.micro,
    color: colors.emerald,
    fontWeight: 'bold',
    letterSpacing: 0.8,
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
