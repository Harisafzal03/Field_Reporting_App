import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from './src/components/Header';
import {
  Attachment,
  BlastRadius,
  ChaosConfig,
  Report,
  ServerReport,
} from './src/domain/types';
import { draftStore } from './src/queue/draftStore';
import { queueStore } from './src/queue/queueStore';
import {
  ChaosResetModal,
  ComposeScreen,
  OutboxScreen,
  ReviewScreen,
} from './src/screens';
import { api } from './src/services/api';
import {
  HardwareNetworkStatus,
  subscribeToHardwareNetwork,
} from './src/services/network';
import { uploadEngine } from './src/services/uploadEngine';
import { colors, radii, spacing, typography } from './src/theme';

type Tab = 'compose' | 'outbox' | 'review';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('compose');
  const [hardwareNetwork, setHardwareNetwork] = useState<HardwareNetworkStatus>({
    speedCategory: 'online',
    connectionType: 'unknown' as any,
    bandwidthLabel: 'Checking connection...',
    isConnected: true,
    isInternetReachable: true,
  });
  const [chaosModalVisible, setChaosModalVisible] = useState(false);
  const [serverReports, setServerReports] = useState<ServerReport[]>([]);
  const [serverLoading, setServerLoading] = useState(false);

  // Persistent queue hydrated from device disk (AsyncStorage)
  const [reports, setReports] = useState<Report[]>([]);

  const [chaosConfig, setChaosConfig] = useState<ChaosConfig>({
    latencyMs: 0,
    dropConnection: false,
    simulate500: false,
    hangRequest: false,
    lostResponse: false,
  });

  // Sync with backend database (GET /reports)
  const fetchServerReports = useCallback(async () => {
    setServerLoading(true);
    try {
      const data = await api.getReports();
      setServerReports(data);
    } catch {
      // Backend not running or unreachable
    } finally {
      setServerLoading(false);
    }
  }, []);

  // Initialize queue persistence and upload engine
  useEffect(() => {
    // Attempt auto-detect active server host in background
    api.resolveActiveBaseUrl().catch(() => { });

    // 1. Hydrate queue from disk on launch
    queueStore.loadQueueFromDisk();

    // 2. Subscribe to reactive queue changes
    const unsubQueue = queueStore.subscribe(updatedReports => {
      setReports(updatedReports);
    });

    // 3. Start headless upload engine ticker
    uploadEngine.start();

    // 4. Refresh ground truth when upload delivers
    const unsubDelivery = uploadEngine.onDelivery(() => {
      fetchServerReports();
    });

    // 5. Subscribe to hardware network changes
    const unsubNetwork = subscribeToHardwareNetwork(status => {
      setHardwareNetwork(status);
      uploadEngine.setOffline(status.speedCategory === 'offline');
    });

    // 6. Fetch initial server reports
    fetchServerReports();

    return () => {
      unsubQueue();
      unsubDelivery();
      unsubNetwork();
      uploadEngine.stop();
    };
  }, [fetchServerReports]);

  // Network pill tap action
  const handleToggleNetwork = () => {
    Alert.alert(
      'Network Connection Status',
      `Current: ${hardwareNetwork.bandwidthLabel}\nType: ${hardwareNetwork.connectionType.toUpperCase()}\nStatus: ${hardwareNetwork.isConnected ? 'Connected' : 'Offline'}\n\nUnattended upload engine automatically syncs when network is available.`,
    );
  };

  // Enqueue report to persistent disk queue
  const handleQueueReport = async (description: string, attachments: Attachment[]) => {
    const newReport: Report = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      description,
      attachments,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    await queueStore.enqueueReport(newReport);
    setActiveTab('outbox');
    uploadEngine.tick(); // Promptly attempt upload if online
  };

  // Manual retry trigger
  const handleRetryReport = async (id: string) => {
    await queueStore.updateReport(id, {
      status: 'in_queue',
      nextRetryAt: undefined,
      errorMessage: undefined,
    });
    uploadEngine.tick();
  };

  const handleUpdateChaos = async (newConfig: ChaosConfig) => {
    setChaosConfig(newConfig);
    await api.configureChaos(newConfig);
  };

  const handleExecuteReset = async (radius: BlastRadius) => {
    await draftStore.clearDraft();
    if (radius === 'local_queue_only') {
      await queueStore.clearQueue();
      setChaosModalVisible(false);
      Alert.alert('Local Queue Cleared', 'Phone outbox and local drafts have been wiped.');
    } else {
      await queueStore.clearQueue();
      setServerReports([]);
      await api.resetServer();
      setChaosModalVisible(false);
      Alert.alert(
        'System Reset Complete',
        'Phone outbox cleared AND server database purged to factory zero.',
      );
    }
  };

  const pendingCount = reports.filter(r => r.status !== 'delivered').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <Header
        networkSpeed={hardwareNetwork.speedCategory}
        bandwidthLabel={hardwareNetwork.bandwidthLabel}
        onToggleNetwork={handleToggleNetwork}
        onOpenChaos={() => setChaosModalVisible(true)}
        pendingCount={pendingCount}
      />

      {/* Active Screen View */}
      <View style={styles.screenContainer}>
        {activeTab === 'compose' && (
          <ComposeScreen onQueueReport={handleQueueReport} />
        )}
        {activeTab === 'outbox' && (
          <OutboxScreen reports={reports} onRetryReport={handleRetryReport} />
        )}
        {activeTab === 'review' && (
          <ReviewScreen
            serverReports={serverReports}
            loading={serverLoading}
            onRefresh={fetchServerReports}
          />
        )}
      </View>

      {/* Bottom Navigation Tabs */}
      <View style={styles.bottomNav}>
        <Pressable
          style={[styles.navItem, activeTab === 'compose' && styles.activeNavItem]}
          onPress={() => setActiveTab('compose')}
          accessibilityRole="tab"
          accessibilityLabel="Compose report">
          <Text
            style={[
              styles.navLabel,
              activeTab === 'compose' && styles.activeNavLabel,
            ]}>
            COMPOSE
          </Text>
        </Pressable>

        <Pressable
          style={[styles.navItem, activeTab === 'outbox' && styles.activeNavItem]}
          onPress={() => setActiveTab('outbox')}
          accessibilityRole="tab"
          accessibilityLabel="Outbox queue">
          <View style={styles.navLabelWrapper}>
            <Text
              style={[
                styles.navLabel,
                activeTab === 'outbox' && styles.activeNavLabel,
              ]}>
              OUTBOX
            </Text>
            {pendingCount > 0 ? (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{pendingCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          style={[styles.navItem, activeTab === 'review' && styles.activeNavItem]}
          onPress={() => setActiveTab('review')}
          accessibilityRole="tab"
          accessibilityLabel="Server review">
          <Text
            style={[
              styles.navLabel,
              activeTab === 'review' && styles.activeNavLabel,
            ]}>
            SERVER REVIEW
          </Text>
        </Pressable>
      </View>

      {/* Chaos & Reset Controller Modal */}
      <ChaosResetModal
        visible={chaosModalVisible}
        onClose={() => setChaosModalVisible(false)}
        chaosConfig={chaosConfig}
        onUpdateChaos={handleUpdateChaos}
        onExecuteReset={handleExecuteReset}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingBottom: spacing.md,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  activeNavItem: {
    borderTopWidth: 2,
    borderTopColor: colors.accentLight,
    marginTop: -2,
  },
  navLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  activeNavLabel: {
    color: colors.textPrimary,
  },
  navBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.accentDark,
  },
});

export default App;
