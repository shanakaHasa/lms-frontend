"use client";

/**
 * The signed-in frame: navigation, who you are, and the session guard.
 *
 * The guard sends you to /login when there is no session. That covers a hard
 * refresh, which loses the in-memory token by design — see `lib/auth.tsx`.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";

export default function Shell({ children }: { children: ReactNode }) {
  const { session, ready, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for the restore attempt. Redirecting before it finishes would bounce
    // a signed-in user to the login screen on every reload -- which is exactly
    // the problem the refresh cookie exists to solve.
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  if (!ready) return <div className="centre muted">Restoring session…</div>;
  if (!session) return null;

  const links = [
    { href: "/students", label: "Students", scope: "students:read" },
    { href: "/courses", label: "Courses", scope: "courses:read" },
  ];

  return (
    <div className="shell">
      <nav className="nav">
        <span className="brand">TeachAssist</span>
        {links
          // Hiding a link the token cannot use. The server still enforces the
          // scope -- this only avoids offering a control that would 403.
          .filter((link) => session.user.scopes.includes(link.scope))
          .map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname.startsWith(link.href) ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
        <span className="spacer" />
        <span className="muted">
          {session.user.fullName ?? session.user.email} · {session.user.tenantSlug}
        </span>
        <button className="link" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
