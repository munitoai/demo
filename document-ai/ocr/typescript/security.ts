// Adapted from the monorepo console's csp.ts and public-web.ts.
export const permissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=()";

const pagePolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(development = false): Record<string, string> {
  return {
    "Content-Security-Policy": development ? "frame-ancestors 'none'" : pagePolicy,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": permissionsPolicy,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
}
