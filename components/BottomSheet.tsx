import { useEffect, useState, type ReactNode } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, View, type DimensionValue } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const OPEN_DURATION = 260;
const CLOSE_DURATION = 220;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;
// Tuned so the release-driven dismiss/snap-back continues smoothly from the drag's
// own velocity instead of a fixed-duration animation, which is what reads as "not smooth".
const RELEASE_SPRING = { damping: 32, stiffness: 300, mass: 0.9 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Fires once the close animation has actually finished and the underlying Modal has
   * unmounted — not when `onClose` is merely requested. Use this (not `onClose`) to chain
   * opening a different Modal/sheet, since two RN `Modal`s open at once can leave the
   * screen unresponsive.
   */
  onClosed?: () => void;
  /** Rendered inside the draggable zone, right below the handle bar (title/subtitle — not scrollable content). */
  header?: ReactNode;
  /** Rendered below the draggable zone — lists, inputs, buttons. Not part of the drag gesture, so scrollable content works normally. */
  children: ReactNode;
  maxHeight?: DimensionValue;
}

/**
 * Shared bottom-sheet scaffold: backdrop fades in place (doesn't slide with the sheet),
 * sheet slides up/down independently, and the handle + header can be dragged down to dismiss.
 */
export function BottomSheet({ visible, onClose, onClosed, header, children, maxHeight }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: OPEN_DURATION });
      backdropOpacity.value = withTiming(1, { duration: OPEN_DURATION });
    } else if (mounted) {
      const finalizeClose = () => {
        setMounted(false);
        onClosed?.();
      };
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: CLOSE_DURATION });
      backdropOpacity.value = withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
        if (finished) runOnJS(finalizeClose)();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, dragStartY.value + e.translationY);
    })
    .onEnd((e) => {
      if (translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        // Continue the slide-out from wherever the finger released it, carrying the
        // release velocity into the spring — no hand-off to a JS round-trip mid-motion.
        translateY.value = withSpring(SCREEN_HEIGHT, { ...RELEASE_SPRING, velocity: e.velocityY }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
        backdropOpacity.value = withTiming(0, { duration: CLOSE_DURATION });
      } else {
        translateY.value = withSpring(0, { ...RELEASE_SPRING, velocity: e.velocityY });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* RN's Modal renders into a separate native root — gesture-handler needs its own
          GestureHandlerRootView inside it to recognize gestures reliably (notably on Android). */}
      <GestureHandlerRootView style={styles.root}>
        {/* Normal (non-absolute) flex flow, bottom-anchored — the sheet's `maxHeight` percentage
            and its children's intrinsic sizing resolve reliably against this, unlike pinning the
            sheet with `position: absolute`, which left horizontally-scrolling content inside it
            (e.g. the muscle-filter pills) with no dependable cross-axis height to lay out against. */}
        <View style={styles.overlay}>
          <AnimatedPressable style={[styles.backdrop, backdropStyle]} onPress={onClose} />
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              { paddingBottom: Math.max(insets.bottom, Spacing.md), maxHeight },
            ]}
          >
            <GestureDetector gesture={pan}>
              <View>
                <View style={styles.handle} />
                {header}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
});
