import { useRef } from "react";
import { TextInput } from "react-native";

type InputSet = { weight: TextInput | null; reps: TextInput | null; rpe: TextInput | null };

export interface SetInputRefs {
  /**
   * Call inside each input's `ref` callback so the hook can track it.
   * exIdx → exercise index, setIdx → set index within that exercise.
   */
  registerRef: (
    exIdx: number,
    setIdx: number,
    field: "weight" | "reps" | "rpe",
    node: TextInput | null
  ) => void;
  /**
   * Focus the weight input of the next set after the given position.
   * Rule (preserved from original screen logic):
   *   1. Try the next set in the same exercise.
   *   2. If none, try the first set of the next exercise.
   *   3. If neither exists, do nothing.
   *
   * Uses a 80 ms setTimeout to match the original deferral timing (gives the
   * keyboard time to fully open before the focus request lands).
   */
  focusNextSet: (currentExIdx: number, currentSetIdx: number) => void;
  /** Clear the ref map — call when the workout plan changes so stale refs don't linger. */
  reset: () => void;
}

export function useSetInputRefs(): SetInputRefs {
  const inputRefs = useRef<InputSet[][]>([]);

  const registerRef = (
    exIdx: number,
    setIdx: number,
    field: "weight" | "reps" | "rpe",
    node: TextInput | null
  ) => {
    inputRefs.current[exIdx] = inputRefs.current[exIdx] ?? [];
    inputRefs.current[exIdx][setIdx] = inputRefs.current[exIdx][setIdx] ?? {
      weight: null,
      reps: null,
      rpe: null,
    };
    inputRefs.current[exIdx][setIdx][field] = node;
  };

  const focusNextSet = (currentExIdx: number, currentSetIdx: number) => {
    setTimeout(() => {
      const currentExRefs = inputRefs.current[currentExIdx];
      const nSetsInEx = currentExRefs?.length ?? 0;

      if (currentSetIdx + 1 < nSetsInEx) {
        // Next set in the same exercise.
        currentExRefs[currentSetIdx + 1]?.weight?.focus();
        return;
      }

      // First set of the next exercise.
      inputRefs.current[currentExIdx + 1]?.[0]?.weight?.focus();
    }, 80);
  };

  const reset = () => {
    inputRefs.current = [];
  };

  return { registerRef, focusNextSet, reset };
}
