import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wordcast/shared", "@wordcast/video"],
  // Pin the workspace root so Next ignores stray parent lockfiles.
  outputFileTracingRoot: dirname(dirname(__dirname)),
};

export default nextConfig;
