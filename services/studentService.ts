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

const USERS_COLLECTION = "users";

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
  if (value.includes("@")) {
    console.warn(`[studentService] Possible email used as ${label}:`, value);
  }
};

const mapStudentDoc = (snap: { id: string; data: () => any }): StudentSummary => {
  const data = snap.data() as {
    email?: string;
    role?: string;
    coachId?: string;
  };

  return {
    id: snap.id,
    email: data.email ?? "",
    coachId: data.coachId,
  };
};

export const studentService = {
  // Students are Firebase Auth users with role === "student".
  async getStudentById(studentId: string): Promise<StudentSummary | null> {
    assertNonEmpty(studentId, "studentId (Firebase Auth UID)");
    const ref = doc(db, USERS_COLLECTION, studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as { role?: string };
    if (data.role !== "student") return null;
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
    await setDoc(doc(db, USERS_COLLECTION, studentId), { coachId }, { merge: true });
  },

  // Finds a student user by email and links them to the coach.
  async assignStudentToCoachByEmail(email: string, coachId: string): Promise<void> {
    assertNonEmpty(email, "email");
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");

    const normalizedEmail = email.trim().toLowerCase();
    const q = query(
      collection(db, USERS_COLLECTION),
      where("email", "==", normalizedEmail)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error("No user found with that email.");
    }

    if (snapshot.docs.length > 1) {
      console.warn("[studentService] Multiple users matched email", normalizedEmail);
    }

    const match = snapshot.docs[0];
    const data = match.data() as { role?: string };
    if (data.role !== "student") {
      throw new Error("That user is not a student.");
    }

    await setDoc(doc(db, USERS_COLLECTION, match.id), { coachId }, { merge: true });
  },
};

