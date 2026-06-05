import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useActiveWorkoutSession } from "../context/ActiveWorkoutSessionContext";
import { useI18n } from "../context/I18nContext";
import { workoutService } from "../services/workoutService";
import type { LoggedSet, WorkoutPlan } from "../types/Workout";
import {
  computeExerciseVolumeFromLoggedSets,
  computeTotalVolume,
  normalizeExerciseName,
} from "../utils/workoutMetrics";
import { parseKgInput } from "../utils/inputParsing";

// Mirrors the local draft types in workoutExecution — using `done` instead of `completed`.
type SetDraft = { weight: string; reps: string; rpe: string; done: boolean };
type ExerciseDraft = { sets: SetDraft[] };

interface FinishInput {
  plan: WorkoutPlan;
  drafts: ExerciseDraft[];
  notes: string;
  bestWeightByExercise: Map<string, number>;
}

interface UseFinishWorkout {
  finishWorkout: (input: FinishInput) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
}

/**
 * Encapsulates the "Finish workout" flow:
 * validation → analytics (volume / PR detection) → Firestore write
 * → session clear → navigation.
 *
 * On success: navigates to workoutHistory and clears the active session.
 * On failure: sets `submitError`; the session is kept intact so the user can retry.
 */
export function useFinishWorkout(): UseFinishWorkout {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const activeWorkout = useActiveWorkoutSession();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const finishWorkout = async ({ plan, drafts, notes, bestWeightByExercise }: FinishInput) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (!authUser || !["student", "coach", "athlete"].includes(authUser.role)) {
        setSubmitError("You must be logged in.");
        return;
      }

      const completedExercises = plan.exercises.map((exercise, exIdx) => {
        const draft = drafts[exIdx];
        if (!draft || draft.sets.length === 0) {
          throw new Error(`Missing set data for "${exercise.name}".`);
        }

        const loggedSets: LoggedSet[] = draft.sets.map((d, si) => {
          if (!d.done) {
            return { setNumber: si + 1, reps: 0, weight: null };
          }
          const raw = String(d.reps).trim();
          const r = raw === "" ? 0 : Number(raw);
          if (!Number.isFinite(r) || !Number.isInteger(r) || r < 0) {
            throw new Error(
              `Set ${si + 1} (${exercise.name}): use a whole number for reps (0 skips the set).`
            );
          }
          let weightOut: number | null = null;
          if (r > 0) {
            const trimmedW = d.weight.trim();
            if (trimmedW !== "") {
              const w = parseKgInput(d.weight);
              if (w === null) {
                throw new Error(`Set ${si + 1} (${exercise.name}): invalid weight.`);
              }
              weightOut = w;
            }
          }
          return { setNumber: si + 1, reps: r, weight: weightOut };
        });

        const exKey = normalizeExerciseName(exercise.name);
        const prevBest = bestWeightByExercise.get(exKey);
        const maxKg = Math.max(
          0,
          ...loggedSets
            .filter((s) => s.reps > 0)
            .map((s) => (s.weight != null && Number.isFinite(s.weight) ? s.weight : 0))
        );
        const isPr = maxKg > 0 && (prevBest === undefined || maxKg > prevBest);
        const volume = computeExerciseVolumeFromLoggedSets(loggedSets);

        return {
          name: exercise.name,
          repsPlanned: String(exercise.reps ?? ""),
          sets: loggedSets,
          rest: exercise.rest ?? "",
          tempo: exercise.tempo ?? "",
          rpe: exercise.rpe ?? null,
          volume,
          isPr,
        };
      });

      const totalVolume = computeTotalVolume(completedExercises);
      const prNames = completedExercises.filter((e) => e.isPr).map((e) => e.name);

      // Duration derived from session startedAt for accuracy across app reopens.
      const startedAt = activeWorkout.session?.startedAt ?? Date.now();
      const durationSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

      await workoutService.logCompletedWorkout({
        studentId: authUser.id,
        workoutPlanId: plan.id,
        workoutName: plan.name,
        exercises: completedExercises,
        completedAt: new Date().toISOString(),
        totalVolume,
        durationSeconds,
        sessionNotes: notes.trim() || undefined,
        coachId: authUser.role === "student" ? plan.coachId : undefined,
      });

      // Clear the active session from context + AsyncStorage.
      await activeWorkout.finishSession();

      if (prNames.length > 0) {
        Alert.alert(t("greatSession"), `🔥 New PR on: ${prNames.join(", ")}`);
      }

      const dest =
        authUser.role === "coach"
          ? "/coach/myTraining"
          : authUser.role === "athlete"
          ? "/athlete/workouts"
          : "/student/workoutHistory";
      router.replace(dest as any);
    } catch (e: any) {
      setSubmitError(e.message ?? "Failed to save workout.");
    } finally {
      setSubmitting(false);
    }
  };

  return { finishWorkout, submitting, submitError };
}
