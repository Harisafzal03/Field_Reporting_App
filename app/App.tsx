import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  triggerSpeedTest,
} from './src/services/network';
import { colors, radii, spacing, typography } from './src/theme';

type Tab = 'compose' | 'outbox' | 'review';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('compose');
  const [hardwareNetwork, setHardwareNetwork] = useState<HardwareNetworkStatus>({
    speedCategory: 'online',
    connectionType: 'unknown' as any,
    bandwidthLabel: 'INITIALIZING LINK...',
    isConnected: true,
    isInternetReachable: true,
  });
  const [chaosModalVisible, setChaosModalVisible] = useState(false);
  const [serverReports, setServerReports] = useState<ServerReport[]>([]);
  const [serverLoading, setServerLoading] = useState(false);

  // In-flight and local reports queue state — starts strictly empty with ZERO mock data
  const [reports, setReports] = useState<Report[]>([]);

  const [chaosConfig, setChaosConfig] = useState<ChaosConfig>({
    latencyMs: 0,
    dropConnection: false,
    simulate500: false,
    hangRequest: false,
  });

  const isUploadingRef = useRef(false);
  const hardwareNetworkRef = useRef(hardwareNetwork);
  hardwareNetworkRef.current = hardwareNetwork;

  // Real Hardware Network Listener (Android and iOS)
  useEffect(() => {
    // Attempt auto-detect active server host in background
    api.resolveActiveBaseUrl().catch(() => {});

    const unsubscribe = subscribeToHardwareNetwork(status => {
      setHardwareNetwork(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

  useEffect(() => {
    let isMounted = true;
    api
      .getReports()
      .then(data => {
        if (isMounted) {
          setServerReports(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Real Unattended Queue Worker Engine
  // Automatically uploads in_queue reports over the hardware network link
  useEffect(() => {
    if (hardwareNetwork.speedCategory === 'offline') {
      return;
    }

    const now = Date.now();
    const nextPending = reports.find(
      r => r.status === 'in_queue' && (!r.nextRetryAt || r.nextRetryAt <= now),
    );
    if (!nextPending || isUploadingRef.current) {
      return;
    }

    isUploadingRef.current = true;
    const targetId = nextPending.id;
    const totalBytes = nextPending.attachments.reduce((acc, a) => acc + a.fileSizeBytes, 0);

    // Transition to uploading
    setReports(prev =>
      prev.map(r =>
        r.id === targetId
          ? {
              ...r,
              status: 'uploading',
              progress: {
                bytesSent: 0,
                totalBytes,
                currentAttachmentIndex: 0,
                totalAttachments: nextPending.attachments.length,
                percent: 0,
              },
            }
          : r,
      ),
    );

    let isAborted = false;

    // Call real API upload via XMLHttpRequest with hardware progress updates
    api
      .submitReport(
        nextPending.id,
        nextPending.description,
        nextPending.attachments,
        percent => {
          if (isAborted) return;
          const currentPercent = Math.min(Math.round(percent), 100);
          const bytesSent = Math.round((currentPercent / 100) * totalBytes);
          const currentAttachmentIndex = Math.min(
            nextPending.attachments.length - 1,
            Math.floor((currentPercent / 100) * nextPending.attachments.length),
          );

          setReports(prev =>
            prev.map(r =>
              r.id === targetId
                ? {
                    ...r,
                    progress: {
                      bytesSent,
                      totalBytes,
                      currentAttachmentIndex,
                      totalAttachments: nextPending.attachments.length,
                      percent: currentPercent,
                    },
                  }
                : r,
            ),
          );
        },
      )
      .then(res => {
        isUploadingRef.current = false;
        // Mark report as delivered
        setReports(prev =>
          prev.map(r =>
            r.id === targetId
              ? {
                  ...r,
                  status: 'delivered',
                  progress: undefined,
                  serverReportId: res.reportId,
                  errorMessage: undefined,
                  nextRetryAt: undefined,
                  updatedAt: Date.now(),
                }
              : r,
          ),
        );
        // Refresh ground truth from server
        fetchServerReports();
      })
      .catch((err: any) => {
        isUploadingRef.current = false;
        // Resiliency requirement: When connection drops or latency occurs mid-flight,
        // NEVER abandon the report or leave it dead. Retain in queue (status: 'in_queue')
        // and schedule automatic unattended retry in 3.5 seconds.
        setReports(prev =>
          prev.map(r =>
            r.id === targetId
              ? {
                  ...r,
                  status: 'in_queue',
                  retryCount: (r.retryCount || 0) + 1,
                  nextRetryAt: Date.now() + 3500,
                  progress: undefined,
                  errorMessage:
                    err.message ||
                    'Connection dropped mid-flight · Auto-retrying unattended...',
                  updatedAt: Date.now(),
                }
              : r,
          ),
        );
      });

    return () => {
      isAborted = true;
    };
  }, [hardwareNetwork.speedCategory, reports, fetchServerReports]);

  // Unattended auto-retry ticker: Checks every second for scheduled retries
  useEffect(() => {
    const timer = setInterval(() => {
      if (isUploadingRef.current) return;
      const now = Date.now();
      setReports(prev => {
        const hasDue = prev.some(
          r => r.status === 'in_queue' && r.nextRetryAt && r.nextRetryAt <= now,
        );
        return hasDue ? [...prev] : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Network toggle action (tap network pill in header to trigger live speed test)
  const handleToggleNetwork = () => {
    triggerSpeedTest();
    Alert.alert(
      'MEASURING LIVE NETWORK SPEED',
      `Current: ${hardwareNetwork.bandwidthLabel}\nConnection: ${hardwareNetwork.connectionType.toUpperCase()}\nStatus: ${hardwareNetwork.isConnected ? 'CONNECTED' : 'OFFLINE'}\n\nTesting live throughput over Internet link...`,
    );
  };

  // Compose action: Enqueues a new report locally with real picked images
  const handleQueueReport = (description: string, attachments: Attachment[]) => {
    const newReport: Report = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      description,
      attachments,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'in_queue',
      retryCount: 0,
    };

    setReports(prev => [newReport, ...prev]);
    setActiveTab('outbox');
  };

  const handleRetryReport = (id: string) => {
    setReports(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              status: 'in_queue',
              nextRetryAt: undefined,
              errorMessage: undefined,
            }
          : r,
      ),
    );
  };

  const handleUpdateChaos = async (newConfig: ChaosConfig) => {
    setChaosConfig(newConfig);
    await api.configureChaos(newConfig);
  };

  const handleExecuteReset = async (radius: BlastRadius) => {
    if (radius === 'local_queue_only') {
      setReports([]);
      setChaosModalVisible(false);
      Alert.alert('LOCAL RESET DONE', 'Device queue and local drafts have been wiped.');
    } else {
      setReports([]);
      setServerReports([]);
      await api.resetServer();
      setChaosModalVisible(false);
      Alert.alert(
        'COMPLETE SYSTEM WIPE',
        'Local queue cleared AND server database purged to factory zero.',
      );
    }
  };

  const pendingCount = reports.filter(r => r.status !== 'delivered').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

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
