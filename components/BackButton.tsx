import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

type BackButtonProps = {
  fallbackCoachHref?: string;
  fallbackStudentHref?: string;
};

export function BackButton({
  fallbackCoachHref = "/coach/dashboard",
  fallbackStudentHref = "/student/workouts",
}: BackButtonProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleBack = () => {
    const canGoBack =
      typeof (router as any).canGoBack === "function" ? (router as any).canGoBack() : false;

    if (canGoBack) {
      router.back();
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    router.replace((user.role === "coach" ? fallbackCoachHref : fallbackStudentHref) as any);
  };

  return (
    <Pressable
      onPress={handleBack}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.pill,
        backgroundColor: Colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: "900" }}>‹</Text>
      <Text style={{ ...Typography.secondary, color: Colors.text, fontWeight: "700" }}>Back</Text>
    </Pressable>
  );
}

