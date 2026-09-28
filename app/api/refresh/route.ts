import { revalidateTag } from "next/cache";
import { getSnapshot, SNAPSHOT_TAG } from "@/lib/snapshot";
import { syncLeadsToSheet } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Called daily by Vercel Cron (and manually with the same secret).
// Refreshes the dashboard data, then writes leads and onboardings into the sheet.
// Add ?dry=1 to validate and get the report without writing.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const lines: string[] = [];

  revalidateTag(SNAPSHOT_TAG, { expire: 0 });
  try {
    const snap = await getSnapshot();
    lines.push(`Dashboard: ${snap.source} data, ${snap.rows.length} URLs, months ${snap.months.map((m) => m.range.replace("–", " to ")).join(", ")}`);
  } catch (e) {
    lines.push(`Dashboard refresh failed: ${(e as Error).message}`);
  }

  let status = 200;
  try {
    const sync = await syncLeadsToSheet({ dryRun });
    lines.push("", sync.report);
    if (!sync.ok) status = 422;
  } catch (e) {
    lines.push("", `Sheet sync failed: ${(e as Error).message}`);
    status = 500;
  }

  const text = lines.join("\n");
  console.log(text);
  return new Response(text, { status, headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
