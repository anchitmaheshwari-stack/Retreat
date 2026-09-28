import { unstable_cache } from "next/cache";
import { query, latestDate } from "./gsc";
import { readPages } from "./sheet";
import type { Month, MonthMetrics, Row, Snapshot } from "./types";
import sample from "./sample.json";

export const SNAPSHOT_TAG = "snapshot";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const RANGE_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const normUrl = (u: string) => u.split("#")[0].trim().replace(/\/+$/, "");
const normQ = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean).join(" ");
const round1 = (n: number) => Math.round(n * 10) / 10;

function monthsBetween(startMonth: string, latest: string): Month[] {
  const out: Month[] = [];
  let [y, m] = startMonth.split("-").map(Number);
  const [ly, lm, ld] = latest.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = y === ly && m === lm ? ld : daysInMonth;
    out.push({
      k: `${y}-${String(m).padStart(2, "0")}`,
      label: MONTH_SHORT[m - 1],
      name: `${MONTH_LONG[m - 1]} ${y}`,
      days: last,
      range: `${RANGE_SHORT[m - 1]} 1–${last}`,
      partial: last < daysInMonth,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const j = i++; out[j] = await fn(items[j]); }
  }));
  return out;
}

async function buildLive(): Promise<Snapshot> {
  const warnings: string[] = [];
  const [pages, latest] = await Promise.all([readPages(), latestDate()]);
  const months = monthsBetween(process.env.START_MONTH || "2026-08", latest);
  if (months.length > 1 && months[months.length - 1].days < 3) months.pop(); // skip a month with only 1–2 days of data

  // Query GSC per URL prefix (first path segment) to keep result sets small.
  const prefixes = [...new Set(pages.map((p) => "/" + (new URL(p.url).pathname.split("/")[1] ?? "")))];
  const jobs = months.flatMap((mo) => prefixes.flatMap((pre) => (["page", "query"] as const).map((kind) => ({ mo, pre, kind }))));
  const results = await pool(jobs, 4, async ({ mo, pre, kind }) => ({
    mo, kind,
    rows: await query({
      start: `${mo.k}-01`,
      end: `${mo.k}-${String(mo.days).padStart(2, "0")}`,
      dimensions: kind === "page" ? ["page"] : ["query", "page"],
      pageContains: pre,
    }),
  }));

  const pageStats = new Map<string, { c: number; i: number; p: number }>(); // month|url
  const kwStats = new Map<string, { i: number; w: number }>(); // month|url|query
  for (const { mo, kind, rows } of results) {
    for (const r of rows) {
      if (kind === "page") {
        if (r.keys[0].includes("#")) continue;
        pageStats.set(`${mo.k}|${normUrl(r.keys[0])}`, { c: r.clicks, i: r.impressions, p: r.position });
      } else {
        if (r.keys[1].includes("#")) continue;
        const k = `${mo.k}|${normUrl(r.keys[1])}|${normQ(r.keys[0])}`;
        const cur = kwStats.get(k) ?? { i: 0, w: 0 };
        cur.i += r.impressions; cur.w += r.position * r.impressions;
        kwStats.set(k, cur);
      }
    }
  }

  // Leads and onboardings are written to the sheet by lib/sheet-sync.ts, not exposed on this public page.
  warnings.push("Leads and onboardings are not shown on this page. They are updated daily in the sheet.");

  const rows: Row[] = pages.map((pg) => {
    const u = normUrl(pg.url);
    const path = new URL(u).pathname.replace(/\/+$/, "") || "/";
    const m: Record<string, MonthMetrics> = {};
    for (const mo of months) {
      const ps = pageStats.get(`${mo.k}|${u}`);
      const ks = pg.kw ? kwStats.get(`${mo.k}|${u}|${normQ(pg.kw)}`) : undefined;
      m[mo.k] = {
        c: ps?.c ?? 0,
        i: ps?.i ?? 0,
        p: ps ? round1(ps.p) : null,
        kp: ks && ks.i ? round1(ks.w / ks.i) : null,
        l: 0,
        o: 0,
      };
    }
    return { url: path, type: pg.type, kw: pg.kw, m };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    months,
    types: [...new Set(pages.map((p) => p.type))],
    rows,
    warnings,
  };
}

const REQUIRED = ["GOOGLE_SERVICE_ACCOUNT_JSON", "SHEET_ID", "GSC_SITE"] as const;
const missingConfig = () => REQUIRED.filter((k) => !process.env[k]?.trim());

const getLiveSnapshot = unstable_cache(buildLive, ["snapshot-v2"], {
  tags: [SNAPSHOT_TAG],
  revalidate: 60 * 60 * 12,
});

// Sample data is never cached, so the dashboard switches to live data as soon as credentials exist.
export async function getSnapshot(): Promise<Snapshot> {
  const missing = missingConfig();
  if (missing.length) {
    return { ...(sample as unknown as Snapshot), warnings: [`Showing sample data: ${missing.join(", ")} not set in Vercel.`] };
  }
  return getLiveSnapshot();
}
