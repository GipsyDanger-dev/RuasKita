import type { NextConfig } from "next";

const apiProxyTarget =
  process.env.RUASKITA_API_PROXY_TARGET ?? "http://127.0.0.1:8000";
const allowedDevOrigins = (process.env.RUASKITA_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
