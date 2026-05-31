import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { Radius } from "../theme/spacing";
import { Typography } from "../theme/typography";

const FAB_SIZE = 56;
// Vertical gap each item travels from the FAB to its open position.
const ITEM_STEP = 72;

const fabShadow =
  Platform.OS === "ios"
    ? {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      }
    : { elevation: 10 };

function SpeedDialItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {/* Label pill to the left of the icon */}
      <View
        style={{
          backgroundColor: Colors.card,
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: Radius.pill,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
      >
        <Text
          style={{
            ...Typography.section,
            color: Colors.text,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </View>

      {/* Icon circle */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: Colors.card,
          borderWidth: 1,
          borderColor: Colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
    </Pressable>
  );
}

export function CoachSpeedDial() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  // Item 1 = "My Training" (closer to FAB)
  const item1Y = useSharedValue(0);
  const item1Opacity = useSharedValue(0);
  // Item 2 = "Add Student" (further from FAB)
  const item2Y = useSharedValue(0);
  const item2Opacity = useSharedValue(0);

  const backdropOpacity = useSharedValue(0);
  const addOpacity = useSharedValue(1);
  const closeOpacity = useSharedValue(0);

  const SPRING = { damping: 16, stiffness: 220 } as const;

  const openMenu = () => {
    setIsOpen(true);
    backdropOpacity.value = withTiming(0.45, { duration: 180 });
    addOpacity.value = withTiming(0, { duration: 120 });
    closeOpacity.value = withTiming(1, { duration: 180 });

    item1Y.value = withSpring(-ITEM_STEP, SPRING);
    item1Opacity.value = withTiming(1, { duration: 200 });

    item2Y.value = withSpring(-ITEM_STEP * 2, SPRING);
    item2Opacity.value = withTiming(1, { duration: 250 });
  };

  const closeMenu = (then?: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 180 });
    addOpacity.value = withTiming(1, { duration: 180 });
    closeOpacity.value = withTiming(0, { duration: 120 });

    item1Y.value = withSpring(0, SPRING);
    item1Opacity.value = withTiming(0, { duration: 150 });

    item2Y.value = withSpring(0, SPRING);
    // Delay setIsOpen(false) until animation finishes so items don't flicker off.
    item2Opacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setIsOpen)(false);
      if (then) runOnJS(then)();
    });
  };

  const toggle = () => {
    if (isOpen) closeMenu();
    else openMenu();
  };

  const navigate = (path: string) => {
    closeMenu(() => router.push(path as any));
  };

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const item1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: item1Y.value }],
    opacity: item1Opacity.value,
  }));
  const item2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: item2Y.value }],
    opacity: item2Opacity.value,
  }));
  const addIconStyle = useAnimatedStyle(() => ({ opacity: addOpacity.value, position: "absolute" }));
  const closeIconStyle = useAnimatedStyle(() => ({ opacity: closeOpacity.value, position: "absolute" }));

  // Position the FAB at the same vertical centre as the original tab-bar FAB.
  // Tab bar: height = 56 + max(insets.bottom, 8), paddingBottom = max(insets.bottom, 8).
  // The FAB button had marginTop = -22 which floats it above the tab bar.
  const bottomOffset = Math.max(insets.bottom, 8) - 22 + (FAB_SIZE / 2);

  return (
    <>
      {/* Semi-transparent backdrop — only mounted when open so it doesn't eat touches when closed */}
      {isOpen ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#000",
              zIndex: 998,
            },
            backdropStyle,
          ]}
          pointerEvents="box-none"
        >
          <Pressable style={{ flex: 1 }} onPress={() => closeMenu()} />
        </Animated.View>
      ) : null}

      {/* Speed-dial container — anchored at the FAB centre */}
      <View
        style={{
          position: "absolute",
          bottom: bottomOffset,
          alignSelf: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
        pointerEvents="box-none"
      >
        {/* Item 2: Add Student (top, further from FAB) */}
        <Animated.View
          style={[{ position: "absolute", bottom: 0 }, item2Style]}
          pointerEvents={isOpen ? "auto" : "none"}
        >
          <SpeedDialItem
            icon="person-add-outline"
            label="Add Student"
            onPress={() => navigate("/coach/createStudent")}
          />
        </Animated.View>

        {/* Item 1: My Training (bottom, closer to FAB) */}
        <Animated.View
          style={[{ position: "absolute", bottom: 0 }, item1Style]}
          pointerEvents={isOpen ? "auto" : "none"}
        >
          <SpeedDialItem
            icon="barbell-outline"
            label="My Training"
            onPress={() => navigate("/coach/myTraining")}
          />
        </Animated.View>

        {/* FAB button */}
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? "Close menu" : "Open menu"}
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
            <Animated.View style={addIconStyle}>
              <Ionicons name="add" size={30} color={Colors.onPrimary} />
            </Animated.View>
            <Animated.View style={closeIconStyle}>
              <Ionicons name="close" size={30} color={Colors.onPrimary} />
            </Animated.View>
          </View>
        </Pressable>
      </View>
    </>
  );
}
