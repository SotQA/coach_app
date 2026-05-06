import { Platform, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../../theme/colors";
import { useI18n } from "../../../context/I18nContext";

export default function CoachTabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const fabShadow =
    Platform.OS === "ios"
      ? {
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 10,
        }
      : { elevation: 10 };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("nav_dashboard"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: t("nav_students"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="fab"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/coach/createStudent");
          },
        }}
        options={{
          title: t("nav_add"),
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                marginTop: -22,
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: Colors.primary,
                alignItems: "center",
                justifyContent: "center",
                ...fabShadow,
              }}
            >
              <Ionicons name="add" size={30} color={Colors.onPrimary} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t("nav_progress"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav_settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
