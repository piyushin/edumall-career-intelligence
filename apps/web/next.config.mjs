import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  transpilePackages: ["@edumall/shared-types", "@edumall/ui"],
};

export default nextConfig;
