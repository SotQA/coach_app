import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  collection,
  writeBatch,
  getCountFromServer,
  orderBy,
  limit as limitFn,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { studentService } from "./studentService";
import type { Invite, InviteStatus } from "../types/Invite";
import type { InviteFirestoreDoc } from "../types/firestore";
import type { StudentSummary } from "../types/StudentSummary";

const INVITES_COLLECTION = "invites";
const COOLDOWN_DAYS = 7;

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
};

const toMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapInviteDoc = (snap: { id: string; data: () => any }): Invite => {
  const data = (snap.data() as InviteFirestoreDoc | undefined) ?? {};
  return {
    id: snap.id,
    coachId: data.coachId ?? "",
    studentId: data.studentId ?? "",
    studentEmail: data.studentEmail ?? "",
    status: (data.status as InviteStatus) ?? "pending",
    createdAt: data.createdAt,
    respondedAt: data.respondedAt,
    expiresAt: data.expiresAt,
    coachNotificationRead: data.coachNotificationRead !== false,
    studentNotificationRead: data.studentNotificationRead !== false,
  };
};

export type EmailCheckResult =
  | { state: "ok"; student: StudentSummary }
  | { state: "not_found" }
  | { state: "wrong_role" }
  | { state: "already_yours" }
  | { state: "has_other_coach" }
  | { state: "already_invited" }
  | { state: "cooldown"; availableAtMs: number };

