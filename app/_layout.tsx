import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ActiveWorkoutProvider, useActiveWorkout } from "../context/ActiveWorkoutContext";
import { I18nProvider } from "../context/I18nContext";
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
  const { session } = useActiveWorkout();
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
      | { workoutPlanId?: string }
      | undefined;

    const planId = data?.workoutPlanId ?? session?.workoutPlanId;
    if (!planId) return;

    // Defer slightly to let navigation stack settle after a cold launch.
    const timer = setTimeout(() => {
      router.push({
        pathname: "/student/workoutExecution",
        params: { workoutPlanId: planId },
      });
    }, 150);

    return () => clearTimeout(timer);
  // Re-run when the response identifier changes (new tap) or when the
  // session hydrates (cold-launch case where session loads after the tap).
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
        <AuthProvider>
          <ActiveWorkoutProvider>
            <ThemeProvider value={navTheme}>
              <ErrorBoundary>
                <RootNavigator />
              </ErrorBoundary>
            </ThemeProvider>
          </ActiveWorkoutProvider>
        </AuthProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
