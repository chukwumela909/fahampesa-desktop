import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getMe, isBackendApiError, type BackendSession } from "@/lib/api";
import { clearOfflineData, getMeta, setMeta } from "@/offline/db";

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

type AuthStatus = "loading" | "signed_out" | "authenticated" | "blocked";

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  session: BackendSession | null;
  /** Why access was blocked (no business membership, or backend unreachable). */
  blockedReason: string;
  signInError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [blockedReason, setBlockedReason] = useState("");
  const [signInError, setSignInError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setSession(null);
        setStatus("signed_out");
        return;
      }

      setStatus("loading");
      try {
        const me = await getMe();
        setSession(me);
        await setMeta("session", me);
        await setMeta("sessionAt", Date.now());
        if (me.onboardingStatus?.hasBusiness || me.businessAccountId) {
          setBlockedReason("");
          setStatus("authenticated");
        } else {
          setBlockedReason("This account is not attached to an active Fahampesa business workspace yet.");
          setStatus("blocked");
        }
      } catch (error) {
        // Backend unreachable / token unverifiable — fall back to a recent cached session
        // so the app still opens offline within the 24h write window.
        const cached = await getMeta<BackendSession>("session");
        const cachedAt = (await getMeta<number>("sessionAt")) ?? 0;
        if (!isBackendApiError(error) && cached && Date.now() - cachedAt < SESSION_WINDOW_MS) {
          setSession(cached);
          setBlockedReason("");
          setStatus("authenticated");
          return;
        }
        setSession(null);
        if (isBackendApiError(error)) {
          setBlockedReason(error.status === 401 ? "Your session could not be verified by the server." : `The server returned an error (${error.code}).`);
        } else {
          setBlockedReason("Couldn't reach the Fahampesa server, and no recent offline session is available.");
        }
        setStatus("blocked");
      }
    });
    return unsubscribe;
  }, []);

  // Best-effort re-fetch of /me so subscription status (planTier / subscriptionStatus /
  // subscriptionEndsAt) stays current while the app is open. Without this the session is fetched
  // only once at sign-in, so a subscription that lapses mid-session keeps unlocking premium
  // features and hides the "Go Pro" CTA. On failure we keep the existing session (no sign-out).
  const refreshSession = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const me = await getMe();
      setSession(me);
      await setMeta("session", me);
      await setMeta("sessionAt", Date.now());
    } catch {
      /* transient — keep the current session */
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const refresh = () => void refreshSession();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    const id = window.setInterval(refresh, 10 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.clearInterval(id);
    };
  }, [status, refreshSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setSignInError("");
    setStatus("loading");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged takes over from here (fetches /me).
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      setSignInError(friendlyAuthError(code));
      setStatus("signed_out");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setSession(null);
    setSignInError("");
    setBlockedReason("");
    // Purge cached data + queued writes so the next account on this machine can't see or replay them.
    await clearOfflineData().catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, session, blockedReason, signInError, signIn, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
