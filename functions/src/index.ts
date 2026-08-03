import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
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

interface WorkoutPlanDoc {
  coachId?: string;
  studentId?: string;
  name?: string;
  groupName?: string;
}

interface UserDoc {
  expoPushToken?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  photoURL?: string | null;
}

interface InviteDoc {
  coachId?: string;
  studentId?: string;
  status?: "pending" | "accepted" | "declined";
}

function userDisplayName(user: UserDoc | undefined, fallback: string): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || user?.email || fallback;
}

/**
 * Sends an Expo push notification.
 * `imageUrl` (typically the sender's profile photo) is shown via `richContent`
 * on Android only — iOS remote images require a native Notification Service
 * Extension, which this Expo-managed push path does not have.
 * Per Expo's API, a single message must still be wrapped in an array for
 * `richContent` to be honored.
 */
async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  imageUrl?: string | null
) {
  const message: Record<string, unknown> = { to: token, title, body, data };
  if (imageUrl) {
    message.richContent = { image: imageUrl };
  }
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify([message]),
  });
  if (!res.ok) {
    logger.warn("Expo push request failed", { status: res.status, body: await res.text() });
  }
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

      await sendExpoPush(
        token,
        "Workout completed",
        `${userDisplayName(student, "A student")} completed ${workoutName}`,
        { type: "coach-workout-notification", logId: event.params.logId },
        student?.photoURL
      );
    } catch (err) {
      // A failed push must never surface as a function error against the
      // already-successful workoutLog write.
      logger.error("Failed to send coach workout-completed push", err);
    }
  }
);

/**
 * Notifies a student (via Expo push) the moment a coach sends them a roster
 * invite. Mirrors the in-app student notification feed (invites.studentNotificationRead).
 */
export const notifyStudentOnInviteCreated = onDocumentCreated(
  "invites/{inviteId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const invite = snap.data() as InviteDoc;
    if (!invite.studentId || !invite.coachId || invite.status !== "pending") return;

    const db = getFirestore();

    try {
      const [studentSnap, coachSnap] = await Promise.all([
        db.collection("users").doc(invite.studentId).get(),
        db.collection("users").doc(invite.coachId).get(),
      ]);

      const student = studentSnap.exists ? (studentSnap.data() as UserDoc) : undefined;
      const token = student?.expoPushToken;
      if (!token) return;

      const coach = coachSnap.exists ? (coachSnap.data() as UserDoc) : undefined;

      await sendExpoPush(
        token,
        "Coach invite",
        `${userDisplayName(coach, "A coach")} wants to add you as their student`,
        { type: "invite-created", inviteId: event.params.inviteId },
        coach?.photoURL
      );
    } catch (err) {
      logger.error("Failed to send invite-created push", err);
    }
  }
);

/**
 * Notifies a coach (via Expo push) when a student responds to their invite.
 */
export const notifyCoachOnInviteResponded = onDocumentUpdated(
  "invites/{inviteId}",
  async (event) => {
    const before = event.data?.before.data() as InviteDoc | undefined;
    const after = event.data?.after.data() as InviteDoc | undefined;
    if (!after || !before) return;
    if (before.status !== "pending") return;
    if (after.status !== "accepted" && after.status !== "declined") return;
    if (!after.coachId || !after.studentId) return;

    const db = getFirestore();

    try {
      const [coachSnap, studentSnap] = await Promise.all([
        db.collection("users").doc(after.coachId).get(),
        db.collection("users").doc(after.studentId).get(),
      ]);

      const coach = coachSnap.exists ? (coachSnap.data() as UserDoc) : undefined;
      const token = coach?.expoPushToken;
      if (!token) return;

      const student = studentSnap.exists ? (studentSnap.data() as UserDoc) : undefined;
      const studentName = userDisplayName(student, "A student");

      const body =
        after.status === "accepted"
          ? `${studentName} accepted your invite — now on your roster`
          : `${studentName} declined your invite`;

      await sendExpoPush(
        token,
        "Invite update",
        body,
        {
          type: "invite-responded",
          inviteId: event.params.inviteId,
          status: after.status,
        },
        student?.photoURL
      );
    } catch (err) {
      logger.error("Failed to send invite-responded push", err);
    }
  }
);

/**
 * Notifies a student (via Expo push) each time a coach assigns them a new
 * workout plan. Mirrors the in-app student notification feed
 * (workoutPlans.studentNotificationRead). A coach building a training group
 * (e.g. "PPL") typically saves several plans in a row — each save creates its
 * own workoutPlans doc, so this fires once per workout, as intended.
 */
export const notifyStudentOnWorkoutPlanCreated = onDocumentCreated(
  "workoutPlans/{planId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const plan = snap.data() as WorkoutPlanDoc;
    if (!plan.studentId || !plan.coachId) return;

    const db = getFirestore();

    try {
      const [studentSnap, coachSnap] = await Promise.all([
        db.collection("users").doc(plan.studentId).get(),
        db.collection("users").doc(plan.coachId).get(),
      ]);

      const student = studentSnap.exists ? (studentSnap.data() as UserDoc) : undefined;
      const token = student?.expoPushToken;
      if (!token) return;

      const coach = coachSnap.exists ? (coachSnap.data() as UserDoc) : undefined;
      const workoutName = plan.name?.trim() || "a new workout";

      await sendExpoPush(
        token,
        "New workout assigned",
        `${userDisplayName(coach, "Your coach")} assigned you a new workout: ${workoutName}`,
        { type: "workout-plan-created", planId: event.params.planId },
        coach?.photoURL
      );
    } catch (err) {
      logger.error("Failed to send workout-plan-created push", err);
    }
  }
);
