import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@resvg/resvg-js"],
};

export default nextConfig;
