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
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import type { AppUser, SignupPayload, UserRole } from "../types/User";

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  signup: (email: string, password: string, role: UserRole) => Promise<AppUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USERS_COLLECTION = "users";

const mapToAppUser = (user: User, role: AppUser["role"]): AppUser => ({
  id: user.uid,
  email: user.email ?? "",
  role,
});

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

        const docRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          setUser(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as { role: AppUser["role"]; email: string };
        setUser(mapToAppUser(firebaseUser, data.role));
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
      throw new Error("User profile not found.");
    }
    const data = snap.data() as { role: AppUser["role"]; email: string };
    const appUser = mapToAppUser(firebaseUser, data.role);
    setUser(appUser);
    return appUser;
  };

  const signup = async (email: string, password: string, role: UserRole): Promise<AppUser> => {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const { user: firebaseUser } = credential;

    await setDoc(doc(db, USERS_COLLECTION, firebaseUser.uid), {
      email: normalizedEmail,
      role,
    });

    const appUser = mapToAppUser(firebaseUser, role);
    setUser(appUser);
    return appUser;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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

