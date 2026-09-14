"use client";

/**
 * Session state, and the one decision in this file that matters.
 *
 * **The access token is held in memory only.** Not localStorage, not
 * sessionStorage, not a readable cookie. Anything reachable from JavaScript is
 * reachable from any script that gets injected into the page, and an access
 * token is a bearer credential — whoever holds it *is* the user until it
 * expires.
 *
 * The cost is real and worth stating: a hard browser refresh loses the session
 * and returns you to the login screen. That is not a bug, and it is not the
 * final design either. The auth service is already built for the standard
 * pattern — access token in memory, refresh token in an httpOnly `__Host-`
 * cookie the page cannot read — and `refresh_tokens`, the cookie names and the
 * rotation rules all exist in the schema. Only the endpoint is unbuilt (Step 6).
 * When it lands, `restore()` below starts calling it and the refresh survives.
 *
 * Storing the token in localStorage today would make the refresh problem go
 * away and quietly make every XSS a full account takeover. That trade is not
 * worth a page reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Session = {
  accessToken: string;
  expiresAt: number; // epoch ms
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
  signIn: (email: string, password: string, tenantSlug: string) => Promise<void>;
  signOut: () => void;
  /** Scope checks mirror the server's. The server is still the authority — this
   *  only decides whether to render a control the user cannot use. */
  can: (scope: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8001";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const signIn = useCallback(
    async (email: string, password: string, tenantSlug: string) => {
      const response = await fetch(`${AUTH_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, tenant_slug: tenantSlug }),
      });

      if (!response.ok) {
        // The server returns one message for every failure — unknown
        // institution, unknown user, wrong password, disabled account. Showing
        // anything more specific here would undo that on the client, so the
        // body is passed through unchanged.
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Sign-in failed.");
      }

      const data = await response.json();
      setSession({
        accessToken: data.token.access_token,
        expiresAt: Date.now() + data.token.expires_in * 1000,
        user: {
          userId: data.user.user_id,
          email: data.user.email,
          fullName: data.user.full_name,
          tenantSlug: data.user.tenant_slug,
          scopes: data.user.scopes,
        },
      });
    },
    [],
  );

  const signOut = useCallback(() => setSession(null), []);

  const can = useCallback(
    (scope: string) => session?.user.scopes.includes(scope) ?? false,
    [session],
  );

  const value = useMemo(
    () => ({ session, signIn, signOut, can }),
    [session, signIn, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
