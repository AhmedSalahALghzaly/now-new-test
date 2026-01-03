/**
 * Push Notification Service
 * Handles push notifications for order status changes and other alerts
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  // Get the Expo push token
  async getExpoPushToken(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permissions not granted');
        return null;
      }

      // Get the token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      this.expoPushToken = token.data;

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
        });

        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Order Updates',
          description: 'Notifications for order status changes',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Register token with backend
  async registerTokenWithBackend(userId: string): Promise<boolean> {
    if (!this.expoPushToken) {
      await this.getExpoPushToken();
    }

    if (!this.expoPushToken) {
      return false;
    }

    try {
      await api.post('/notifications/register-token', {
        user_id: userId,
        push_token: this.expoPushToken,
        platform: Platform.OS,
      });
      console.log('Push token registered with backend');
      return true;
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }

  // Schedule a local notification
  async scheduleLocalNotification(notification: PushNotificationData, delay: number = 0): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: true,
      },
      trigger: delay > 0 ? { seconds: delay } : null,
    });
    return id;
  }

  // Send order status notification
  async sendOrderStatusNotification(
    orderId: string,
    orderNumber: string,
    status: string,
    language: 'en' | 'ar' = 'ar'
  ): Promise<void> {
    const statusMessages: Record<string, { en: string; ar: string }> = {
      pending: {
        en: 'Your order has been received and is being processed',
        ar: 'تم استلام طلبك وجاري معالجته',
      },
      preparing: {
        en: 'Your order is being prepared',
        ar: 'جاري تحضير طلبك',
      },
      shipped: {
        en: 'Your order has been shipped',
        ar: 'تم شحن طلبك',
      },
      out_for_delivery: {
        en: 'Your order is out for delivery',
        ar: 'طلبك في الطريق إليك',
      },
      delivered: {
        en: 'Your order has been delivered',
        ar: 'تم توصيل طلبك',
      },
      cancelled: {
        en: 'Your order has been cancelled',
        ar: 'تم إلغاء طلبك',
      },
    };

    const message = statusMessages[status] || {
      en: `Order ${orderNumber} status updated to ${status}`,
      ar: `تم تحديث حالة الطلب ${orderNumber} إلى ${status}`,
    };

    await this.scheduleLocalNotification({
      title: language === 'ar' ? `طلب #${orderNumber}` : `Order #${orderNumber}`,
      body: message[language],
      data: { orderId, orderNumber, status, type: 'order_status' },
    });
  }

  // Add notification listeners
  addListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listen for notifications while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      onNotificationReceived?.(notification);
    });

    // Listen for notification responses (user tapped on notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      onNotificationResponse?.(response);
    });
  }

  // Remove notification listeners
  removeListeners(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