export const inviteService = {
  /**
   * Validates a coach-entered student email against existing accounts, an
   * already-linked roster, a still-pending invite, and the 7-day re-invite
   * cooldown after a decline. Drives the debounced field validation UI.
   */
  async checkStudentEmail(email: string, coachId: string): Promise<EmailCheckResult> {
    assertNonEmpty(email, "email");
    assertNonEmpty(coachId, "coachId");

    const match = await studentService.findUserByEmail(email);
    if (!match) return { state: "not_found" };
    if (match.role !== "student" && match.role !== "athlete") return { state: "wrong_role" };
    if (match.coachId === coachId) return { state: "already_yours" };
    if (match.coachId) return { state: "has_other_coach" };

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await getDocs(
      query(
        collection(db, INVITES_COLLECTION),
        where("coachId", "==", coachId),
        where("studentEmail", "==", normalizedEmail)
      )
    );
    const invites = existing.docs.map(mapInviteDoc);

    if (invites.some((inv) => inv.status === "pending")) {
      return { state: "already_invited" };
    }

    const latestDeclined = invites
      .filter((inv) => inv.status === "declined" && inv.expiresAt)
      .sort((a, b) => toMs(b.respondedAt) - toMs(a.respondedAt))[0];
    if (latestDeclined) {
      const availableAtMs = toMs(latestDeclined.expiresAt);
      if (availableAtMs > Date.now()) {
        return { state: "cooldown", availableAtMs };
      }
    }

    const { role: _role, ...student } = match;
    return { state: "ok", student };
  },

  /** Creates a pending invite. Re-validates the email server-side-equivalent before writing. */
  async createInvite(coachId: string, studentEmail: string): Promise<Invite> {
    assertNonEmpty(coachId, "coachId");
    const check = await this.checkStudentEmail(studentEmail, coachId);
    if (check.state !== "ok") {
      throw new Error(`Cannot invite this email right now (${check.state}).`);
    }

    const normalizedEmail = studentEmail.trim().toLowerCase();
    const data: InviteFirestoreDoc = {
      coachId,
      studentId: check.student.id,
      studentEmail: normalizedEmail,
      status: "pending",
      createdAt: new Date().toISOString(),
      // The coach just sent this themselves — nothing new for them to see yet.
      coachNotificationRead: true,
      studentNotificationRead: false,
    };
    const ref = await addDoc(collection(db, INVITES_COLLECTION), data);
    return mapInviteDoc({ id: ref.id, data: () => data });
  },

  async getInviteById(inviteId: string): Promise<Invite | null> {
    assertNonEmpty(inviteId, "inviteId");
    const snap = await getDoc(doc(db, INVITES_COLLECTION, inviteId));
    if (!snap.exists()) return null;
    return mapInviteDoc(snap);
  },

  /** All invites sent by a coach, most recent first — feeds the coach notifications tab. */
  async getInvitesForCoach(coachId: string, limit = 100): Promise<Invite[]> {
    assertNonEmpty(coachId, "coachId");
    const snap = await getDocs(
      query(
        collection(db, INVITES_COLLECTION),
        where("coachId", "==", coachId),
        orderBy("createdAt", "desc"),
        limitFn(limit)
      )
    );
    return snap.docs.map(mapInviteDoc);
  },

  /** All invites received by a student, most recent first — feeds the student notifications tab. */
  async getInvitesForStudent(studentId: string, limit = 100): Promise<Invite[]> {
    assertNonEmpty(studentId, "studentId");
    const snap = await getDocs(
      query(
        collection(db, INVITES_COLLECTION),
        where("studentId", "==", studentId),
        orderBy("createdAt", "desc"),
        limitFn(limit)
      )
    );
    return snap.docs.map(mapInviteDoc);
  },

  async getUnreadInviteCountForCoach(coachId: string): Promise<number> {
    assertNonEmpty(coachId, "coachId");
    const snap = await getCountFromServer(
      query(
        collection(db, INVITES_COLLECTION),
        where("coachId", "==", coachId),
        where("coachNotificationRead", "==", false)
      )
    );
    return snap.data().count;
  },

  async getUnreadInviteCountForStudent(studentId: string): Promise<number> {
    assertNonEmpty(studentId, "studentId");
    const snap = await getCountFromServer(
      query(
        collection(db, INVITES_COLLECTION),
        where("studentId", "==", studentId),
        where("studentNotificationRead", "==", false)
      )
    );
    return snap.data().count;
  },

  async markInviteNotificationRead(inviteId: string, role: "coach" | "student"): Promise<void> {
    assertNonEmpty(inviteId, "inviteId");
    const field = role === "coach" ? "coachNotificationRead" : "studentNotificationRead";
    await updateDoc(doc(db, INVITES_COLLECTION, inviteId), { [field]: true });
  },

  async markAllInviteNotificationsReadForCoach(coachId: string): Promise<void> {
    assertNonEmpty(coachId, "coachId");
    const snap = await getDocs(
      query(
        collection(db, INVITES_COLLECTION),
        where("coachId", "==", coachId),
        where("coachNotificationRead", "==", false)
      )
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.update(d.ref, { coachNotificationRead: true });
    await batch.commit();
  },

  async markAllInviteNotificationsReadForStudent(studentId: string): Promise<void> {
    assertNonEmpty(studentId, "studentId");
    const snap = await getDocs(
      query(
        collection(db, INVITES_COLLECTION),
        where("studentId", "==", studentId),
        where("studentNotificationRead", "==", false)
      )
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.update(d.ref, { studentNotificationRead: true });
    await batch.commit();
  },

  /**
   * Student responds to a pending invite. Accepting links the coach onto the
   * student's profile (and the student onto the coach's roster); declining
   * starts a 7-day cooldown before the same coach can re-invite this student.
   * Both trigger a fresh, unread notification for the coach.
   */
  async respondToInvite(
    inviteId: string,
    studentId: string,
    response: Extract<InviteStatus, "accepted" | "declined">
  ): Promise<void> {
    assertNonEmpty(inviteId, "inviteId");
    assertNonEmpty(studentId, "studentId");

    const invite = await this.getInviteById(inviteId);
    if (!invite) throw new Error("Invite not found.");
    if (invite.studentId !== studentId) throw new Error("This invite does not belong to you.");
    if (invite.status !== "pending") return; // already responded — idempotent no-op

    const respondedAt = new Date();
    await updateDoc(doc(db, INVITES_COLLECTION, inviteId), {
      status: response,
      respondedAt: respondedAt.toISOString(),
      studentNotificationRead: true,
      coachNotificationRead: false,
      ...(response === "declined"
        ? { expiresAt: new Date(respondedAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString() }
        : null),
    });

    if (response === "accepted") {
      await studentService.assignStudentToCoach(studentId, invite.coachId);
    }
  },
};
