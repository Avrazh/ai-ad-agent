import type { NextConfig } from "next";

const pkg = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  serverExternalPackages: ["sharp", "@sparticuz/chromium", "puppeteer-core", "@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/generate": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/regenerate": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/surprise-render": ["./node_modules/@sparticuz/chromium/**/*"],
  },
  webpack: (config) => {
    // Limit parallel workers and disable disk cache to prevent OOM on low-memory machines
    config.parallelism = 1;
    config.cache = false;
    return config;
  },
};

export default nextConfig;
