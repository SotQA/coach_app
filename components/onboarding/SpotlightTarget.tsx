import { useEffect, useRef, type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useSpotlightRegistry } from "../../context/SpotlightRegistryContext";

/**
 * Marks a real UI element as a highlightable target for the onboarding
 * spotlight tour. Renders a plain View (never intercepts touch) that
 * registers its ref by `id` so the root-level SpotlightOverlay can measure
 * and cut a hole around it, wherever it lives in the tree.
 */
export function SpotlightTarget({
  id,
  children,
  style,
}: {
  id: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const ref = useRef<View>(null);
  const { registerTarget, unregisterTarget } = useSpotlightRegistry();

  useEffect(() => {
    registerTarget(id, ref);
    return () => unregisterTarget(id);
  }, [id, registerTarget, unregisterTarget]);

  return (
    <View ref={ref} style={style} collapsable={false}>
      {children}
    </View>
  );
}
