import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // T-70: Best bets moved from /flags to /. Old links, saved views and shares keep working (query is kept).
  redirects: async () => [{ source: "/flags", destination: "/", permanent: true }],
};

export default config;
