import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";

export function ScreenLayout({ children }: { children: ReactNode }) {
  // Note: we no longer render a persistent footer (logout now lives in Profile).
  // Keeping SafeAreaView ensures bottom safe-area inset is respected.
  useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

