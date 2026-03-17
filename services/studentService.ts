import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { Student } from "../types/Student";

const STUDENTS_COLLECTION = "students";

const assertNonEmpty = (value: string, label: string) => {
  if (!value || !value.trim()) throw new Error(`Missing ${label}.`);
};

const mapStudentDoc = (
  snap: Pick<QueryDocumentSnapshot, "id" | "data"> | Pick<DocumentSnapshot, "id" | "data">
): Student => ({
  id: snap.id,
  ...(snap.data() as Omit<Student, "id">),
});

export const studentService = {
  async getStudentById(studentId: string): Promise<Student | null> {
    assertNonEmpty(studentId, "studentId (Firebase Auth UID)");
    const ref = doc(db, STUDENTS_COLLECTION, studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return mapStudentDoc(snap);
  },

  // Returns all students that belong to a specific coach.
  async getStudentsForCoach(coachId: string): Promise<Student[]> {
    assertNonEmpty(coachId, "coachId (Firebase Auth UID)");
    const q = query(
      collection(db, STUDENTS_COLLECTION),
      where("coachId", "==", coachId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(mapStudentDoc);
  },

  // Creates/updates a student document using the student's Firebase Auth UID.
  // Firestore path: students/{studentUid}
  async createStudent(payload: Student): Promise<Student> {
    assertNonEmpty(payload.id, "student UID (Student.id)");
    assertNonEmpty(payload.coachId, "coach UID (Student.coachId)");

    await setDoc(doc(db, STUDENTS_COLLECTION, payload.id), {
      id: payload.id,
      coachId: payload.coachId,
      name: payload.name,
      email: payload.email,
    });

    return payload;
  },
};

