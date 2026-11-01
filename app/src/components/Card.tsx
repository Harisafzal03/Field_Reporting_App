import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  highlighted = false,
}) => {
  return (
    <View
      style={[
        styles.card,
        highlighted && styles.highlightedCard,
        style,
      ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md + 2,
  },
  highlightedCard: {
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceElevated,
  },
});
