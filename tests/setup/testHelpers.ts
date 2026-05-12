/**
 * Shared test utilities — data seeding and Firestore cleanup.
 */
import { collection, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "./firebaseTestConfig";

const TEST_PROJECT_ID = "gym-coach-app-3a18a";

// ─── Firestore Cleanup ────────────────────────────────────────────────────────

/**
 * Clears all documents from the collections used by service tests.
 * Call in beforeEach so each test starts with a clean slate.
 */
export async function clearFirestore(): Promise<void> {
  const url = `http://127.0.0.1:8080/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`;
  try {
    await fetch(url, { method: "DELETE" });
  } catch {
    // Fallback: delete known collections manually if the REST endpoint fails
    const cols = ["workoutPlans", "workoutLogs", "users", "trainingGroups"];
    await Promise.all(
      cols.map(async (col) => {
        const snap = await getDocs(collection(db, col));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      })
    );
  }
}

// ─── Seed Helpers ─────────────────────────────────────────────────────────────

/** Seed a user document (coach or student) directly into Firestore. */
export async function seedUser(
  uid: string,
  data: {
    email: string;
    role: "coach" | "student";
    firstName?: string;
    lastName?: string;
    coachId?: string;
  }
): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    email: data.email,
    role: data.role,
    firstName: data.firstName ?? "Test",
    lastName: data.lastName ?? "User",
    ...(data.coachId ? { coachId: data.coachId } : {}),
  });
}

// ─── ID Generators ────────────────────────────────────────────────────────────

let counter = 0;
/** Generate a unique test ID (not a real UID, but unique within a test run). */
export function testId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${++counter}`;
}
