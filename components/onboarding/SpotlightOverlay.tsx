import { useEffect, useState } from "react";
import { BackHandler, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Mask, Rect } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../context/I18nContext";
import { useOnboardingTour } from "../../context/OnboardingTourContext";
import { useSpotlightRegistry, type MeasuredRect } from "../../context/SpotlightRegistryContext";
import { onboardingTours, type OnboardingStep } from "../../constants/onboardingTours";
import { PrimaryButton } from "../PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import type { UserRole } from "../../types/User";

const HOLE_PADDING = 6;
const HOLE_RADIUS = Radius.sm;
const TOOLTIP_GAP = 14;
const MEASURE_RETRIES = 5;
const MEASURE_RETRY_DELAY_MS = 120;
// Height of the Next/Done button + Skip text stacked below it, so the
// tooltip never gets pushed low enough to sit under/behind that zone when
// its target (e.g. a bottom-nav tab) is close to the screen edge.
const BOTTOM_UI_RESERVED = 130;

interface Display {
  role: UserRole;
  stepIndex: number;
  step: OnboardingStep;
  hole: MeasuredRect;
}

/**
 * Root-level spotlight tour engine. Reads the active step from
 * OnboardingTourContext, measures its target via SpotlightRegistryContext
 * (targets can live anywhere — including the tab bar, which is outside the
 * screen tree), and renders a real cutout: an SVG mask draws the dimmed
 * backdrop with a transparent hole (not just a border on top of a dim
 * layer), and four invisible bands swallow touches everywhere except that
 * hole, so the real element underneath stays visible and tappable.
 *
 * `display` (as opposed to the raw `activeTour` step) only advances once the
 * next target has actually been measured — tapping Next never shows a
 * half-updated frame (new tooltip text over the old hole position, or a
 * flash to a centered dummy hole while measuring), it just holds the
 * previous step until the next one is ready to swap in atomically.
 *
 * Known limitation: targets are measured in place, with no scroll-into-view.
 * Every current target is on-screen without scrolling for a fresh account
 * (empty dashboards/lists), which is the state the tour always runs in.
 */
