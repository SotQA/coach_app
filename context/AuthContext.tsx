import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import type { AppUser, UserRole, Sex } from "../types/User";
import { logger } from "../utils/logger";

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  loginWithGoogleIdToken: (payload: { idToken: string }) => Promise<AppUser>;
  signup: (
    email: string,
    password: string,
    role: UserRole,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
    sex: Sex
  ) => Promise<AppUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USERS_COLLECTION = "users";

const normalizeSex = (value: any): Sex => {
  if (value === "male" || value === "female" || value === "other") return value;
  return "other";
};

const VALID_ROLES = ["coach", "student"] as const;

function asValidRole(v: unknown): AppUser["role"] | null {
  return typeof v === "string" && (VALID_ROLES as readonly string[]).includes(v)
    ? (v as AppUser["role"])
    : null;
}

const mapToAppUser = (user: User, data: any): AppUser | null => {
  const role = asValidRole(data?.role);
  if (!role) {
    logger.error("[auth] invalid role on user doc", { uid: user.uid, role: data?.role });
    return null;
  }
  return {
    id: user.uid,
    email: data?.email ?? user.email ?? "",
    role,
    firstName: data?.firstName ?? "",
    lastName: data?.lastName ?? "",
    dateOfBirth: data?.dateOfBirth ?? "",
    sex: normalizeSex(data?.sex),
  };
};

const splitDisplayName = (displayName: string | null | undefined) => {
  const raw = (displayName ?? "").trim();
  if (!raw) return { firstName: "", lastName: "" };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        const docRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          await signOut(auth);
          setUser(null);
          return;
        }

        const data = snap.data() as any;
        const appUser = mapToAppUser(firebaseUser, data);
        if (!appUser) {
          await signOut(auth);
          setUser(null);
          return;
        }
        setUser(appUser);
      } catch (e) {
        console.error("[AuthProvider] Failed to resolve user role", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<AppUser> => {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    const { user: firebaseUser } = credential;

    const docRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await signOut(auth);
      throw new Error("User profile not found.");
    }
    const data = snap.data() as any;
    const appUser = mapToAppUser(firebaseUser, data);
    if (!appUser) {
      await signOut(auth);
      throw new Error("User account has an invalid role. Please contact support.");
    }
    return appUser;
  };

  const loginWithGoogleIdToken = async ({ idToken }: { idToken: string }): Promise<AppUser> => {
    const token = (idToken ?? "").trim();
    if (!token) {
      throw new Error("Missing Google ID token.");
    }

    const credential = GoogleAuthProvider.credential(token);
    const result = await signInWithCredential(auth, credential);
    const firebaseUser = result.user;

    const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // New user: create a minimal profile doc so role-based routing works.
      // Default role = student (can be extended later with a role-picker).
      const normalizedEmail = (firebaseUser.email ?? "").trim().toLowerCase();
      const { firstName, lastName } = splitDisplayName(firebaseUser.displayName);
      const createdAt = new Date().toISOString();

      await setDoc(userRef, {
        email: normalizedEmail,
        role: "student",
        firstName,
        lastName,
        dateOfBirth: "",
        sex: "other",
        createdAt,
        authProvider: "google",
      });
    }

    const latest = await getDoc(userRef);
    if (!latest.exists()) {
      throw new Error("User profile not found after Google sign-in.");
    }

    const data = latest.data() as any;
    const appUser = mapToAppUser(firebaseUser, data);
    if (!appUser) {
      await signOut(auth);
      throw new Error("User account has an invalid role. Please contact support.");
    }
    return appUser;
  };

  const signup = async (
    email: string,
    password: string,
    role: UserRole,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
    sex: Sex
  ): Promise<AppUser> => {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const { user: firebaseUser } = credential;

    const createdAt = new Date().toISOString();
    await setDoc(doc(db, USERS_COLLECTION, firebaseUser.uid), {
      email: normalizedEmail,
      role,
      firstName,
      lastName,
      dateOfBirth,
      sex,
      createdAt,
    });

    const appUser = mapToAppUser(firebaseUser, {
      email: normalizedEmail,
      role,
      firstName,
      lastName,
      dateOfBirth,
      sex,
      createdAt,
    });
    if (!appUser) throw new Error("Signup produced an invalid role. Please contact support.");
    return appUser;
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogleIdToken, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

