import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import type { AppUser, SignupPayload } from "../types/User";

const USERS_COLLECTION = "users";

// Maps a Firebase Auth user + Firestore user document into our domain AppUser type.
const mapToAppUser = (user: User, role: AppUser["role"]): AppUser => ({
  id: user.uid,
  email: user.email ?? "",
  role,
});

export const authService = {
  // Creates a new Firebase Auth user and stores the role in the "users" collection.
  async signup({ email, password, role }: SignupPayload): Promise<AppUser> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = credential;

    // Store user metadata in Firestore so we can look up the role later.
    await setDoc(doc(db, USERS_COLLECTION, user.uid), {
      email,
      role,
    });

    return mapToAppUser(user, role);
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

    const data = docSnap.data() as { email: string; role: AppUser["role"] };

    return mapToAppUser(user, data.role);
  },

  // Subscribes to Firebase Auth state and resolves with the current AppUser (including role) if available.
  // This keeps screens simple and centralizes the Firestore role lookup.
  getCurrentUserWithRole(): Promise<AppUser | null> {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        async (user) => {
          try {
            if (!user) {
              resolve(null);
              unsubscribe();
              return;
            }

            const docRef = doc(db, USERS_COLLECTION, user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
              resolve(null);
              unsubscribe();
              return;
            }

            const data = docSnap.data() as { role: AppUser["role"]; email: string };
            resolve(mapToAppUser(user, data.role));
            unsubscribe();
          } catch (error) {
            reject(error);
            unsubscribe();
          }
        },
        (error) => {
          reject(error);
          unsubscribe();
        }
      );
    });
  },
};

