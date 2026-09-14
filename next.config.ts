import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Amplify Hosting runs the Next.js server runtime, so SSR and route handlers
  // both work. `output: "standalone"` is only needed for a container deploy.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app renders clinical text; a strict CSP is worth the setup cost.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? ""}`,
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default config;
