import { Stack, useRouter, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { logger } from "../utils/logger";
import { ActiveWorkoutSessionProvider, useActiveWorkoutSession } from "../context/ActiveWorkoutSessionContext";
import { ElapsedTimeProvider } from "../context/ElapsedTimeContext";
import { I18nProvider } from "../context/I18nContext";
import { UnitsProvider } from "../context/UnitsContext";
import * as SystemUI from "expo-system-ui";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Colors } from "../theme/colors";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureForegroundHandler,
  registerForPushNotificationsAsync,
  requestNotificationPermissions,
  setupNotificationChannel,
} from "../services/notificationService";
import { authService } from "../services/authService";
import { workoutService } from "../services/workoutService";
import { inviteService } from "../services/inviteService";
import ErrorBoundary from "../components/ErrorBoundary";

// Configure how notifications appear when the app is in the foreground.
// Must be called before any notification is received.
configureForegroundHandler();

function RootNavigator() {
  const { loading, user } = useAuth();
  const { session } = useActiveWorkoutSession();
  const router = useRouter();
  const pathname = usePathname();

  // ── One-time setup on mount ───────────────────────────────────────────────
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Colors.bg).catch(() => {});
    // Create Android notification channel + request permissions silently.
    setupNotificationChannel();
    requestNotificationPermissions();
  }, []);

  // ── Push token registration ───────────────────────────────────────────────
  // Runs once the user is known (permission request above may still be in
  // flight on first mount, so this waits until it resolves via the check
  // inside registerForPushNotificationsAsync).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    registerForPushNotificationsAsync().then((token) => {
      if (!cancelled && token) authService.updatePushToken(user.id, token);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ── Notification tap handler ──────────────────────────────────────────────
  // `useLastNotificationResponse` returns the most recent tapped notification.
  // It persists across renders until the app handles it, so it correctly
  // fires even when the app was launched cold from a notification tap.
  const lastResponse = Notifications.useLastNotificationResponse();
  // `useLastNotificationResponse` never clears itself once a notification is
  // tapped, and this effect's deps re-fire on session hydration — without a
  // guard, the same tap gets reprocessed and pushes a duplicate
  // workoutExecution screen onto the stack.
  const handledNotifIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastResponse) return;
    const notifId = lastResponse.notification.request.identifier;
    if (handledNotifIdRef.current === notifId) return;

    const data = lastResponse.notification.request.content.data as
      | {
          type?: string;
          workoutPlanId?: string;
          nextExerciseIndex?: number;
          nextSetIndex?: number;
        }
      | undefined;

    // Only handle rest-end notifications from this app.
    if (data?.type !== "rest-end") return;
    const notifPlanId = data?.workoutPlanId;
    if (!notifPlanId) return;

    // During cold launch, session is null until AsyncStorage hydration completes.
    // Returning here (without marking handled) causes the effect to re-run
    // once session?.workoutPlanId populates (it's in the deps), so the check
    // runs after hydration.
    if (session === null) return;

    handledNotifIdRef.current = notifId;

    let timer: ReturnType<typeof setTimeout>;

    const role = user?.role;
    const workoutsPath =
      role === "coach" ? "/coach/myTraining" : role === "athlete" ? "/athlete/workouts" : "/student/workouts";
    const execPath =
      role === "coach"
        ? "/coach/workoutExecution"
        : role === "athlete"
        ? "/athlete/workoutExecution"
        : "/student/workoutExecution";

    if (session.workoutPlanId !== notifPlanId) {
      // Stale notification (workout already ended) — navigating to
      // workoutExecution would start a phantom session.
      logger.warn("[notification] tap ignored — no matching active session", {
        notifPlanId,
        activePlanId: session.workoutPlanId,
      });
      timer = setTimeout(() => {
        router.push({ pathname: workoutsPath as any });
      }, 150);
    } else if (pathname.includes("workoutExecution")) {
      // Already on the ongoing workout screen — just re-target the focused
      // set instead of pushing a duplicate instance onto the stack.
      router.setParams({
        nextExerciseIndex: String(data?.nextExerciseIndex ?? -1),
        nextSetIndex: String(data?.nextSetIndex ?? -1),
      });
    } else {
      timer = setTimeout(() => {
        router.push({
          pathname: execPath as any,
          params: {
            workoutPlanId: notifPlanId,
            nextExerciseIndex: String(data?.nextExerciseIndex ?? -1),
            nextSetIndex: String(data?.nextSetIndex ?? -1),
          },
        });
      }, 150);
    }

    return () => clearTimeout(timer);
  // Re-run when the response identifier changes (new tap), the session
  // hydrates (cold-launch: session goes null → planId), or pathname changes
  // (so a tap while navigating settles on the right push-vs-setParams
  // branch). `handledNotifIdRef` guards against reprocessing the same tap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lastResponse?.notification.request.identifier,
    session?.workoutPlanId,
    user?.role,
    pathname,
  ]);

  // Coach tapped a "student completed a workout" push — jump straight to the
  // same workoutComparison screen tapping the row in-app would open.
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as
      | { type?: string; logId?: string }
      | undefined;
    if (data?.type !== "coach-workout-notification") return;
    if (!data.logId || user?.role !== "coach") return;

    workoutService.markNotificationRead(data.logId).catch(() => {});

    const timer = setTimeout(() => {
      router.push({ pathname: "/coach/workoutComparison" as any, params: { logId: data.logId } });
    }, 150);
    return () => clearTimeout(timer);
  }, [lastResponse?.notification.request.identifier, user?.role]);

  // Student tapped a "coach wants to add you" invite push — jump to their
  // notifications tab where they can accept/decline inline.
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as
      | { type?: string; inviteId?: string }
      | undefined;
    if (data?.type !== "invite-created") return;
    if (!data.inviteId || user?.role !== "student") return;

    inviteService.markInviteNotificationRead(data.inviteId, "student").catch(() => {});

    const timer = setTimeout(() => {
      router.push({ pathname: "/student/notifications" as any });
    }, 150);
    return () => clearTimeout(timer);
  }, [lastResponse?.notification.request.identifier, user?.role]);

  // Coach tapped an "invite accepted/declined" push — jump to their
  // notifications tab where the resolved invite is shown.
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as
      | { type?: string; inviteId?: string }
      | undefined;
    if (data?.type !== "invite-responded") return;
    if (!data.inviteId || user?.role !== "coach") return;

    inviteService.markInviteNotificationRead(data.inviteId, "coach").catch(() => {});

    const timer = setTimeout(() => {
      router.push({ pathname: "/coach/notifications" as any });
    }, 150);
    return () => clearTimeout(timer);
  }, [lastResponse?.notification.request.identifier, user?.role]);

  // Student tapped a "new workout assigned" push — jump to their notifications
  // tab, same as tapping the bell (the plan itself is marked read from there).
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as { type?: string } | undefined;
    if (data?.type !== "workout-plan-created") return;
    if (user?.role !== "student") return;

    const timer = setTimeout(() => {
      router.push({ pathname: "/student/notifications" as any });
    }, 150);
    return () => clearTimeout(timer);
  }, [lastResponse?.notification.request.identifier, user?.role]);

  // Student tapped a "workout updated/removed" push — jump straight to the
  // diff (or removed-snapshot) screen for that specific change.
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as
      | { type?: string; changeId?: string }
      | undefined;
    if (data?.type !== "workout-plan-updated" && data?.type !== "workout-plan-deleted") return;
    if (!data.changeId || user?.role !== "student") return;

    workoutService.markChangeRead(data.changeId).catch(() => {});

    const timer = setTimeout(() => {
      router.push({ pathname: "/student/workoutPlanChange" as any, params: { changeId: data.changeId } });
    }, 150);
    return () => clearTimeout(timer);
  }, [lastResponse?.notification.request.identifier, user?.role]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="coach" />
      <Stack.Screen name="student" />
      <Stack.Screen name="athlete" />
    </Stack>
  );
}

export default function Layout() {
  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: Colors.bg,
      card: Colors.bg,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <UnitsProvider>
        <AuthProvider>
          <ActiveWorkoutSessionProvider>
            <ElapsedTimeProvider>
              <ThemeProvider value={navTheme}>
                <ErrorBoundary>
                  <RootNavigator />
                </ErrorBoundary>
              </ThemeProvider>
            </ElapsedTimeProvider>
          </ActiveWorkoutSessionProvider>
        </AuthProvider>
        </UnitsProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
