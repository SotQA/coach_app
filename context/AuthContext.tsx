import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
import { authService } from "../services/authService";

export class NeedsOnboardingError extends Error {
  constructor() {
    super("needs-onboarding");
    this.name = "NeedsOnboardingError";
  }
}

type PendingGoogleUser = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  photoURL: string | null;
};

type ProfilePatch = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Sex;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  pendingGoogleUser: PendingGoogleUser | null;
  login: (email: string, password: string) => Promise<AppUser>;
  loginWithGoogleIdToken: (payload: { idToken: string }) => Promise<AppUser>;
  completeGoogleSignup: (role: UserRole) => Promise<void>;
  cancelGoogleSignup: () => Promise<void>;
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
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  /** Re-fetches the user doc from Firestore and refreshes in-memory state. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USERS_COLLECTION = "users";

const normalizeSex = (value: any): Sex => {
  if (value === "male" || value === "female" || value === "other") return value;
  return "other";
};

const VALID_ROLES = ["coach", "student", "athlete"] as const;

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
    photoURL: data?.photoURL ?? null,
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
  const [pendingGoogleUser, setPendingGoogleUser] = useState<PendingGoogleUser | null>(null);
  // Ref so the onAuthStateChanged closure can read the latest value without re-subscribing.
  const pendingGoogleOnboardingRef = useRef(false);

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
          if (pendingGoogleOnboardingRef.current) {
            // New Google user mid-onboarding — Firestore doc not yet created, that's expected.
            setLoading(false);
            return;
          }
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
    if (!token) throw new Error("Missing Google ID token.");

    // Flag must be set before signInWithCredential so onAuthStateChanged
    // doesn't sign the user out when it fires and finds no Firestore doc yet.
    pendingGoogleOnboardingRef.current = true;

    try {
      const credential = GoogleAuthProvider.credential(token);
      const result = await signInWithCredential(auth, credential);
      const firebaseUser = result.user;

      const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // New user — store their Google info and signal the role picker is needed.
        const { firstName, lastName } = splitDisplayName(firebaseUser.displayName);
        setPendingGoogleUser({
          uid: firebaseUser.uid,
          email: (firebaseUser.email ?? "").trim().toLowerCase(),
          firstName,
          lastName,
          photoURL: firebaseUser.photoURL,
        });
        throw new NeedsOnboardingError();
      }

      // Existing user — clear flag and return AppUser normally.
      pendingGoogleOnboardingRef.current = false;
      const data = snap.data() as any;
      const appUser = mapToAppUser(firebaseUser, data);
      if (!appUser) {
        await signOut(auth);
        throw new Error("User account has an invalid role. Please contact support.");
      }
      return appUser;
    } catch (e) {
      if (!(e instanceof NeedsOnboardingError)) {
        pendingGoogleOnboardingRef.current = false;
        setPendingGoogleUser(null);
        await signOut(auth).catch(() => {});
      }
      throw e;
    }
  };

  const completeGoogleSignup = async (role: UserRole): Promise<void> => {
    const pending = pendingGoogleUser;
    const currentUser = auth.currentUser;
    if (!pending || !currentUser) throw new Error("No pending Google sign-in to complete.");

    const createdAt = new Date().toISOString();
    await setDoc(doc(db, USERS_COLLECTION, pending.uid), {
      email: pending.email,
      role,
      firstName: pending.firstName,
      lastName: pending.lastName,
      dateOfBirth: "",
      sex: "other",
      photoURL: pending.photoURL ?? null,
      createdAt,
      authProvider: "google",
    });

    pendingGoogleOnboardingRef.current = false;
    setPendingGoogleUser(null);

    const appUser = mapToAppUser(currentUser, {
      email: pending.email,
      role,
      firstName: pending.firstName,
      lastName: pending.lastName,
      dateOfBirth: "",
      sex: "other",
      photoURL: pending.photoURL ?? null,
    });
    if (!appUser) throw new Error("Failed to create user profile.");
    setUser(appUser);
  };

  const cancelGoogleSignup = async (): Promise<void> => {
    pendingGoogleOnboardingRef.current = false;
    setPendingGoogleUser(null);
    await signOut(auth);
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

  const updateProfile = useCallback(
    async (patch: ProfilePatch): Promise<void> => {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not authenticated.");
      await authService.updateUserProfile(currentUser.uid, patch);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              ...(patch.firstName !== undefined && { firstName: patch.firstName.trim() }),
              ...(patch.lastName !== undefined && { lastName: patch.lastName.trim() }),
              ...(patch.dateOfBirth !== undefined && { dateOfBirth: patch.dateOfBirth.trim() }),
              ...(patch.sex !== undefined && { sex: patch.sex }),
            }
          : prev
      );
    },
    []
  );

  const refreshUser = useCallback(async (): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const snap = await getDoc(doc(db, USERS_COLLECTION, currentUser.uid));
    if (!snap.exists()) return;
    const appUser = mapToAppUser(currentUser, snap.data() as any);
    if (appUser) setUser(appUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, pendingGoogleUser, login, loginWithGoogleIdToken, completeGoogleSignup, cancelGoogleSignup, signup, logout, updateProfile, refreshUser }}>
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

