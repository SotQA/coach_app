export interface Student {
  // Always the Firebase Auth UID for the student.
  // We also use this as the Firestore document id in `students/{uid}`.
  id: string;
  coachId: string;
  name: string;
  email: string;
}
