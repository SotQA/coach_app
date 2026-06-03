import { Platform, Pressable, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

const FAB_SIZE = 56;

const ALLOWED_PATHS = [
  "/coach/dashboard",
  "/coach/students",
  "/coach/myTraining",
  "/coach/progress",
  "/coach/profile",
];

const fabShadow =
  Platform.OS === "ios"
    ? {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      }
    : { elevation: 10 };

export function CoachSpeedDial() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const visible = ALLOWED_PATHS.some((p) => pathname === p);
  const bottomOffset = Math.max(insets.bottom, 8) - 22 + FAB_SIZE / 2;

  return (
    <View
      pointerEvents={visible ? "box-none" : "none"}
      style={{
        position: "absolute",
        bottom: bottomOffset,
        alignSelf: "center",
        zIndex: 1000,
        opacity: visible ? 1 : 0,
      }}
    >
      <Pressable
        onPress={() => router.push("/coach/createStudent")}
        accessibilityRole="button"
        accessibilityLabel="Add student"
        hitSlop={8}
      >
        <View
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: Colors.primary,
            alignItems: "center",
            justifyContent: "center",
            ...fabShadow,
          }}
        >
          <Ionicons name="add" size={30} color={Colors.onPrimary} />
        </View>
      </Pressable>
    </View>
  );
}
