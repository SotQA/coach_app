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

interface ExerciseDoc {
  id?: string;
  name?: string;
  sets?: number | string;
  reps?: string;
  weight?: number | string | null;
  rest?: string;
  tempo?: string;
  rpe?: number | string | null;
  coachNote?: string;
  videoUrl?: string;
}

interface WorkoutPlanDoc {
  coachId?: string;
  studentId?: string;
  name?: string;
  groupName?: string;
  note?: string;
  exercises?: ExerciseDoc[];
  isActive?: boolean;
  lastCoachMessage?: string;
}

interface FieldDiff {
  from: string;
  to: string;
}

interface ExerciseChangeSummary {
  id: string;
  name: string;
  sets?: number;
  reps?: string;
}

interface ExerciseFieldChange {
  id: string;
  name: string;
  fields: Record<string, FieldDiff>;
}

const EXERCISE_DIFF_FIELDS: (keyof ExerciseDoc)[] = [
  "name",
  "sets",
  "reps",
  "weight",
  "rest",
  "tempo",
  "rpe",
  "coachNote",
  "videoUrl",
];

function fieldToString(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

/** Field-level diff between two exercise rows already known to be the same exercise. */
function diffExerciseFields(before: ExerciseDoc, after: ExerciseDoc): Record<string, FieldDiff> {
  const out: Record<string, FieldDiff> = {};
  for (const field of EXERCISE_DIFF_FIELDS) {
    const from = fieldToString(before[field]);
    const to = fieldToString(after[field]);
    if (from !== to) out[field] = { from, to };
  }
  return out;
}

function toSummary(ex: ExerciseDoc, fallbackId: string): ExerciseChangeSummary {
  return {
    id: ex.id?.trim() || fallbackId,
    name: ex.name?.trim() || "Exercise",
    sets: typeof ex.sets === "number" ? ex.sets : Number(ex.sets) || undefined,
    reps: ex.reps,
  };
}

/**
 * Matches exercises across an edit primarily by stable `id`; exercises missing
 * an id on either side (legacy rows not yet backfilled) fall back to a
 * same-name match. Anything left over is a genuine add/remove.
 */
function diffExerciseLists(
  beforeList: ExerciseDoc[],
  afterList: ExerciseDoc[]
): {
  changed: ExerciseFieldChange[];
  added: ExerciseChangeSummary[];
  removed: ExerciseChangeSummary[];
} {
  const changed: ExerciseFieldChange[] = [];
  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();

  // Pass 1 — match by stable id.
  afterList.forEach((afterEx, afterIdx) => {
    if (!afterEx.id) return;
    const beforeIdx = beforeList.findIndex((b, i) => !usedBefore.has(i) && b.id === afterEx.id);
    if (beforeIdx === -1) return;
    usedBefore.add(beforeIdx);
    usedAfter.add(afterIdx);
    const fields = diffExerciseFields(beforeList[beforeIdx], afterEx);
    if (Object.keys(fields).length > 0) {
      changed.push({ id: afterEx.id, name: afterEx.name?.trim() || "Exercise", fields });
    }
  });

  // Pass 2 — fall back to same-name match for rows without an id on either side.
  afterList.forEach((afterEx, afterIdx) => {
    if (usedAfter.has(afterIdx)) return;
    const name = afterEx.name?.trim().toLowerCase();
    if (!name) return;
    const beforeIdx = beforeList.findIndex(
      (b, i) => !usedBefore.has(i) && (b.name?.trim().toLowerCase() ?? "") === name
    );
    if (beforeIdx === -1) return;
    usedBefore.add(beforeIdx);
    usedAfter.add(afterIdx);
    const fields = diffExerciseFields(beforeList[beforeIdx], afterEx);
    if (Object.keys(fields).length > 0) {
      changed.push({ id: afterEx.id?.trim() || `idx-${afterIdx}`, name: afterEx.name?.trim() || "Exercise", fields });
    }
  });

  const removed = beforeList
    .filter((_, i) => !usedBefore.has(i))
    .map((ex, i) => toSummary(ex, `idx-${i}`));
  const added = afterList
    .filter((_, i) => !usedAfter.has(i))
    .map((ex, i) => toSummary(ex, `idx-${i}`));

  return { changed, added, removed };
}

const PLAN_DIFF_FIELDS: (keyof WorkoutPlanDoc)[] = ["name", "note"];

function diffPlanFields(before: WorkoutPlanDoc, after: WorkoutPlanDoc): Record<string, FieldDiff> {
  const out: Record<string, FieldDiff> = {};
  for (const field of PLAN_DIFF_FIELDS) {
    const from = fieldToString(before[field]);
    const to = fieldToString(after[field]);
    if (from !== to) out[field] = { from, to };
  }
  return out;
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
    // Personal plans (coach training themself, e.g. createPersonalPlan.tsx)
    // write studentId === coachId — that's not a student to notify.
    if (plan.studentId === plan.coachId) return;

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

/**
 * Notifies a student (via Expo push) whenever a coach edits or removes one of
 * their workout plans. Computes the diff server-side off the Firestore
 * before/after snapshot (never trusts the client to report what changed),
 * writes an immutable `workoutPlanChanges` record, and pushes a summary.
 *
 * Guards keep this from firing on noise:
 *  - Personal plans (`studentId === coachId`, e.g. createPersonalPlan.tsx) are skipped.
 *  - Edits to a plan that's already removed (`isActive` already false) are skipped.
 *  - If neither the plan's own fields (name/note) nor its exercises actually
 *    changed, nothing is written — this is what keeps the trigger from looping
 *    on housekeeping-only writes (e.g. a student's own "mark read" tap only
 *    ever touches `studentNotificationRead`, which isn't diffed here at all).
 */
export const notifyStudentOnWorkoutPlanChanged = onDocumentUpdated(
  "workoutPlans/{planId}",
  async (event) => {
    const before = event.data?.before.data() as WorkoutPlanDoc | undefined;
    const after = event.data?.after.data() as WorkoutPlanDoc | undefined;
    if (!before || !after) return;
    if (!after.studentId || !after.coachId) return;
    // Personal plans (coach training themself) write studentId === coachId —
    // that's not a student to notify about the coach's own edit/removal.
    if (after.studentId === after.coachId) return;

    const planId = event.params.planId;
    const db = getFirestore();
    const coachMessage = after.lastCoachMessage?.trim() || undefined;
    const planName = after.name?.trim() || before.name?.trim() || "Workout";

    const wasActive = before.isActive !== false;
    const isActiveNow = after.isActive !== false;
    const isDeleteTransition = wasActive && !isActiveNow;

    // An edit landing on an already-removed plan has nothing left to notify about.
    if (!isDeleteTransition && !isActiveNow) return;

    try {
      let changeRef;
      let pushType: "workout-plan-updated" | "workout-plan-deleted";
      let pushBody: string;

      if (isDeleteTransition) {
        pushType = "workout-plan-deleted";
        changeRef = await db.collection("workoutPlanChanges").add({
          planId,
          studentId: after.studentId,
          coachId: after.coachId,
          type: "deleted",
          changedAt: new Date(),
          planNameSnapshot: planName,
          ...(coachMessage ? { coachMessage } : {}),
          planSnapshot: {
            name: planName,
            exercises: after.exercises ?? [],
          },
          studentNotificationRead: false,
        });
        pushBody = `removed "${planName}"`;
      } else {
        const planFields = diffPlanFields(before, after);
        const { changed, added, removed } = diffExerciseLists(before.exercises ?? [], after.exercises ?? []);
        const hasChange =
          Object.keys(planFields).length > 0 || changed.length > 0 || added.length > 0 || removed.length > 0;
        if (!hasChange) return;

        const exerciseTouchCount = changed.length + added.length + removed.length;
        pushType = "workout-plan-updated";
        changeRef = await db.collection("workoutPlanChanges").add({
          planId,
          studentId: after.studentId,
          coachId: after.coachId,
          type: "updated",
          changedAt: new Date(),
          planNameSnapshot: planName,
          ...(coachMessage ? { coachMessage } : {}),
          diff: {
            ...(Object.keys(planFields).length > 0 ? { planFields } : {}),
            ...(changed.length > 0 ? { exercisesChanged: changed } : {}),
            ...(added.length > 0 ? { exercisesAdded: added } : {}),
            ...(removed.length > 0 ? { exercisesRemoved: removed } : {}),
          },
          studentNotificationRead: false,
        });
        pushBody =
          exerciseTouchCount > 0
            ? `updated "${planName}" — ${exerciseTouchCount} exercise${exerciseTouchCount === 1 ? "" : "s"} changed`
            : `updated "${planName}"`;
      }

      const [studentSnap, coachSnap] = await Promise.all([
        db.collection("users").doc(after.studentId).get(),
        db.collection("users").doc(after.coachId).get(),
      ]);
      const student = studentSnap.exists ? (studentSnap.data() as UserDoc) : undefined;
      const token = student?.expoPushToken;
      if (!token) return;

      const coach = coachSnap.exists ? (coachSnap.data() as UserDoc) : undefined;
      const coachName = userDisplayName(coach, "Your coach");

      await sendExpoPush(
        token,
        isDeleteTransition ? "Workout removed" : "Workout updated",
        `${coachName} ${pushBody}`,
        { type: pushType, planId, changeId: changeRef.id },
        coach?.photoURL
      );
    } catch (err) {
      logger.error("Failed to send workout-plan-changed push", err);
    }
  }
);
