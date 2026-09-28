import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // 01:30 UTC = 07:00 IST, after Search Console has published the previous day's data.
  crons: [{ path: "/api/refresh", schedule: "30 1 * * *" }],
};
