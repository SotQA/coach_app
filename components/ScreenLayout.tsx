import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";

export function ScreenLayout({ children, edges }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView edges={edges ?? ["top", "left", "right"]} style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

