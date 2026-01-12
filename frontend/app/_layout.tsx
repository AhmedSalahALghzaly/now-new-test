import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore, useHasHydrated, useUser } from '../src/store/appStore';
import { adminApi } from '../src/services/api';
import { syncService } from '../src/services/syncService';
import { networkService } from '../src/services/networkService';
import { screenshotProtectionService } from '../src/services/screenshotProtectionService';
import { autoLogoutService } from '../src/services/autoLogoutService';
import { offlineDatabaseService } from '../src/services/offlineDatabaseService';

// Auth Guard Component - Monitors auth state and handles navigation
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const hasHydrated = useHasHydrated();
  const setHasHydrated = useAppStore((state) => state.setHasHydrated);
  const user = useAppStore((state) => state.user);
  const currentMood = useAppStore((state) => state.currentMood);
  const setAdmins = useAppStore((state) => state.setAdmins);
  const logout = useAppStore((state) => state.logout);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const servicesInitialized = useRef(false);

  /**
   * Initialize core services on app startup
   */
  useEffect(() => {
    const initializeServices = async () => {
      if (servicesInitialized.current) return;
      servicesInitialized.current = true;

      console.log('[App] Initializing services...');

      try {
        // Initialize offline database (SQLite)
        await offlineDatabaseService.initialize();
        console.log('[App] Offline database initialized');

        // Initialize network monitoring
        await networkService.initialize();
        console.log('[App] Network service initialized');

        // Initialize screenshot protection
        await screenshotProtectionService.initialize();
        console.log('[App] Screenshot protection initialized');

        // Initialize auto-logout service
        await autoLogoutService.initialize(() => {
          console.log('[App] Auto-logout triggered after 90 days inactivity');
          logout();
          router.replace('/login');
        });
        console.log('[App] Auto-logout service initialized');

        // Start sync service
        syncService.start();
        console.log('[App] Sync service started');

      } catch (error) {
        console.error('[App] Service initialization error:', error);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      networkService.cleanup();
      screenshotProtectionService.cleanup();
      autoLogoutService.cleanup();
      syncService.stop();
      offlineDatabaseService.close();
    };
  }, []);

  /**
   * Update screenshot protection based on current screen
   */
  useEffect(() => {
    if (pathname) {
      screenshotProtectionService.updateForScreen(pathname);
    }
  }, [pathname]);

  /**
   * Record user activity for auto-logout tracking
   */
  useEffect(() => {
    if (isAuthenticated && user) {
      autoLogoutService.recordUserActivity();
      offlineDatabaseService.updateLastActivity(user.id);
    }
  }, [isAuthenticated, user, pathname]);

  /**
   * Bug Fix #3: Fetch admins list globally on app startup
   */
  useEffect(() => {
    const fetchAdminsGlobally = async () => {
      if (!isAuthenticated) return;
      
      try {
        const response = await adminApi.checkAccess();
        if (response.data) {
          setAdmins(response.data);
          console.log('AuthGuard: Fetched admins list for access control');
        }
      } catch (error) {
        console.log('AuthGuard: Could not fetch admins list');
      }
    };

    if (hasHydrated && isAuthenticated) {
      fetchAdminsGlobally();
    }
  }, [hasHydrated, isAuthenticated, setAdmins]);

  // Force show content after timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('AuthGuard: Force showing content');
      setShowContent(true);
      if (!hasHydrated) {
        setHasHydrated(true);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      setShowContent(true);
    }
  }, [hasHydrated]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasHydrated || !isNavigationReady) {
      console.log('Auth Guard: Waiting...', { hasHydrated, isNavigationReady });
      return;
    }

    console.log('Auth Guard: Checking auth...', { isAuthenticated, user: user?.email, segments });

    const inAuthGroup = segments[0] === 'login';
    const inProtectedRoute = segments[0] === 'admin' || segments[0] === 'owner' || 
                            segments[0] === 'checkout' || segments[0] === 'orders' ||
                            segments[0] === 'favorites';

    if (isAuthenticated && inAuthGroup) {
      console.log('Auth Guard: User authenticated, redirecting from login to home');
      setTimeout(() => router.replace('/(tabs)'), 50);
    }
    else if (!isAuthenticated && inProtectedRoute) {
      console.log('Auth Guard: User not authenticated, redirecting to login');
      setTimeout(() => router.replace('/login'), 50);
    }
  }, [isAuthenticated, hasHydrated, segments, user, isNavigationReady]);

  if (!showContent) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentMood?.background || '#0F172A' }]}>
        <ActivityIndicator size="large" color={currentMood?.primary || '#3B82F6'} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const theme = useAppStore((state) => state.theme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="category/[id]" />
            <Stack.Screen name="car/[id]" />
            <Stack.Screen name="brand/[id]" />
            <Stack.Screen name="models" />
            <Stack.Screen name="search" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="orders" />
            <Stack.Screen name="favorites" />
          </Stack>
        </AuthGuard>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
