import type { NextConfig } from "next";
// Resume uploads (max 5 MB) are posted to a server action, so allow slightly more than the file limit.
const nextConfig: NextConfig = { experimental: { serverActions: { bodySizeLimit: "6mb" } } };
export default nextConfig;
