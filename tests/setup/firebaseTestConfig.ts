/**
 * Emulator-connected Firebase config for tests.
 * Replaces the real firebase/firebaseConfig via jest.config.ts moduleNameMapper.
 * All service imports of `db` and `auth` will use this emulator version instead.
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const TEST_PROJECT_ID = "gym-coach-app-3a18a";

const isNew = getApps().length === 0;

const app = isNew
  ? initializeApp({
      apiKey: "test-api-key",
      projectId: TEST_PROJECT_ID,
      authDomain: "test.local",
    })
  : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = null as any; // storage is not used in service tests

// Connect to local emulators only on first initialization
// (connectFirestoreEmulator / connectAuthEmulator can only be called once per app)
if (isNew) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
