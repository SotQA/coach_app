import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface WorkoutLogDoc {
  coachId?: string;
  studentId?: string;
  workoutName?: string;
  notificationRead?: boolean;
}

interface UserDoc {
  expoPushToken?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
}

function studentDisplayName(user: UserDoc | undefined): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || user?.email || "A student";
}

/**
 * Notifies a coach (via Expo push) the moment a student completes a workout.
 * Mirrors the in-app coach notification feed (workoutLogs.notificationRead),
 * but fires even when the coach's app is closed/backgrounded/killed.
 */
export const notifyCoachOnWorkoutCompleted = onDocumentCreated(
  "workoutLogs/{logId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const log = snap.data() as WorkoutLogDoc;
    if (!log.coachId || log.notificationRead !== false) return;

    const db = getFirestore();

    try {
      const [coachSnap, studentSnap] = await Promise.all([
        db.collection("users").doc(log.coachId).get(),
        log.studentId ? db.collection("users").doc(log.studentId).get() : Promise.resolve(null),
      ]);

      const coach = coachSnap.exists ? (coachSnap.data() as UserDoc) : undefined;
      const token = coach?.expoPushToken;
      if (!token) return;

      const student = studentSnap && studentSnap.exists ? (studentSnap.data() as UserDoc) : undefined;
      const workoutName = log.workoutName?.trim() || "a workout";

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: token,
          title: "Workout completed",
          body: `${studentDisplayName(student)} completed ${workoutName}`,
          data: {
            type: "coach-workout-notification",
            logId: event.params.logId,
          },
        }),
      });

      if (!res.ok) {
        logger.warn("Expo push request failed", { status: res.status, body: await res.text() });
      }
    } catch (err) {
      // A failed push must never surface as a function error against the
      // already-successful workoutLog write.
      logger.error("Failed to send coach workout-completed push", err);
    }
  }
);