export function SpotlightOverlay() {
  const { t } = useI18n();
  const { activeTour, nextStep, prevStep, skip } = useOnboardingTour();
  const { measureTarget } = useSpotlightRegistry();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [display, setDisplay] = useState<Display | null>(null);

  const steps = activeTour ? onboardingTours[activeTour.role] : null;
  const step = steps && activeTour ? steps[activeTour.stepIndex] : null;

  useEffect(() => {
    if (!activeTour || !step) {
      setDisplay(null);
      return undefined;
    }
    let cancelled = false;
    const { role, stepIndex } = activeTour;

    const attempt = (n: number) => {
      measureTarget(step.targetId).then((rect) => {
        if (cancelled) return;
        if (rect) {
          setDisplay({ role, stepIndex, step, hole: rect });
        } else if (n < MEASURE_RETRIES) {
          setTimeout(() => attempt(n + 1), MEASURE_RETRY_DELAY_MS);
        } else {
          // Target never resolved — fall back to a centered rect so the tour
          // can still proceed instead of getting stuck on a blank overlay.
          setDisplay({
            role,
            stepIndex,
            step,
            hole: { x: screenW / 2 - 20, y: screenH / 2 - 10, width: 40, height: 20 },
          });
        }
      });
    };
    attempt(0);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTour?.role, activeTour?.stepIndex, measureTarget]);

  useEffect(() => {
    if (!activeTour) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      skip();
      return true;
    });
    return () => sub.remove();
  }, [activeTour, skip]);

  const isActive = Boolean(activeTour);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = isActive ? withTiming(1, { duration: 300 }) : 0;
  }, [isActive, opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!activeTour || !steps || !display) return null;

  const isLastStep = display.stepIndex === steps.length - 1;

  const holeRect = {
    x: Math.max(0, display.hole.x - HOLE_PADDING),
    y: Math.max(0, display.hole.y - HOLE_PADDING),
    width: display.hole.width + HOLE_PADDING * 2,
    height: display.hole.height + HOLE_PADDING * 2,
  };

  const targetCenterX = holeRect.x + holeRect.width / 2;
  const targetCenterY = holeRect.y + holeRect.height / 2;
  const placement: "above" | "below" = targetCenterY < screenH / 2 ? "below" : "above";
  const align: "flex-start" | "center" | "flex-end" =
    targetCenterX < screenW / 3 ? "flex-start" : targetCenterX > (screenW * 2) / 3 ? "flex-end" : "center";
  const arrowOffset = align === "flex-start" ? 20 : align === "flex-end" ? 20 : 0;

  const arrow = (
    <View
      style={
        placement === "below"
          ? {
              width: 0,
              height: 0,
              borderLeftWidth: 8,
              borderLeftColor: "transparent",
              borderRightWidth: 8,
              borderRightColor: "transparent",
              borderBottomWidth: 8,
              borderBottomColor: Colors.primary,
              marginLeft: align === "flex-start" ? arrowOffset : 0,
              marginRight: align === "flex-end" ? arrowOffset : 0,
            }
          : {
              width: 0,
              height: 0,
              borderLeftWidth: 8,
              borderLeftColor: "transparent",
              borderRightWidth: 8,
              borderRightColor: "transparent",
              borderTopWidth: 8,
              borderTopColor: Colors.primary,
              marginLeft: align === "flex-start" ? arrowOffset : 0,
              marginRight: align === "flex-end" ? arrowOffset : 0,
            }
      }
    />
  );

  const tooltip = (
    <View
      style={{
        maxWidth: Math.min(260, screenW - Spacing.lg * 2),
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: Radius.sm,
        padding: Spacing.sm,
      }}
    >
      <Text style={{ ...Typography.section, color: Colors.primary, marginBottom: 4 }}>{t(display.step.titleKey)}</Text>
      <Text style={{ ...Typography.secondary, lineHeight: 18 }}>{t(display.step.bodyKey)}</Text>
    </View>
  );

  const bands = [
    { x: 0, y: 0, width: screenW, height: holeRect.y },
    { x: 0, y: holeRect.y + holeRect.height, width: screenW, height: Math.max(0, screenH - (holeRect.y + holeRect.height)) },
    { x: 0, y: holeRect.y, width: holeRect.x, height: holeRect.height },
    { x: holeRect.x + holeRect.width, y: holeRect.y, width: Math.max(0, screenW - (holeRect.x + holeRect.width)), height: holeRect.height },
  ];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 999 },
        animStyle,
      ]}
    >
      <Svg width={screenW} height={screenH} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
        <Defs>
          <Mask id="spotlight-hole">
            <Rect x={0} y={0} width={screenW} height={screenH} fill="white" />
            <Rect x={holeRect.x} y={holeRect.y} width={holeRect.width} height={holeRect.height} rx={HOLE_RADIUS} fill="black" />
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={screenW} height={screenH} fill="rgba(0,0,0,0.82)" mask="url(#spotlight-hole)" />
        <Rect
          x={holeRect.x}
          y={holeRect.y}
          width={holeRect.width}
          height={holeRect.height}
          rx={HOLE_RADIUS}
          fill="none"
          stroke={Colors.primary}
          strokeWidth={2}
        />
      </Svg>

      {bands.map((band, i) =>
        band.width <= 0 || band.height <= 0 ? null : (
          <Pressable
            key={i}
            onPress={() => {}}
            style={{ position: "absolute", left: band.x, top: band.y, width: band.width, height: band.height }}
          />
        )
      )}

      <View
        style={{
          position: "absolute",
          top: insets.top + Spacing.sm,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: 5,
        }}
      >
        {steps.map((_, i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === display.stepIndex ? Colors.primary : Colors.border,
            }}
          />
        ))}
      </View>

      <View
        style={
          placement === "below"
            ? { position: "absolute", top: holeRect.y + holeRect.height + TOOLTIP_GAP, left: 0, right: 0, paddingHorizontal: Spacing.md, alignItems: align }
            : {
                position: "absolute",
                bottom: Math.max(insets.bottom + BOTTOM_UI_RESERVED, screenH - holeRect.y + TOOLTIP_GAP),
                left: 0,
                right: 0,
                paddingHorizontal: Spacing.md,
                alignItems: align,
              }
        }
      >
        {placement === "below" ? (
          <>
            {arrow}
            {tooltip}
          </>
        ) : (
          <>
            {tooltip}
            {arrow}
          </>
        )}
      </View>

      <View
        style={{
          position: "absolute",
          bottom: insets.bottom + Spacing.md,
          left: 0,
          right: 0,
          alignItems: "center",
          paddingHorizontal: Spacing.xl,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, width: "100%" }}>
          {display.stepIndex > 0 ? (
            <Pressable
              onPress={prevStep}
              accessibilityRole="button"
              accessibilityLabel={t("back")}
              style={({ pressed }) => ({
                width: 50,
                height: 50,
                borderRadius: Radius.lg,
                borderWidth: 1.5,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <PrimaryButton title={isLastStep ? t("onboardingDone") : t("onboardingNext")} onPress={nextStep} />
          </View>
        </View>
        <Text
          onPress={skip}
          accessibilityRole="button"
          style={{
            marginTop: Spacing.sm,
            color: "#666",
            fontSize: 11,
            padding: Spacing.xs,
          }}
        >
          {t("onboardingSkip")}
        </Text>
      </View>
    </Animated.View>
  );
}
