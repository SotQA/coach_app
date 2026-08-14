import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { View } from "react-native";

export type MeasuredRect = { x: number; y: number; width: number; height: number };

interface SpotlightRegistryValue {
  registerTarget: (id: string, ref: RefObject<View | null>) => void;
  unregisterTarget: (id: string) => void;
  measureTarget: (id: string) => Promise<MeasuredRect | null>;
}

const SpotlightRegistryContext = createContext<SpotlightRegistryValue | undefined>(undefined);

/**
 * Cross-tree registry of onboarding spotlight targets. The tour overlay is
 * mounted at the app root, so it can't hold refs to elements deep inside
 * arbitrary screens (or the tab bar, which lives outside the screen tree
 * entirely) — components register themselves here instead via SpotlightTarget.
 */
export function SpotlightRegistryProvider({ children }: { children: ReactNode }) {
  const targets = useRef(new Map<string, RefObject<View | null>>());

  const registerTarget = useCallback((id: string, ref: RefObject<View | null>) => {
    targets.current.set(id, ref);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targets.current.delete(id);
  }, []);

  const measureTarget = useCallback((id: string): Promise<MeasuredRect | null> => {
    const ref = targets.current.get(id);
    const node = ref?.current;
    if (!node) return Promise.resolve(null);
    return new Promise((resolve) => {
      node.measureInWindow((x, y, width, height) => {
        if (!Number.isFinite(x) || (width === 0 && height === 0)) {
          resolve(null);
          return;
        }
        resolve({ x, y, width, height });
      });
    });
  }, []);

  return (
    <SpotlightRegistryContext.Provider value={{ registerTarget, unregisterTarget, measureTarget }}>
      {children}
    </SpotlightRegistryContext.Provider>
  );
}

export function useSpotlightRegistry(): SpotlightRegistryValue {
  const ctx = useContext(SpotlightRegistryContext);
  if (!ctx) throw new Error("useSpotlightRegistry must be used within a SpotlightRegistryProvider");
  return ctx;
}
