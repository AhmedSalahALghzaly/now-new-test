import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore, useCanAccessAdminPanel } from '../../src/store/appStore';

// Owner email that can always access the interface
const OWNER_EMAIL = 'pc.2025.ai@gmail.com';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const cartItems = useAppStore((state) => state.cartItems);
  const user = useAppStore((state) => state.user);
  const partners = useAppStore((state) => state.partners);
  const admins = useAppStore((state) => state.admins);
  const userRole = useAppStore((state) => state.userRole);
  const canAccessAdminPanel = useCanAccessAdminPanel();
  
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Check if user can access owner interface
  const isOwner = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const isPartner = partners.some(
    (p: any) => p.email?.toLowerCase() === user?.email?.toLowerCase()
  );
  const isAdmin = admins.some(
    (a: any) => a.email?.toLowerCase() === user?.email?.toLowerCase()
  ) || userRole === 'admin';
  const canAccessOwner = isOwner || isPartner;

  // Custom center button for Owner/Admin Access
  const CenterAccessButton = () => {
    // Show Owner button for owners/partners
    if (canAccessOwner) {
      return (
        <TouchableOpacity
          style={styles.ownerButton}
          onPress={() => router.push('/owner')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8B5CF6', '#6366F1']}
            style={styles.ownerButtonGradient}
          >
            <Ionicons name="diamond" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      );
    }
    
    // Show Admin button for admins
    if (isAdmin) {
      return (
        <TouchableOpacity
          style={styles.ownerButton}
          onPress={() => router.push('/admin')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.ownerButtonGradient}
          >
            <Ionicons name="settings" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      );
    }
    
    return null;
  };

  // Determine if we should show the center button
  const showCenterButton = canAccessOwner || isAdmin;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('home'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: t('categories'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid" size={size} color={color} />
            ),
          }}
        />
        {/* Center spacer for Owner button - only when canAccessOwner */}
        {canAccessOwner && (
          <Tabs.Screen
            name="owner-placeholder"
            options={{
              title: '',
              tabBarIcon: () => <View style={{ width: 50 }} />,
              tabBarButton: () => <View style={{ width: 60 }} />,
            }}
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
              },
            }}
          />
        )}
        <Tabs.Screen
          name="cart"
          options={{
            title: t('cart'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
            tabBarBadge: cartCount > 0 ? cartCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.error,
              fontSize: 10,
            },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('profile'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      
      {/* Owner Access Center Button - Floating above tab bar */}
      {canAccessOwner && (
        <View style={styles.ownerButtonContainer}>
          <OwnerCenterButton />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ownerButtonContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 45 : 25,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  ownerButton: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  ownerButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
});
