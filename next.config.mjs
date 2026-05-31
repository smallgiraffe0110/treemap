// Conditional standalone output: enabled for self-host (Node/Docker/Fly),
// disabled when building for Cloudflare Workers via @opennextjs/cloudflare
// (set CF_PAGES=1 or BUILDING_FOR_CF=1 in CF build env).
const buildingForCloudflare =
  process.env.CF_PAGES === "1" ||
  process.env.BUILDING_FOR_CF === "1" ||
  process.env.CLOUDFLARE_WORKERS === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output:
    !buildingForCloudflare && process.env.NODE_ENV === "production"
      ? "standalone"
      : undefined,
  turbopack: {},
};

export default nextConfig;
