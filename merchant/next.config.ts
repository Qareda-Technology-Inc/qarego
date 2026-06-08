import type { NextConfig } from "next";

/** Backend URL for Next.js rewrites (server-side proxy). */
const API_TARGET =
  process.env.API_PROXY_TARGET?.replace(/\/$/, "") || "http://127.0.0.1:2026";

const nextConfig: NextConfig = {
  // Allow store/menu photos up to 8 MB through the /api → backend proxy
  experimental: {
    proxyClientMaxBodySize: "10mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_TARGET}/:path*`,
      },
    ];
  },
};

export default nextConfig;
