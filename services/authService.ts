import { createUserWithEmailAndPassword, signInWithEmailAndPassword, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import type { AppUser, SignupPayload, Sex } from "../types/User";

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

    const data = docSnap.data() as any;
    return mapToAppUser(user, data.role as AppUser["role"], data);
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
    const data = docSnap.data() as any;
    return mapToAppUser(user, data.role as AppUser["role"], data);
  },
};

