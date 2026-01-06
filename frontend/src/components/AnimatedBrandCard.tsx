/**
 * AnimatedBrandCard - A reusable animated brand card component
 * Features:
 * - Circular brand image with transparent/subtle background
 * - Modern ripple animation on press using react-native-reanimated
 * - Car Brands: displays name + models count
 * - Product Brands: displays name + country of origin
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';

// Country flags mapping for product brands
const COUNTRY_FLAGS: { [key: string]: string } = {
  'Japan': '🇯🇵',
  'Germany': '🇩🇪',
  'USA': '🇺🇸',
  'South Korea': '🇰🇷',
  'China': '🇨🇳',
  'Italy': '🇮🇹',
  'France': '🇫🇷',
  'UK': '🇬🇧',
  'Spain': '🇪🇸',
  'Sweden': '🇸🇪',
  'Egypt': '🇪🇬',
  'UAE': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'default': '🌍',
};

interface AnimatedBrandCardProps {
  brand: {
    id: string;
    name: string;
    name_ar?: string;
    logo?: string | null;
    image_url?: string | null;
    models_count?: number;
    country_of_origin?: string;
  };
  type: 'car' | 'product';
  modelsCount?: number; // For car brands
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const AnimatedBrandCard: React.FC<AnimatedBrandCardProps> = ({
  brand,
  type,
  modelsCount = 0,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const { language, isRTL } = useTranslation();

  // Animation values
  const scale = useSharedValue(1);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  const getName = () => {
    return language === 'ar' && brand.name_ar ? brand.name_ar : brand.name;
  };

  const getCountryFlag = () => {
    const country = brand.country_of_origin || 'default';
    return COUNTRY_FLAGS[country] || COUNTRY_FLAGS['default'];
  };

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePressIn = () => {
    'worklet';
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    rippleScale.value = withTiming(1, { duration: 300 });
    rippleOpacity.value = withTiming(0.3, { duration: 150 });
    glowOpacity.value = withTiming(1, { duration: 200 });
  };

  const handlePressOut = () => {
    'worklet';
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    rippleScale.value = withTiming(1.5, { duration: 200 });
    rippleOpacity.value = withTiming(0, { duration: 200 });
    glowOpacity.value = withTiming(0, { duration: 300 });
  };

  const handlePress = () => {
    // Haptic feedback
    triggerHaptic();
    
    // Bounce animation
    scale.value = withSequence(
      withSpring(0.9, { damping: 10, stiffness: 500 }),
      withSpring(1.05, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 350 })
    );
    
    // Trigger the onPress callback
    onPress();
  };

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowOpacity.value, [0, 1], [0, 0.4], Extrapolation.CLAMP),
  }));

  const brandColor = type === 'car' ? colors.primary : colors.secondary;
  const brandImageUrl = brand.logo || brand.image_url;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        containerStyle,
        {
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border,
        },
      ]}
    >
      {/* Ripple Effect */}
      <Animated.View
        style={[
          styles.ripple,
          rippleStyle,
          { backgroundColor: brandColor },
        ]}
      />

      {/* Glow Effect */}
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          {
            backgroundColor: brandColor,
            shadowColor: brandColor,
          },
        ]}
      />

      {/* Circular Brand Image/Icon */}
      <View style={[styles.imageWrapper]}>
        <View
          style={[
            styles.imageContainer,
            {
              backgroundColor: 'transparent',
              borderColor: brandColor + '30',
            },
          ]}
        >
          {brandImageUrl ? (
            <Image
              source={{ uri: brandImageUrl }}
              style={styles.brandImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.iconFallback, { backgroundColor: brandColor + '15' }]}>
              <Ionicons
                name={type === 'car' ? 'car-sport' : 'pricetag'}
                size={28}
                color={brandColor}
              />
            </View>
          )}
        </View>
      </View>

      {/* Brand Name */}
      <Text
        style={[
          styles.brandName,
          { color: colors.text },
          isRTL && styles.textRTL,
        ]}
        numberOfLines={1}
      >
        {getName()}
      </Text>

      {/* Meta Info */}
      <View style={[styles.metaContainer, isRTL && styles.metaContainerRTL]}>
        {type === 'car' ? (
          // Car Brand: Show models count
          <View style={[styles.metaBadge, { backgroundColor: brandColor + '15' }]}>
            <Ionicons name="layers-outline" size={12} color={brandColor} />
            <Text style={[styles.metaText, { color: brandColor }]}>
              {modelsCount || brand.models_count || 0} {language === 'ar' ? 'موديل' : 'models'}
            </Text>
          </View>
        ) : (
          // Product Brand: Show country of origin
          <View style={[styles.metaBadge, { backgroundColor: brandColor + '15' }]}>
            <Text style={styles.flagEmoji}>{getCountryFlag()}</Text>
            <Text style={[styles.metaText, { color: brandColor }]} numberOfLines={1}>
              {brand.country_of_origin || (language === 'ar' ? 'عالمي' : 'Global')}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 110,
    height: 130,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    overflow: 'hidden',
    position: 'relative',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
  },
  glow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  imageWrapper: {
    marginBottom: 8,
  },
  imageContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  brandImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  textRTL: {
    textAlign: 'center',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContainerRTL: {
    flexDirection: 'row-reverse',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
  },
  flagEmoji: {
    fontSize: 12,
  },
});

export default AnimatedBrandCard;
