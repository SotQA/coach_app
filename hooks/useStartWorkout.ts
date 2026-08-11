import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
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
  const { t } = useI18n();
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
          t("workoutInProgressTitle"),
          t("workoutInProgressBody", { name: session.workoutName }),
          [
            { text: t("cancel"), style: "cancel" },
            {
              text: t("goToWorkoutButton"),
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
    [session, execPath, router, t]
  );
}
