import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useFocusEffect } from "@react-navigation/native";

type CoachFabVisibilityValue = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

const CoachFabVisibilityContext = createContext<CoachFabVisibilityValue | undefined>(undefined);

export function CoachFabVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  return (
    <CoachFabVisibilityContext.Provider value={{ visible, setVisible }}>
      {children}
    </CoachFabVisibilityContext.Provider>
  );
}

export function useCoachFabVisibility() {
  const ctx = useContext(CoachFabVisibilityContext);
  if (!ctx) {
    throw new Error("useCoachFabVisibility must be used within a CoachFabVisibilityProvider");
  }
  return ctx;
}

/**
 * Forces the speed-dial FAB hidden for as long as the calling screen is
 * focused — for screens with their own sticky bottom action bar (e.g. a
 * "Save" button pinned to the bottom), which the FAB would otherwise overlap.
 * `CoachSpeedDial`'s default visibility is driven by Stack-level
 * `transitionStart` listeners in coach/_layout.tsx and coach/(tabs)/_layout.tsx,
 * which track section-level focus, not which individual screen is on top —
 * this hook is the authoritative per-screen override, applied last (on the
 * 'focus' event, which fires after those transition-start listeners).
 */
export function useHideCoachFabOnFocus() {
  const { setVisible } = useCoachFabVisibility();
  useFocusEffect(
    useCallback(() => {
      setVisible(false);
      return () => setVisible(true);
    }, [setVisible])
  );
}
