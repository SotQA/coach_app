import type { WeightUnit } from "@/context/UnitsContext";

export const KG_TO_LB = 2.2046226218;

/** Convert a kg value into the active display unit. Returns null on invalid input. */
export function toUnit(kg: number | null | undefined, unit: WeightUnit): number | null {
  if (kg == null || !Number.isFinite(kg)) return null;
  return unit === "lb" ? kg * KG_TO_LB : kg;
}

/** Convert an input value (in the active unit) back into kg for storage. */
export function toKg(value: number | null | undefined, unit: WeightUnit): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return unit === "lb" ? value / KG_TO_LB : value;
}

/** Display: "60 kg" / "132.28 lb" / "—" for null. Preserves up to 2 decimal places. */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  const v = toUnit(kg, unit);
  if (v == null) return "—";
  return `${parseFloat(v.toFixed(2))} ${unit}`;
}

/** Short suffix: "kg" or "lb". For inline labels next to inputs. */
export function unitSuffix(unit: WeightUnit): string {
  return unit;
}
