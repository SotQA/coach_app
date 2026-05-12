import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
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
  requestNotificationPermissions,
  setupNotificationChannel,
} from "../services/notificationService";
import ErrorBoundary from "../components/ErrorBoundary";

// Configure how notifications appear when the app is in the foreground.
// Must be called before any notification is received.
configureForegroundHandler();

function RootNavigator() {
  const { loading } = useAuth();
  const { session } = useActiveWorkoutSession();
  const router = useRouter();

  // ── One-time setup on mount ───────────────────────────────────────────────
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Colors.bg).catch(() => {});
    // Create Android notification channel + request permissions silently.
    setupNotificationChannel();
    requestNotificationPermissions();
  }, []);

  // ── Notification tap handler ──────────────────────────────────────────────
  // `useLastNotificationResponse` returns the most recent tapped notification.
  // It persists across renders until the app handles it, so it correctly
  // fires even when the app was launched cold from a notification tap.
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse) return;

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
    // Returning here causes the effect to re-run once session?.workoutPlanId
    // populates (it's in the deps), so the check runs after hydration.
    if (session === null) return;

    let timer: ReturnType<typeof setTimeout>;

    if (session.workoutPlanId !== notifPlanId) {
      // Stale notification (workout already ended) — navigating to
      // workoutExecution would start a phantom session.
      logger.warn("[notification] tap ignored — no matching active session", {
        notifPlanId,
        activePlanId: session.workoutPlanId,
      });
      timer = setTimeout(() => {
        router.push({ pathname: "/student/workouts" });
      }, 150);
    } else {
      timer = setTimeout(() => {
        router.push({
          pathname: "/student/workoutExecution",
          params: {
            workoutPlanId: notifPlanId,
            nextExerciseIndex: String(data?.nextExerciseIndex ?? -1),
            nextSetIndex: String(data?.nextSetIndex ?? -1),
          },
        });
      }, 150);
    }

    return () => clearTimeout(timer);
  // Re-run when the response identifier changes (new tap) or when the
  // session hydrates (cold-launch: session goes null → planId).
  }, [
    lastResponse?.notification.request.identifier,
    session?.workoutPlanId,
  ]);

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
