import { googleFetch } from "./google";

type ApiRow = { keys: string[]; clicks: number; impressions: number; position: number };

const site = () => {
  const s = process.env.GSC_SITE;
  if (!s) throw new Error("GSC_SITE is not set");
  return encodeURIComponent(s);
};

// Runs a Search Analytics query and follows pagination until every row is fetched.
export async function query(opts: {
  start: string;
  end: string;
  dimensions: string[];
  pageContains?: string;
}): Promise<ApiRow[]> {
  const out: ApiRow[] = [];
  const rowLimit = 25000;
  for (let startRow = 0; ; startRow += rowLimit) {
    const body = {
      startDate: opts.start,
      endDate: opts.end,
      dimensions: opts.dimensions,
      type: "web",
      rowLimit,
      startRow,
      dataState: "final",
      ...(opts.pageContains && {
        dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: opts.pageContains }] }],
      }),
    };
    const res = await googleFetch<{ rows?: ApiRow[] }>(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${site()}/searchAnalytics/query`,
      { method: "POST", body: JSON.stringify(body) },
    );
    const rows = res.rows ?? [];
    out.push(...rows);
    if (rows.length < rowLimit) return out;
  }
}

// Latest date with final data (GSC usually lags 2–3 days).
export async function latestDate(): Promise<string> {
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 864e5);
  const rows = await query({ start: iso(start), end: iso(end), dimensions: ["date"] });
  const dates = rows.map((r) => r.keys[0]).sort();
  if (!dates.length) throw new Error("Search Console returned no data for the last 14 days");
  return dates[dates.length - 1];
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);
