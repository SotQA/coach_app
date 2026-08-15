import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  collection,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { StudentSummary } from "../types/StudentSummary";
import type { UserFirestoreDoc } from "../types/firestore";

const USERS_COLLECTION = "users";

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
  if (value.includes("@")) {
    console.warn(`[studentService] Possible email used as ${label}:`, value);
  }
};

const mapStudentDoc = (snap: { id: string; data: () => any }): StudentSummary => {
  const data = snap.data() as UserFirestoreDoc | undefined ?? {};

  return {
    id: snap.id,
    email: data.email ?? "",
    coachId: data.coachId,
    firstName: data.firstName,
    lastName: data.lastName,
    photoURL: data.photoURL ?? null,
    messengerType: data.messengerType ?? null,
    messengerHandle: data.messengerHandle ?? null,
  };
};

export const studentService = {
  // Students are Firebase Auth users with role === "student".
  async getStudentById(studentId: string): Promise<StudentSummary | null> {
    assertNonEmpty(studentId, "studentId (Firebase Auth UID)");
    const ref = doc(db, USERS_COLLECTION, studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as UserFirestoreDoc | undefined;
    if (data?.role !== "student") return null;
    return mapStudentDoc(snap);
  },

  // Returns all students that belong to a specific coach.
  async getStudentsForCoach(coachId: string): Promise<StudentSummary[]> {
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");
    const q = query(
      collection(db, USERS_COLLECTION),
      where("role", "==", "student"),
      where("coachId", "==", coachId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(mapStudentDoc);
  },

  // Links an existing student user to the current coach by writing users/{studentUid}.coachId.
  async assignStudentToCoach(studentId: string, coachId: string): Promise<void> {
    assertNonEmpty(studentId, "studentId (Firebase Auth UID)");
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");
    const ref = doc(db, USERS_COLLECTION, studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error("Student user not found.");
    }
    const data = snap.data() as UserFirestoreDoc | undefined;
    if (data?.role !== "student") {
      throw new Error("That user is not a student.");
    }
    if (data.coachId && data.coachId !== coachId) {
      throw new Error("That student already belongs to another coach.");
    }
    await setDoc(ref, { coachId }, { merge: true });
  },

  // Looks up any user by email (any role) — used by the invite flow to validate
  // a coach-entered email before an invite is created. Case-sensitive Firestore
  // match, with a fallback to the raw trimmed value for safety.
  async findUserByEmail(email: string): Promise<(StudentSummary & { role?: string }) | null> {
    assertNonEmpty(email, "email");
    const normalizedEmail = email.trim().toLowerCase();
    const q = query(
      collection(db, USERS_COLLECTION),
      where("email", "==", normalizedEmail)
    );
    let snapshot = await getDocs(q);

    if (snapshot.empty) {
      const raw = email.trim();
      if (raw && raw !== normalizedEmail) {
        snapshot = await getDocs(
          query(collection(db, USERS_COLLECTION), where("email", "==", raw))
        );
      }
    }

    if (snapshot.empty) return null;
    if (snapshot.docs.length > 1) {
      console.warn("[studentService] Multiple users matched email", normalizedEmail);
    }

    const match = snapshot.docs[0];
    const data = match.data() as UserFirestoreDoc | undefined;
    return { ...mapStudentDoc(match), role: data?.role };
  },

  // Fetches any user by UID regardless of role — used to display coach/student
  // info on invite notification cards outside of the coach's own roster.
  async getUserSummaryById(uid: string): Promise<StudentSummary | null> {
    assertNonEmpty(uid, "uid (Firebase Auth UID)");
    const ref = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return mapStudentDoc(snap);
  },
};

