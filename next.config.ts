import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker runtime
  // image can ship just the server + its traced deps instead of the whole repo.
  output: "standalone",
  // Allow an isolated build output directory (used by the E2E server so it can
  // run alongside a normal `npm run dev` on port 3000 without Turbopack
  // contending over the same `.next` folder). Defaults to `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow accessing the dev server (and its HMR/webpack resources) from other
  // hosts on the local network. Next.js blocks cross-origin dev requests by
  // default; list the LAN IPs/hostnames used to reach the dev server here.
  allowedDevOrigins: ["10.57.102.2"],
};

export default nextConfig;
