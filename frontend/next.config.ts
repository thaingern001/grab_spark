import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_PUBLIC_GRABSPARK_JUDGE_DEMO === "1" || process.env.VERCEL === "1" ? ".next-judge" : ".next",
};

export default nextConfig;
