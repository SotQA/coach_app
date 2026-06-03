import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";

export function ScreenLayout({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

