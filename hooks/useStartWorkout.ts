import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useActiveWorkoutSession } from "../context/ActiveWorkoutSessionContext";

type StartWorkoutTarget = {
  workoutPlanId: string;
  groupId?: string;
  workoutName?: string;
};

/**
 * Shared entry point for every "start/resume a workout" tap (workout list
 * cards, workout detail's Start button, resume banners). Only one workout
 * can be in progress at a time — if a session is already active for a
 * *different* plan, this blocks the navigation and offers to jump to the
 * in-progress one instead of silently starting a second session.
 */
export function useStartWorkout() {
  const router = useRouter();
  const { user } = useAuth();
  const { session } = useActiveWorkoutSession();

  const execPath =
    user?.role === "coach"
      ? "/coach/workoutExecution"
      : user?.role === "athlete"
      ? "/athlete/workoutExecution"
      : "/student/workoutExecution";

  return useCallback(
    (target: StartWorkoutTarget) => {
      if (session && session.workoutPlanId !== target.workoutPlanId) {
        Alert.alert(
          "Workout in progress",
          `You already have "${session.workoutName}" in progress. Finish or discard it before starting another workout.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Go to workout",
              onPress: () =>
                router.push({
                  pathname: execPath as any,
                  params: { workoutPlanId: session.workoutPlanId },
                }),
            },
          ]
        );
        return;
      }

      router.push({
        pathname: execPath as any,
        params: session
          ? { workoutPlanId: session.workoutPlanId }
          : {
              workoutPlanId: target.workoutPlanId,
              groupId: target.groupId ?? "",
              workoutName: target.workoutName ?? "",
            },
      });
    },
    [session, execPath, router]
  );
}
