"use client";

/**
 * Session state.
 *
 * **The access token is held in memory. The refresh token is an httpOnly cookie
 * this code cannot read.** That split is the whole design: the short-lived
 * credential lives where a reload loses it, and the long-lived one lives where
 * script cannot reach it at all — so an injected script can steal at most the
 * remainder of a ten-minute token, and cannot mint itself a new session.
 *
 * A reload now survives, because `restore()` asks the server to rotate the
 * cookie into a fresh access token. Nothing is read from localStorage at any
 * point; if it were, the cookie being httpOnly would be pointless.
 *
 * Every call here sends `credentials: "include"`, without which the browser
 * would not attach the cookie to a cross-origin request and refresh would
 * silently never work.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Session = {
  accessToken: string;
  expiresAt: number;
  user: {
    userId: string;
    email: string;
    fullName: string | null;
    tenantSlug: string;
    scopes: string[];
  };
};

type AuthState = {
  session: Session | null;
  /** Null until the first restore attempt finishes, so the UI can avoid
   *  flashing the login screen at someone who is still signed in. */
  ready: boolean;
  signIn: (email: string, password: string, tenantSlug: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (scope: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8001";

/** Refresh this long before expiry, so a request never races the clock. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Read the display fields out of an access token.
 *
 * Decoded, **not verified** — and that distinction matters. The server verifies
 * the signature on every request; this only unpacks a name and a tenant to put
 * in the header. Nothing here is an authorization decision, and the scope list
 * it returns is used solely to avoid rendering controls that would 403.
 */
function readClaims(token: string): Session["user"] | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return {
      userId: payload.sub,
      email: payload.email ?? "",
      fullName: null,
      tenantSlug: payload.tsl ?? "",
      scopes: String(payload.scope ?? "").split(" ").filter(Boolean),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyToken = useCallback(
    (accessToken: string, expiresIn: number, user: Session["user"]) => {
      setSession({ accessToken, expiresAt: Date.now() + expiresIn * 1000, user });
    },
    [],
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    const response = await fetch(`${AUTH_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) return false;

    const data = await response.json();
    const claims = readClaims(data.token.access_token);
    if (!claims) return false;

    applyToken(data.token.access_token, data.token.expires_in, claims);
    return true;
  }, [applyToken]);

  // On mount, try to turn the cookie back into a session. This is what makes a
  // page reload survive without the token ever touching disk.
  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  // Rotate shortly before expiry. Without this the first request after ten
  // minutes fails, and the user sees an error rather than a working page.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!session) return;

    const delay = Math.max(session.expiresAt - Date.now() - REFRESH_MARGIN_MS, 5_000);
    timer.current = setTimeout(() => {
      void refresh().then((ok) => {
        // A failed refresh means the family was revoked -- logout elsewhere, a
        // password change, or reuse detection. Dropping the session sends the
        // user to sign in again, which is the correct response.
        if (!ok) setSession(null);
      });
    }, delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [session, refresh]);

  const signIn = useCallback(
    async (email: string, password: string, tenantSlug: string) => {
      const response = await fetch(`${AUTH_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, tenant_slug: tenantSlug }),
      });

      if (!response.ok) {
        // The server returns one message for every failure mode so a client
        // cannot enumerate which addresses exist. Passed through unchanged.
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Sign-in failed.");
      }

      const data = await response.json();
      applyToken(data.token.access_token, data.token.expires_in, {
        userId: data.user.user_id,
        email: data.user.email,
        fullName: data.user.full_name,
        tenantSlug: data.user.tenant_slug,
        scopes: data.user.scopes,
      });
    },
    [applyToken],
  );

  const signOut = useCallback(async () => {
    // Server-side first: revoking the family is what actually ends the session.
    // Clearing local state alone would leave a usable refresh cookie behind.
    await fetch(`${AUTH_URL}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    setSession(null);
  }, []);

  const can = useCallback(
    (scope: string) => session?.user.scopes.includes(scope) ?? false,
    [session],
  );

  const value = useMemo(
    () => ({ session, ready, signIn, signOut, can }),
    [session, ready, signIn, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
