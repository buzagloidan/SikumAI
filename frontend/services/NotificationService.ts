import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  static async requestPermissions() {
    if (Platform.OS === 'ios') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        return false;
      }
      return true;
    }
    return true;
  }

  static async scheduleDailyReminder() {
    // Cancel any existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Get current date and set it to 5 PM today
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      17, // 5 PM
      0,
      0
    );

    // If it's past 5 PM, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    // Calculate initial delay in seconds
    const initialDelay = Math.max(1, Math.floor((scheduledTime.getTime() - now.getTime()) / 1000));

    // Schedule the first notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "זמן ללמוד! 📚",
        body: "בוא נתרגל קצת עם SikumAI",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: "timeInterval",
        seconds: initialDelay,
      },
    });

    // Schedule the repeating notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "זמן ללמוד! 📚",
        body: "בוא נתרגל קצת עם SikumAI",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: "timeInterval",
        seconds: 86400, // 24 hours
        repeats: true,
      },
    });
  }

  static async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export default NotificationService; 