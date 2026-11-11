import type { NextConfig } from "next";
// Environment setup and API responses are evaluated per request, never prerendered.
const nextConfig: NextConfig = { poweredByHeader: false, devIndicators: false };
export default nextConfig;
