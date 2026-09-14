"use client";

/**
 * Sign in.
 *
 * The institution is asked for explicitly rather than inferred from the email.
 * That is not friction for its own sake: `uq_users_tenant_email` is unique *per
 * tenant*, so the same address can legitimately belong to two institutions — a
 * tutor working at both. Without the slug the server would have to guess which
 * account was meant.
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("teacher@springfield.example.com");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("springfield-high");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password, tenant);
      router.push("/students");
    } catch (failure) {
      // Deliberately unelaborated. The server returns one message for every
      // failure mode so that a client cannot enumerate which addresses exist;
      // adding detail here would give that back.
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="centre">
      <form className="card form" onSubmit={onSubmit}>
        <h1>TeachAssist</h1>
        <p className="muted">Sign in to your institution.</p>

        <label>
          Institution
          <input
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            autoComplete="organization"
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
