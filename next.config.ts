import type { NextConfig } from "next";

// Static security headers. The Content-Security-Policy is set per request in
// src/proxy.ts because it carries a nonce.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The first version of the app used /dashboard and /admin; keep old bookmarks working.
  async redirects() {
    return [
      { source: "/admin", destination: "/backoffice", permanent: true },
      { source: "/admin/:path*", destination: "/backoffice/:path*", permanent: true },
      { source: "/dashboard", destination: "/schemes", permanent: true },
      { source: "/dashboard/:path*", destination: "/schemes", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
