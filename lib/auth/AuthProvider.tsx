"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onIdTokenChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

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

          // One call sets the HttpOnly session cookie, links a first-time
          // Firebase UID onto the HR-created account, and returns the profile.
          // This handler also runs on Firebase's ~hourly silent token refresh,
          // so what used to be three requests per tab per hour is now one.
          const res = await fetch("/api/auth/bootstrap", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          });

          // 403 is terminal: either the email isn't in the directory, or the
          // account has been deactivated. Both mean this session shouldn't
          // continue, so drop it rather than leaving the app running with a
          // null profile.
          if (res.status === 403) {
            await signOut(auth);
            return;
          }

          if (res.ok) {
            const json = await res.json();
            setDbUser(json.data as DbProfile);
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

  // Real-time: refresh the authenticated profile whenever points, level,
  // badges, role, department, or editable profile fields change. Uses the
  // shared hook (rather than a hand-rolled channel) so this
  // subscription participates in the tab-hidden idle-disconnect + resync
  // behavior like every other channel — see lib/hooks/useRealtimeChannel.ts.
  const refreshRef = useRef(refreshProfile);
  useEffect(() => {
    refreshRef.current = refreshProfile;
  });
  useRealtimeChannel(
    dbUser?.id ? realtimeTopics.profile(dbUser.id) : null,
    () => refreshRef.current(),
    { debounceMs: 150 },
  );

  return (
    <AuthContext.Provider value={{ user, loading, token, dbUser, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
