import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import * as SystemUI from "expo-system-ui";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Colors } from "../theme/colors";

function RootNavigator() {
  const { loading } = useAuth();

  useEffect(() => {
    // Ensures iOS interactive back-swipe can't reveal a white root background.
    // This is applied at runtime (works in Expo Go too).
    SystemUI.setBackgroundColorAsync(Colors.bg).catch(() => {});
  }, []);

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
    <Stack
      screenOptions={{ headerShown: false }}
    >
      {/* Top-level groups */}
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
    <AuthProvider>
      <ThemeProvider value={navTheme}>
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}