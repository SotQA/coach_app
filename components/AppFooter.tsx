import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "./PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { Colors } from "../theme/colors";
import { Spacing } from "../theme/spacing";

export const APP_FOOTER_HEIGHT = 56;

export function AppFooter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: insets.bottom,
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.card,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
      }}
    >
      <View style={{ height: APP_FOOTER_HEIGHT }}>
        <PrimaryButton
          title="Logout"
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        />
      </View>
    </View>
  );
}

