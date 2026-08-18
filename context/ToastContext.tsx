import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

const DISPLAY_MS = 2000;
const FADE_MS = 200;

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: string) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setMessage(next);
    opacity.value = withTiming(1, { duration: FADE_MS });
    hideTimerRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) scheduleOnRN(setMessage, null);
      });
    }, DISPLAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: Spacing.md,
              right: Spacing.md,
              bottom: insets.bottom + 90,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: Radius.md,
              paddingVertical: 12,
              paddingHorizontal: Spacing.md,
              alignItems: "center",
              zIndex: 9999,
              elevation: 20,
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            },
            animatedStyle,
          ]}
        >
          <Text style={{ ...Typography.section, color: Colors.text, fontWeight: "700" }}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
