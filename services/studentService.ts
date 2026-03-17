import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { Student } from "../types/Student";

const STUDENTS_COLLECTION = "students";

export const studentService = {
  async getStudentById(studentId: string): Promise<Student | null> {
    const ref = doc(db, STUDENTS_COLLECTION, studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<Student, "id">),
    };
  },

  // Returns all students that belong to a specific coach.
  async getStudentsForCoach(coachId: string): Promise<Student[]> {
    const q = query(
      collection(db, STUDENTS_COLLECTION),
      where("coachId", "==", coachId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...(doc.data() as Omit<Student, "id">),
        } as Student)
    );
  },

  // Creates/updates a student document using the student's Firebase Auth UID.
  // Firestore path: students/{studentUid}
  async createStudent(payload: Student): Promise<Student> {
    if (!payload.id) {
      throw new Error("Missing student UID (Student.id).");
    }
    if (!payload.coachId) {
      throw new Error("Missing coach UID (Student.coachId).");
    }

    await setDoc(doc(db, STUDENTS_COLLECTION, payload.id), {
      coachId: payload.coachId,
      name: payload.name,
      email: payload.email,
    });

    return payload;
  },
};

