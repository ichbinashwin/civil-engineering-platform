import type { NextConfig } from "next";

/**
 * Two build targets:
 * - default: Node server ("standalone", Docker) with HTTP security headers.
 * - GitHub Pages: static export when STATIC_EXPORT=true; served under PAGES_BASE_PATH
 *   (e.g. /civil-engineering-platform → https://www.shragavi.com/civil-engineering-platform).
 *   Static hosting cannot send HTTP headers, so the CSP is delivered as a <meta> tag (see app/layout.tsx).
 */
const staticExport = process.env.STATIC_EXPORT === "true";
const basePath = staticExport ? (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "") : "";

/** React dev tooling needs eval(); production never allows it. */
const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

export const CONTENT_SECURITY_POLICY = `default-src 'self'; script-src 'self' 'unsafe-inline'${devEval}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;

/** Security headers (OWASP) for the server build. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@civil/engineering-core",
    "@civil/engineering-excel",
    "@civil/engineering-validation",
    "@civil/shared-types",
  ],
  env: { NEXT_PUBLIC_STATIC_EXPORT: staticExport ? "true" : "false" },
  ...(staticExport
    ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } }
    : {
        output: "standalone",
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
