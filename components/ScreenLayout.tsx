import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppFooter, APP_FOOTER_HEIGHT } from "./AppFooter";
import { Colors } from "../theme/colors";
import { Spacing } from "../theme/spacing";

export function ScreenLayout({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const footerSpace = APP_FOOTER_HEIGHT + Spacing.sm + insets.bottom;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ flex: 1, paddingBottom: footerSpace }}>{children}</View>
      <AppFooter />
    </SafeAreaView>
  );
}

