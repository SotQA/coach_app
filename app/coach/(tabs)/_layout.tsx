import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Tabs, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../../theme/colors";
import { FontSizes } from "../../../theme/typography";
import { useI18n } from "../../../context/I18nContext";
import { useCoachFabVisibility } from "../../../context/CoachFabVisibilityContext";
import { SpotlightTarget } from "../../../components/onboarding/SpotlightTarget";

const FAB_SIZE = 56;

export default function CoachTabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const navigation = useNavigation();
  const { setVisible } = useCoachFabVisibility();

  // Mirrors the same transitionStart-driven approach in coach/_layout.tsx,
  // scoped to this "(tabs)" screen within the coach Stack — covers pushes to
  // studentDetails / createWorkoutPlan / notifications and back.
  useEffect(() => {
    setVisible(navigation.isFocused());
    // `transitionStart` is a native-stack-only event not present on the
    // generic navigation type expo-router's useNavigation() returns here.
    const nativeStackNavigation = navigation as unknown as {
      addListener: (
        event: "transitionStart",
        callback: (e: { data: { closing: boolean } }) => void
      ) => () => void;
    };
    return nativeStackNavigation.addListener("transitionStart", (e) => {
      setVisible(!e.data.closing);
    });
  }, [navigation, setVisible]);

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
        tabBarLabelStyle: { fontSize: FontSizes.tiny, fontWeight: "600" },
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
          tabBarButton: ({ ref: _ref, ...props }) => (
            <SpotlightTarget id="coach-tab-students" style={{ flex: 1 }}>
              <Pressable {...props} />
            </SpotlightTarget>
          ),
        }}
      />
      <Tabs.Screen
        name="myTraining"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="fab"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          },
        }}
        options={{
          title: "",
          tabBarLabel: () => null,
          tabBarIcon: () => (
            // Invisible spacer — the real FAB is rendered as an absolute overlay
            // in app/coach/_layout.tsx via CoachSpeedDial.
            <View style={{ width: FAB_SIZE, height: FAB_SIZE }} />
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


