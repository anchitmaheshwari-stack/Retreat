import Dashboard from "./Dashboard";
import { getSnapshot } from "@/lib/snapshot";

// Rendered per request from the cached snapshot (refreshed by the daily cron), never at build time.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Page() {
  try {
    const snapshot = await getSnapshot();
    return <Dashboard snapshot={snapshot} />;
  } catch (e) {
    return (
      <div className="wrap">
        <h1>Content Retreat SEO</h1>
        <div className="warn">The data refresh failed: {(e as Error).message}</div>
        <p className="sub">Check the environment variables in Vercel, then reload this page.</p>
      </div>
    );
  }
}
