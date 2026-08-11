"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onIdTokenChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";

type DbProfile = {
  id: string;
  displayName: string;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "SUPER_ADMIN";
  pointsBalance: number;
  level: number;
  onboardingComplete: boolean;
  birthday: string | null;
  department: { id: string; name: string } | null;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  dbUser: DbProfile | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  dbUser: null,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbUser, setDbUser] = useState<DbProfile | null>(null);

  useEffect(() => {
    // onIdTokenChanged fires on login/logout AND on every silent token refresh
    // (~hourly), so the stored token + firebase-token cookie stay fresh for the
    // life of the session instead of going stale after the first hour.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          setUser(firebaseUser);
          setToken(idToken);

          // Set the HttpOnly session cookie server-side (replaces the old
          // JS-readable document.cookie write). Kept fresh on each token change.
          fetch("/api/auth/session", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          }).catch((err) => console.error("session cookie set failed", err));

          const syncRes = await fetch("/api/auth/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          });

          if (syncRes.status === 403) {
            await signOut(auth);
            return;
          }

          const meRes = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (meRes.ok) {
            const meJson = await meRes.json();
            setDbUser(meJson.data as DbProfile);
          }
        } else {
          setUser(null);
          setToken(null);
          setDbUser(null);
          // Clear the HttpOnly session cookie server-side.
          fetch("/api/auth/session", { method: "DELETE" }).catch((err) => console.error("session cookie clear failed", err));
        }
      } catch {
        setUser(null);
        setToken(null);
        setDbUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function refreshProfile() {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const idToken = await firebaseUser.getIdToken();
    const meRes = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (meRes.ok) {
      const meJson = await meRes.json();
      setDbUser(meJson.data as DbProfile);
    }
  }

  // Real-time: refresh points balance whenever the server broadcasts a points
  // change. Uses the shared hook (rather than a hand-rolled channel) so this
  // subscription participates in the tab-hidden idle-disconnect + resync
  // behavior like every other channel — see lib/hooks/useRealtimeChannel.ts.
  const refreshRef = useRef(refreshProfile);
  refreshRef.current = refreshProfile;
  useRealtimeChannel(dbUser?.id ? `points:${dbUser.id}` : null, () => refreshRef.current());

  return (
    <AuthContext.Provider value={{ user, loading, token, dbUser, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
