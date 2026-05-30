import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { workoutService } from "../services/workoutService";
import type { WorkoutLog, WorkoutPlan } from "../types/Workout";
import { buildBestWeightMapFromLogs, buildLastResultsMapFromLogs, type LastSetResult } from "../utils/workoutMetrics";
import { logger } from "../utils/logger";
import { useAsyncData, type AsyncDataState } from "./useAsyncData";

export interface WorkoutExecutionData {
  plan: WorkoutPlan;
  priorLogs: WorkoutLog[];
  /** Normalized exercise-name → best-lifted-kg (all-time max), pre-computed from priorLogs. */
  bestWeightByExercise: Map<string, number>;
  /** Normalized exercise-name → sets from the most recent session, for display on exercise cards. */
  lastResultsByExercise: Map<string, LastSetResult[]>;
}

/**
 * Loads the workout plan and the student's prior logs in parallel.
 * Computes the best-weight map from logs so the screen doesn't need to.
 *
 * Returns `data = null` (and `loading = false`) when `planId` is empty.
 * On a partial failure (history fetch only), tolerates the error and returns
 * an empty log array so the screen can still function.
 */
export function useWorkoutExecutionData(
  planId: string | undefined
): AsyncDataState<WorkoutExecutionData | null> {
  const { user } = useAuth();

  const fetcher = useCallback(async (): Promise<WorkoutExecutionData | null> => {
    if (!planId) return null;
    if (!user || user.role !== "student") {
      throw new Error("You must be logged in as a student.");
    }

    const [planResult, historyResult] = await Promise.allSettled([
      workoutService.getWorkoutPlanById(planId),
      workoutService.getWorkoutHistory(user.id),
    ]);

    if (planResult.status === "rejected") {
      throw new Error(
        planResult.reason instanceof Error
          ? planResult.reason.message
          : "Failed to load workout plan."
      );
    }

    const plan = planResult.value;
    if (!plan) throw new Error("Workout plan not found.");
    if (plan.studentId !== user.id) throw new Error("You don't have access to this workout plan.");

    if (historyResult.status === "rejected") {
      logger.warn("[useWorkoutExecutionData] history fetch failed", historyResult.reason);
    }
    const priorLogs: WorkoutLog[] =
      historyResult.status === "fulfilled" && Array.isArray(historyResult.value)
        ? historyResult.value
        : [];

    const bestWeightByExercise = buildBestWeightMapFromLogs(priorLogs);
    const lastResultsByExercise = buildLastResultsMapFromLogs(priorLogs);

    return { plan, priorLogs, bestWeightByExercise, lastResultsByExercise };
  }, [planId, user]);

  return useAsyncData<WorkoutExecutionData | null>(fetcher, [fetcher]);
}
