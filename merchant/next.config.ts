import type { NextConfig } from "next";
import { resolveApiOrigin } from "./src/lib/appEnvironment";

const API_TARGET = resolveApiOrigin();

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
