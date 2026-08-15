import { createUserWithEmailAndPassword, signInWithEmailAndPassword, User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import type { AppUser, SignupPayload, Sex, MessengerType } from "../types/User";
import type { UserFirestoreDoc } from "../types/firestore";
import { logger } from "../utils/logger";

const USERS_COLLECTION = "users";

const normalizeSex = (value: any): Sex => {
  if (value === "male" || value === "female" || value === "other") return value;
  return "other";
};

// Maps a Firebase Auth user + Firestore user document into our domain AppUser type.
const mapToAppUser = (user: User, role: AppUser["role"], data: any): AppUser => ({
  id: user.uid,
  email: data?.email ?? user.email ?? "",
  role,
  firstName: data?.firstName ?? "",
  lastName: data?.lastName ?? "",
  dateOfBirth: data?.dateOfBirth ?? "",
  sex: normalizeSex(data?.sex),
  photoURL: data?.photoURL ?? null,
  coachId: data?.coachId ?? null,
  messengerType: data?.messengerType ?? null,
  messengerHandle: data?.messengerHandle ?? null,
});

export const authService = {
  // Creates a new Firebase Auth user and stores the role in the "users" collection.
  async signup({ email, password, role, firstName, lastName, dateOfBirth, sex }: SignupPayload): Promise<AppUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const { user } = credential;

    const createdAt = new Date().toISOString();

    // Store full user profile in Firestore so we can look up the user later.
    await setDoc(doc(db, USERS_COLLECTION, user.uid), {
      email: normalizedEmail,
      role,
      firstName,
      lastName,
      dateOfBirth,
      sex,
      createdAt,
    });

    return mapToAppUser(user, role, {
      email: normalizedEmail,
      role,
      firstName,
      lastName,
      dateOfBirth,
      sex,
      createdAt,
    });
  },

  // Signs in with email/password and looks up the user role from Firestore.
  async login(email: string, password: string): Promise<AppUser> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const { user } = credential;

    const docRef = doc(db, USERS_COLLECTION, user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("User profile not found.");
    }

    const data = docSnap.data() as UserFirestoreDoc | undefined;
    if (!data) throw new Error("User profile not found.");
    return mapToAppUser(user, data.role as AppUser["role"], data);
  },

  /**
   * Patches editable profile fields for a user.
   * Trims string fields and drops undefined keys before writing.
   * Throws on Firestore error so the caller can show an inline error.
   */
  async updateUserProfile(
    uid: string,
    patch: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      sex?: Sex;
      messengerType?: MessengerType | null;
      messengerHandle?: string | null;
    }
  ): Promise<void> {
    const sanitized: Record<string, string | null> = {};
    if (patch.firstName !== undefined) sanitized.firstName = patch.firstName.trim();
    if (patch.lastName !== undefined) sanitized.lastName = patch.lastName.trim();
    if (patch.dateOfBirth !== undefined) sanitized.dateOfBirth = patch.dateOfBirth.trim();
    if (patch.sex !== undefined) sanitized.sex = patch.sex;
    if (patch.messengerType !== undefined) sanitized.messengerType = patch.messengerType;
    if (patch.messengerHandle !== undefined) sanitized.messengerHandle = patch.messengerHandle;
    if (Object.keys(sanitized).length === 0) return;
    try {
      await updateDoc(doc(db, USERS_COLLECTION, uid), sanitized);
    } catch (e) {
      logger.error("[authService] updateUserProfile failed", e);
      throw e;
    }
  },

  /**
   * Persists (or clears, when `token` is null) the device's Expo push token
   * on the user's Firestore doc so server-side pushes (e.g. the coach
   * "student completed a workout" notification) know where to send.
   */
  async updatePushToken(uid: string, token: string | null): Promise<void> {
    try {
      await updateDoc(doc(db, USERS_COLLECTION, uid), { expoPushToken: token });
    } catch (e) {
      logger.error("[authService] updatePushToken failed", e);
    }
  },

  /**
   * Non-React helpers only: reads `auth.currentUser` + Firestore profile.
   * UI should use `useAuth()` from AuthContext (single source of truth).
   */
  async getCurrentUserWithRole(): Promise<AppUser | null> {
    const user = auth.currentUser;
    if (!user) return null;
    const docSnap = await getDoc(doc(db, USERS_COLLECTION, user.uid));
    if (!docSnap.exists()) return null;
    const data = docSnap.data() as UserFirestoreDoc | undefined;
    if (!data) return null;
    return mapToAppUser(user, data.role as AppUser["role"], data);
  },
};

