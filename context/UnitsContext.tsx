import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { formatWeight } from "@/utils/units";

const UNITS_STORAGE_KEY = "prefs.units.v1";

export type WeightUnit = "kg" | "lb";

function isValidUnit(v: unknown): v is WeightUnit {
  return v === "kg" || v === "lb";
}

interface UnitsContextValue {
  unit: WeightUnit;
  setUnit: (u: WeightUnit) => Promise<void>;
  /** Convenience wrapper — converts a kg value to the active unit string. */
  formatWeight: (kg: number | null | undefined) => string;
}

const UnitsContext = createContext<UnitsContextValue | undefined>(undefined);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<WeightUnit>("kg");

  useEffect(() => {
    const init = async () => {
      try {
        const saved = await AsyncStorage.getItem(UNITS_STORAGE_KEY);
        if (isValidUnit(saved)) {
          setUnitState(saved);
        }
      } catch {
        // Keep default "kg" on storage error
      }
    };
    init();
  }, []);

  const setUnit = useCallback(async (u: WeightUnit) => {
    setUnitState(u);
    try {
      await AsyncStorage.setItem(UNITS_STORAGE_KEY, u);
    } catch {
      // Non-critical — UI is already updated
    }
  }, []);

  const fmtWeight = useCallback(
    (kg: number | null | undefined) => formatWeight(kg, unit),
    [unit]
  );

  const value = useMemo(
    () => ({ unit, setUnit, formatWeight: fmtWeight }),
    [unit, setUnit, fmtWeight]
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}
