import type { NextConfig } from "next";

const pkg = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  serverExternalPackages: [
    "sharp",
    "@sparticuz/chromium",
    "puppeteer-core",
    "puppeteer",
    "@resvg/resvg-js",
    "@anthropic-ai/sdk",
    "@libsql/client",
    "better-sqlite3",
  ],
  outputFileTracingIncludes: {
    "/api/generate": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/regenerate": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/surprise-render": ["./node_modules/@sparticuz/chromium/**/*"],
  },
  // Required to silence "webpack config without turbopack config" error on Next.js 16
  turbopack: {},
  webpack: (config) => {
    // Reduce memory usage during compilation on low-RAM machines
    config.parallelism = 1;
    config.cache = false;
    return config;
  },
};

export default nextConfig;
