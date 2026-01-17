/**
 * New Entity Dashboard - Selection screen for adding Suppliers or Distributors
 * Displays two prominent circular buttons for navigation
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../src/store/appStore';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NewEntityDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);
  const isRTL = language === 'ar';

  // Animation values for the buttons
  const supplierScale = useSharedValue(1);
  const distributorScale = useSharedValue(1);

  const handleSupplierPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    supplierScale.value = withSequence(
      withSpring(0.9, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 15, stiffness: 400 })
    );
    setTimeout(() => {
      router.push('/owner/add-entity-form?entityType=supplier');
    }, 150);
  };

  const handleDistributorPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    distributorScale.value = withSequence(
      withSpring(0.9, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 15, stiffness: 400 })
    );
    setTimeout(() => {
      router.push('/owner/add-entity-form?entityType=distributor');
    }, 150);
  };

  const supplierAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: supplierScale.value }],
  }));

  const distributorAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: distributorScale.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E1E3F', '#2D2D5F', '#3D3D7F']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
            color="#FFF"
          />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            {isRTL ? 'إضافة جهة جديدة' : 'Add New Entity'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isRTL
              ? 'اختر نوع الجهة التي تريد إضافتها'
              : 'Choose the type of entity to add'}
          </Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Supplier Button */}
        <Animated.View style={[styles.entityButtonWrapper, supplierAnimStyle]}>
          <TouchableOpacity
            style={styles.entityButton}
            onPress={handleSupplierPress}
            activeOpacity={1}
          >
            <LinearGradient
              colors={['#0D9488', '#14B8A6', '#2DD4BF']}
              style={styles.entityGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <BlurView intensity={20} tint="light" style={styles.entityBlur}>
                <View style={styles.entityIconContainer}>
                  <Ionicons name="briefcase" size={50} color="#FFF" />
                </View>
                <Text style={styles.entityTitle}>
                  {isRTL ? 'مورد جديد' : 'New Supplier'}
                </Text>
                <Text style={styles.entityDescription}>
                  {isRTL
                    ? 'إضافة مورد للعلامات التجارية للمنتجات'
                    : 'Add supplier for product brands'}
                </Text>
              </BlurView>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* VS Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerCircle}>
            <Text style={styles.dividerText}>
              {isRTL ? 'أو' : 'OR'}
            </Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        {/* Distributor Button */}
        <Animated.View style={[styles.entityButtonWrapper, distributorAnimStyle]}>
          <TouchableOpacity
            style={styles.entityButton}
            onPress={handleDistributorPress}
            activeOpacity={1}
          >
            <LinearGradient
              colors={['#991B1B', '#DC2626', '#EF4444']}
              style={styles.entityGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <BlurView intensity={20} tint="light" style={styles.entityBlur}>
                <View style={styles.entityIconContainer}>
                  <Ionicons name="car" size={50} color="#FFF" />
                </View>
                <Text style={styles.entityTitle}>
                  {isRTL ? 'موزع جديد' : 'New Distributor'}
                </Text>
                <Text style={styles.entityDescription}>
                  {isRTL
                    ? 'إضافة موزع لماركات السيارات'
                    : 'Add distributor for car brands'}
                </Text>
              </BlurView>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Bottom Hint */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.5)" />
          <Text style={styles.hintText}>
            {isRTL
              ? 'يمكنك ربط الموردين بالعلامات التجارية والموزعين بماركات السيارات'
              : 'Suppliers link to product brands, Distributors link to car brands'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  entityButtonWrapper: {
    alignItems: 'center',
  },
  entityButton: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 340,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  entityGradient: {
    borderRadius: 24,
  },
  entityBlur: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  entityIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  entityTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  entityDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    maxWidth: 80,
  },
  dividerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  footer: {
    paddingHorizontal: 24,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
    textAlign: 'center',
  },
});
