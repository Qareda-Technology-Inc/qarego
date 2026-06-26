import type { NextConfig } from "next";
import { resolveApiOrigin } from "./src/lib/appEnvironment";

const API_TARGET = resolveApiOrigin();

const nextConfig: NextConfig = {
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
