import Dashboard from "./Dashboard";
import { getSnapshot } from "@/lib/snapshot";

// Rendered per request from the cached snapshot (refreshed by the daily cron), never at build time.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Page() {
  const snapshot = await getSnapshot();
  return <Dashboard snapshot={snapshot} />;
}
