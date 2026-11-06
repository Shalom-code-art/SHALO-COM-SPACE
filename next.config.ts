import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a self-contained server bundle for deployment (see docs/DEPLOYMENT.md).
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
