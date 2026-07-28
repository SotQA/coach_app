import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { workoutService } from "../services/workoutService";
import { Colors } from "../theme/colors";
import { Radius } from "../theme/spacing";

/**
 * Bell icon + unread-count badge used across every coach tab. Fetches its own
 * unread count so screens can drop it in without prop drilling.
 */
export function NotificationBellButton() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user || user.role !== "coach") return;
      let cancelled = false;
      workoutService
        .getUnreadNotificationCount(user.id)
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch(() => {
          // Non-fatal: badge just stays at its last known value.
        });
      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.role])
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("notifications")}
      onPress={() => router.push("/coach/notifications" as any)}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: Radius.xl,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
      {unreadCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 3,
            backgroundColor: Colors.danger,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 12 }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
