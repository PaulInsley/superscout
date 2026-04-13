import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_TOKEN_KEY = "superscout_push_token";
const PERMISSION_ASKED_KEY = "superscout_push_permission_asked";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function hasAskedPermission(): Promise<boolean> {
  const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  return asked === "true";
}

export async function requestPushPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log("[Notifications] Push tokens only work on physical devices");
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === "granted") {
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "true");
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "true");
  return status === "granted";
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "SuperScout",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "superscout",
    });
    return tokenData.data;
  } catch (err) {
    console.warn("[Notifications] Failed to get push token:", err);
    return null;
  }
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function storeToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function registerTokenWithServer(
  apiBase: string,
  userId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/notifications/register-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, token }),
    });
    if (res.ok) {
      await storeToken(token);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[PushNotifications] registerForPushNotifications failed:", err);
    return false;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
    },
  });
}

export async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, unknown>,
): Promise<string> {
  const secondsFromNow = Math.max(1, Math.floor((triggerDate.getTime() - Date.now()) / 1000));

  const triggerInput: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: secondsFromNow,
    repeats: false,
  };

  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: triggerInput,
  });
  return id;
}

export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(handler);
}
