import { revalidateTag } from "next/cache";
import { getSnapshot, SNAPSHOT_TAG } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Called daily by Vercel Cron (and manually with the same secret) to pull fresh data.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  revalidateTag(SNAPSHOT_TAG, { expire: 0 });
  try {
    const snap = await getSnapshot();
    return Response.json({
      ok: true,
      source: snap.source,
      months: snap.months.map((m) => `${m.k} (${m.range})`),
      rows: snap.rows.length,
      warnings: snap.warnings,
      ms: Date.now() - started,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
