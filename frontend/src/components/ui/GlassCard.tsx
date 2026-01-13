/**
 * GlassCard - Glassmorphism styled card container
 * Reusable component with theme support
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        styles.glassCard,
        {
          backgroundColor: isDark
            ? 'rgba(30, 41, 59, 0.8)'
            : 'rgba(255, 255, 255, 0.9)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  glassCard: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});

export default GlassCard;
