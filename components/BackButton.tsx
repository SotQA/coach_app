import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { Colors } from "../theme/colors";
import { Radius } from "../theme/spacing";
import { Typography } from "../theme/typography";

type BackButtonProps = {
  fallbackCoachHref?: string;
  fallbackStudentHref?: string;
  /**
   * When used in a navigation header, only render if there is a back stack.
   * Prevents showing a "Back" chip on root screens.
   */
  hideIfNoBack?: boolean;
};

export function BackButton({
  fallbackCoachHref = "/coach/dashboard",
  fallbackStudentHref = "/student/workouts",
  hideIfNoBack = false,
}: BackButtonProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const handleBack = () => {
    const canGoBack =
      typeof (router as any).canGoBack === "function" ? (router as any).canGoBack() : false;

    if (canGoBack) {
      router.back();
      return;
    }

    if (!user) {
      if (!loading) router.replace("/login");
      return;
    }

    router.replace((user.role === "coach" ? fallbackCoachHref : fallbackStudentHref) as any);
  };

  const canGoBack =
    typeof (router as any).canGoBack === "function" ? (router as any).canGoBack() : false;
  if (hideIfNoBack && !canGoBack) return null;

  return (
    <Pressable
      onPress={handleBack}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: Radius.pill,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        // Subtle chip shadow like native back buttons.
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ marginLeft: -2 }}>
        <Ionicons name="chevron-back" size={18} color={Colors.text} />
      </View>
      <Text style={{ ...Typography.secondary, color: Colors.text, fontWeight: "700" }}>Back</Text>
    </Pressable>
  );
}

