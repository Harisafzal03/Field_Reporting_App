import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '../theme';

interface ImageViewerModalProps {
  visible: boolean;
  imageUri: string | null;
  title?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUri,
  title,
  onClose,
}) => {
  if (!visible || !imageUri) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              {title ? (
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer">
              <Text style={styles.closeIcon}>✕</Text>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          {/* Image Container */}
          <Pressable
            style={styles.imageContainer}
            onPress={onClose}
            accessibilityLabel="Dismiss photo viewer by tapping background">
            <Image
              source={{ uri: imageUri }}
              style={styles.fullImage}
              resizeMode="contain"
              accessibilityLabel={title || 'Full size photo preview'}
            />
          </Pressable>

          {/* Footer note */}
          <View style={styles.footer}>
            <Text style={styles.footerHint}>Tap anywhere outside to close</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 23, 0.96)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    gap: 6,
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerHint: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
