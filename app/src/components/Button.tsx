import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, hitTargets, radii, spacing, typography } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  subtitle,
}) => {
  const getBackgroundColor = (pressed: boolean) => {
    if (disabled) return '#E5E7EB';
    switch (variant) {
      case 'primary':
        return pressed ? '#E4E4E7' : colors.accentLight;
      case 'secondary':
        return pressed ? colors.surfaceActive : colors.surfaceElevated;
      case 'danger':
        return pressed ? '#DC2626' : colors.red;
      case 'ghost':
        return pressed ? colors.surfaceElevated : 'transparent';
    }
  };

  const getTextColor = () => {
    if (disabled) return '#374151';
    switch (variant) {
      case 'primary':
        return colors.accentDark;
      case 'secondary':
        return colors.textPrimary;
      case 'danger':
        return '#FFFFFF';
      case 'ghost':
        return colors.textSecondary;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: getBackgroundColor(pressed),
          borderColor:
            variant === 'secondary'
              ? colors.borderHighlight
              : variant === 'danger'
              ? colors.red
              : disabled
              ? '#D1D5DB'
              : 'transparent',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                variant === 'primary' && !disabled
                  ? styles.subtitlePrimary
                  : styles.subtitleMuted,
              ]}>
              {subtitle}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: hitTargets.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  text: {
    ...typography.bodySemibold,
    letterSpacing: 0,
    fontSize: 14,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
    fontSize: 11,
    letterSpacing: 0,
  },
  subtitlePrimary: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  subtitleMuted: {
    color: '#4B5563',
  },
});
