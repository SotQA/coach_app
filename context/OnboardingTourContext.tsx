import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import type { UserRole } from "../types/User";
import { onboardingTours } from "../constants/onboardingTours";

const storageKeyFor = (uid: string) => `hasSeenOnboarding:${uid}`;

interface ActiveTour {
  role: UserRole;
  stepIndex: number;
}

interface OnboardingTourContextValue {
  hasSeenOnboarding: boolean;
  pendingWelcome: { firstName: string } | null;
  activeTour: ActiveTour | null;
  /** Called right after registration succeeds. No-op once the tour has already been seen. */
  presentWelcome: (firstName: string) => void;
  startTour: (role: UserRole) => void;
  nextStep: () => void;
  prevStep: () => void;
  skip: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | undefined>(undefined);

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  // Keyed per account, not per device — the provider stays mounted across
  // logout/login, and AsyncStorage is device-scoped, so a single global flag
  // meant one account finishing the tour silently skipped it for every other
  // account created on the same install afterward.
  const [seenByUid, setSeenByUid] = useState<Record<string, boolean>>({});
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const [pendingWelcome, setPendingWelcome] = useState<{ firstName: string } | null>(null);
  const [activeTour, setActiveTour] = useState<ActiveTour | null>(null);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(storageKeyFor(uid));
        if (cancelled) return;
        setSeenByUid((prev) => ({ ...prev, [uid]: saved === "true" }));
      } catch {
        // Default to "seen" on storage error — never block the app on a broken tour.
        if (!cancelled) setSeenByUid((prev) => ({ ...prev, [uid]: true }));
      } finally {
        if (!cancelled) setHydratedUid(uid);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const hydrated = uid !== null && hydratedUid === uid;
  const hasSeenOnboarding = uid === null ? true : seenByUid[uid] ?? true;

  const markSeen = useCallback(async () => {
    if (!uid) return;
    setSeenByUid((prev) => ({ ...prev, [uid]: true }));
    try {
      await AsyncStorage.setItem(storageKeyFor(uid), "true");
    } catch {
      // Non-critical — worst case the tour reappears next launch.
    }
  }, [uid]);

  const presentWelcome = useCallback((firstName: string) => {
    setPendingWelcome({ firstName });
  }, []);

  // Guards against showing the splash when AsyncStorage turns out to say this
  // account already saw the tour (also self-heals the rare race where
  // presentWelcome fires before hydration for the current uid finishes).
  useEffect(() => {
    if (hydrated && hasSeenOnboarding) setPendingWelcome(null);
  }, [hydrated, hasSeenOnboarding]);

  const startTour = useCallback((role: UserRole) => {
    setPendingWelcome(null);
    setActiveTour({ role, stepIndex: 0 });
  }, []);

  const nextStep = useCallback(() => {
    setActiveTour((prev) => {
      if (!prev) return prev;
      const steps = onboardingTours[prev.role];
      const nextIndex = prev.stepIndex + 1;
      if (nextIndex >= steps.length) {
        markSeen();
        return null;
      }
      return { ...prev, stepIndex: nextIndex };
    });
  }, [markSeen]);

  const prevStep = useCallback(() => {
    setActiveTour((prev) => {
      if (!prev || prev.stepIndex === 0) return prev;
      return { ...prev, stepIndex: prev.stepIndex - 1 };
    });
  }, []);

  const skip = useCallback(() => {
    setPendingWelcome(null);
    setActiveTour(null);
    markSeen();
  }, [markSeen]);

  return (
    <OnboardingTourContext.Provider
      value={{ hasSeenOnboarding, pendingWelcome, activeTour, presentWelcome, startTour, nextStep, prevStep, skip }}
    >
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) throw new Error("useOnboardingTour must be used within an OnboardingTourProvider");
  return ctx;
}
