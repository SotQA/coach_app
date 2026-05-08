import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logger } from "../utils/logger";

// ─── Channel (Android 8+) ────────────────────────────────────────────────────

const REST_CHANNEL_ID = "rest-timer";

/**
 * Create the notification channel on Android.
 * Safe to call multiple times (idempotent).
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
    name: "Rest Timer",
    description: "Alerts when your rest period between sets is complete",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 200, 100, 200],
    lightColor: "#D4FF44",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

// ─── Foreground behaviour ────────────────────────────────────────────────────

/**
 * Show notifications even when the app is foregrounded.
 * Call once at app startup (e.g. in the root layout).
 */
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ─── Permissions ─────────────────────────────────────────────────────────────

/**
 * Request notification permissions.
 * Returns `true` if granted (or already granted).
 * On iOS: triggers system dialog on first call.
 * On Android 13+: triggers POST_NOTIFICATIONS dialog.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return status === "granted";
  } catch (e) {
    console.warn("[Notifications] Permission request failed:", e);
    return false;
  }
}

// ─── Schedule / Cancel ───────────────────────────────────────────────────────

export interface ScheduleRestOptions {
  delaySeconds: number;
  workoutPlanId: string;
  workoutName: string;
}

/**
 * Schedule a "Rest Complete" local notification.
 *
 * Returns the notification identifier (for later cancellation),
 * or `null` if scheduling failed.
 */
export async function scheduleRestNotification(
  opts: ScheduleRestOptions
): Promise<string | null> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    logger.warn("[notifications] skipping schedule — permission not granted", { status });
    return null;
  }
  const delay = Math.max(1, Math.round(opts.delaySeconds));
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rest Complete",
        body: "Time for your next set 💪",
        sound: "default",
        // Carry planId so the tap handler can deep-link to the right screen.
        data: { workoutPlanId: opts.workoutPlanId, workoutName: opts.workoutName },
        ...(Platform.OS === "android" ? { channelId: REST_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delay,
        // `repeats: false` is the default — fire once only.
      },
    });
    return id;
  } catch (e) {
    console.warn("[Notifications] Failed to schedule rest notification:", e);
    return null;
  }
}

/**
 * Cancel a single scheduled notification by its identifier.
 * Safe to call with a null / undefined id.
 */
export async function cancelRestNotification(
  notificationId: string | null | undefined
): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.warn("[Notifications] Failed to cancel notification:", e);
  }
}

/**
 * Cancel ALL scheduled notifications (safety net — called on finishSession).
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn("[Notifications] Failed to cancel all notifications:", e);
  }
}
