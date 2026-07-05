"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { get, ref, serverTimestamp, set } from "firebase/database";
import { auth, db } from "./firebase";
import type { Role } from "./roles";

type AuthContextValue = {
  user: User | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function ensureUserRecord(user: User): Promise<Role> {
  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);

  if (snapshot.exists()) {
    const data = snapshot.val() as { role?: Role };
    return data.role ?? "viewer";
  }

  await set(userRef, {
    email: user.email,
    displayName: user.displayName ?? null,
    role: "viewer",
    createdAt: serverTimestamp(),
  });
  return "viewer";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
      try {
        const resolvedRole = await ensureUserRecord(firebaseUser);
        setRole(resolvedRole);
      } catch {
        setRole(null);
        setError(
          "Could not load your account role from the database. This usually means the Realtime Database security rules haven't been published in the Firebase console yet."
        );
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const value: AuthContextValue = {
    user,
    role,
    loading,
    error,
    signInWithEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signInWithGoogle: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: async () => {
      await firebaseSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
