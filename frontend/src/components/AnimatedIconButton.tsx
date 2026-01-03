/**
 * AnimatedIconButton - Modern, interactive animated icon buttons
 * For favorites and cart actions with smooth animations
 */
import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AnimatedIconButtonProps {
  iconName: keyof typeof Ionicons.glyphMap;
  iconNameActive?: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
  activeColor?: string;
  backgroundColor?: string;
  activeBackgroundColor?: string;
  isActive?: boolean;
  isLoading?: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  animationType?: 'bounce' | 'pulse' | 'scale' | 'shake';
}

export const AnimatedIconButton: React.FC<AnimatedIconButtonProps> = ({
  iconName,
  iconNameActive,
  size = 20,
  color,
  activeColor,
  backgroundColor = 'transparent',
  activeBackgroundColor,
  isActive = false,
  isLoading = false,
  onPress,
  disabled = false,
  style,
  animationType = 'bounce',
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // Loading pulse animation
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLoading]);

  // Active state animation - heart beat effect
  useEffect(() => {
    if (isActive && animationType === 'bounce') {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.3,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isActive]);

  const handlePress = () => {
    if (disabled || isLoading) return;

    // Trigger animation based on type
    switch (animationType) {
      case 'bounce':
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 0.7,
            friction: 5,
            tension: 400,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            friction: 3,
            tension: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 200,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'pulse':
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.4,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'scale':
        Animated.spring(scaleAnim, {
          toValue: 0.85,
          friction: 4,
          tension: 300,
          useNativeDriver: true,
        }).start(() => {
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 300,
            useNativeDriver: true,
          }).start();
        });
        break;

      case 'shake':
        Animated.sequence([
          Animated.timing(rotateAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: -1, duration: 100, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        break;
    }

    onPress();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });

  const currentIcon = isActive && iconNameActive ? iconNameActive : iconName;
  const currentColor = isActive && activeColor ? activeColor : color;
  const currentBgColor = isActive && activeBackgroundColor ? activeBackgroundColor : backgroundColor;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: currentBgColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { scale: Animated.multiply(scaleAnim, pulseAnim) },
              { rotate: spin },
            ],
          },
        ]}
      >
        <Ionicons name={currentIcon} size={size} color={currentColor} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// Specialized Heart/Favorite Button
export const AnimatedFavoriteButton: React.FC<{
  isFavorite: boolean;
  isLoading?: boolean;
  onPress: () => void;
  size?: number;
  style?: ViewStyle;
}> = ({ isFavorite, isLoading = false, onPress, size = 20, style }) => {
  return (
    <AnimatedIconButton
      iconName="heart-outline"
      iconNameActive="heart"
      size={size}
      color="#EF4444"
      activeColor="#FFFFFF"
      backgroundColor="rgba(239, 68, 68, 0.1)"
      activeBackgroundColor="#EF4444"
      isActive={isFavorite}
      isLoading={isLoading}
      onPress={onPress}
      animationType="bounce"
      style={[styles.favoriteButton, style]}
    />
  );
};

// Specialized Cart Button
export const AnimatedCartButton: React.FC<{
  isInCart?: boolean;
  isLoading?: boolean;
  onPress: () => void;
  size?: number;
  primaryColor?: string;
  style?: ViewStyle;
}> = ({ isInCart = false, isLoading = false, onPress, size = 20, primaryColor = '#3B82F6', style }) => {
  return (
    <AnimatedIconButton
      iconName={isInCart ? "checkmark" : "add"}
      size={size}
      color="#FFFFFF"
      backgroundColor={isInCart ? '#10B981' : primaryColor}
      isActive={isInCart}
      isLoading={isLoading}
      onPress={onPress}
      animationType={isInCart ? 'pulse' : 'scale'}
      style={[styles.cartButton, style]}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cartButton: {},
});

export default AnimatedIconButton;
