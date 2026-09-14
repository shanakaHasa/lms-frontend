import type { NextConfig } from "next";

/**
 * Security headers, including a CSP that has to know about two services.
 *
 * Two things here were wrong and worth recording, because both fail in ways
 * that do not look like CSP problems.
 *
 * **`'unsafe-eval'` in development.** Next's dev bundler evaluates modules with
 * `eval` so it can attach source maps. Without it in `script-src`, *no client
 * JavaScript runs at all* — and the symptom is not an obvious blank page. React
 * never hydrates, so every form falls back to a native browser submit and the
 * server log fills with `GET /login?`. It reads exactly like a broken form.
 * Production builds do not use `eval`, so the allowance is scoped to
 * development and never ships.
 *
 * **`connect-src` must list the auth service as well as the API.** These are
 * two origins, and the earlier config named only the API — so the login request
 * to `:8001` would have been blocked even once scripts ran. A CSP-blocked fetch
 * rejects with a bare `TypeError: Failed to fetch`, which looks like the server
 * being down rather than the page refusing to call it.
 */

const isDev = process.env.NODE_ENV !== "production";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8001";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const csp = [
      "default-src 'self'",
      // `unsafe-eval` is development-only; see the note above.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      // Both services, because the browser talks to each directly: auth for
      // sign-in and rotation, the API for everything else.
      `connect-src 'self' ${AUTH_URL} ${API_URL}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default config;
