import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow an isolated build output directory (used by the E2E server so it can
  // run alongside a normal `npm run dev` on port 3000 without Turbopack
  // contending over the same `.next` folder). Defaults to `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
