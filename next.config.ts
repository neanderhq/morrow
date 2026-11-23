import type { NextConfig } from "next";
import { securityHeaders } from "./server/security-headers.ts";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
