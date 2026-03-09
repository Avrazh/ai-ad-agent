import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@sparticuz/chromium", "puppeteer-core", "@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/generate": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/regenerate": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/surprise-render": ["./node_modules/@sparticuz/chromium/**/*"],
  },
};

export default nextConfig;
