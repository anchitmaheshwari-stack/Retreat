// Organic leads and onboardings per landing path and month, computed in Metabase (Prod Admin, Postgres).
//
// Leads follow question 5351 "Leads - Organic" at URL level: leads from the last 200 days,
// /features and query-string URLs dropped (except /convert- pages), deduped by mobile number
// keeping the earliest lead. A lead counts as onboarded when the earliest exporter_user with the
// same phone (last 10 digits) was created on or after the lead's day and its exporter is in
// onboarding_state BENEFICIARY_ACCOUNT_PENDING. Onboardings are attributed to the lead's month and URL.

export type LeadRow = { path: string; month: string; l: number; o: number };
export type LeadCounts = Map<string, Map<string, { l: number; o: number }>>; // path -> month -> counts

const DATABASE_ID = Number(process.env.METABASE_DATABASE_ID || 6);

const LEADS_CTE = `
WITH cleaned AS (
  SELECT created_at, mobile_number, SPLIT_PART(source_url, '?', 1) AS path
  FROM leads
  WHERE created_at >= CURRENT_DATE - INTERVAL '200 days'
    AND source_url NOT LIKE '/features%'
    AND (source_url NOT LIKE '%?%' OR source_url LIKE '/convert-%')
),
deduped AS (
  SELECT DISTINCT ON (mobile_number) created_at, path,
         RIGHT(REGEXP_REPLACE(mobile_number, '[^0-9]', '', 'g'), 10) AS m10
  FROM cleaned ORDER BY mobile_number, created_at
),
eu AS (
  SELECT DISTINCT ON (RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), 10))
         RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), 10) AS m10,
         created_at, exporter_id
  FROM exporter_user WHERE phone_number IS NOT NULL
  ORDER BY RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), 10), created_at
)`;

const monthStart = (m: string) => {
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error(`START_MONTH must look like 2026-08, got "${m}"`);
  return `${m}-01`;
};

export async function fetchLeadRows(startMonth: string): Promise<LeadRow[] | null> {
  const sql = `${LEADS_CTE}
SELECT LOWER(RTRIM(SPLIT_PART(d.path, '#', 1), '/')) AS path,
  TO_CHAR(d.created_at, 'YYYY-MM') AS month,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE e.onboarding_state::text = 'BENEFICIARY_ACCOUNT_PENDING') AS onb
FROM deduped d
LEFT JOIN eu ON eu.m10 = d.m10 AND eu.created_at >= DATE_TRUNC('day', d.created_at)
LEFT JOIN exporter e ON e.id = eu.exporter_id
WHERE d.created_at >= '${monthStart(startMonth)}'
GROUP BY 1, 2`;
  const rows = await runNative(sql);
  if (!rows) return null;
  return rows.map((r) => ({
    path: normPath(String(r.path ?? "")),
    month: String(r.month),
    l: Number(r.leads) || 0,
    o: Number(r.onb) || 0,
  }));
}

// Weekly lead totals (weeks start Sunday, like question 5351) with the same dedupe, for validation.
export async function fetchWeeklyLeadTotals(from: string, to: string): Promise<Map<string, number> | null> {
  const sql = `${LEADS_CTE}
SELECT TO_CHAR(DATE_TRUNC('week', d.created_at + INTERVAL '1 day') - INTERVAL '1 day', 'YYYY-MM-DD') AS week_start,
  COUNT(*) AS leads
FROM deduped d
WHERE d.created_at >= '${from}' AND d.created_at < '${to}'
GROUP BY 1`;
  const rows = await runNative(sql);
  if (!rows) return null;
  return new Map(rows.map((r) => [String(r.week_start), Number(r.leads) || 0]));
}

// Question 5351 rows summed across families, by week_start.
export async function fetchCardWeeklyTotals(cardId: number): Promise<Map<string, number> | null> {
  const ctx = await context();
  if (!ctx) return null;
  const res = await fetch(`${ctx.base}/api/card/${cardId}/query/json`, { method: "POST", headers: ctx.headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Metabase question ${cardId}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  const out = new Map<string, number>();
  for (const r of rows) {
    const w = String(r.week_start ?? "").slice(0, 10);
    out.set(w, (out.get(w) ?? 0) + (Number(r.leads) || 0));
  }
  return out;
}

export function toLeadCounts(rows: LeadRow[]): LeadCounts {
  const out: LeadCounts = new Map();
  for (const r of rows) {
    const byMonth = out.get(r.path) ?? new Map();
    const cur = byMonth.get(r.month) ?? { l: 0, o: 0 };
    cur.l += r.l;
    cur.o += r.o;
    byMonth.set(r.month, cur);
    out.set(r.path, byMonth);
  }
  return out;
}

// Lowercase path: no host, no #fragment, no trailing slash. Used on both the sheet and SQL side.
export function normPath(u: string): string {
  let p = u.trim().replace(/^https?:\/\/(www\.)?skydo\.com/i, "");
  p = p.split("#")[0].replace(/\/+$/, "").toLowerCase();
  return p || "/";
}

async function runNative(sql: string): Promise<Record<string, unknown>[] | null> {
  const ctx = await context();
  if (!ctx) return null;
  const query = { database: DATABASE_ID, type: "native", native: { query: sql } };
  // The /json export endpoint is not capped at 2,000 rows like /api/dataset.
  const res = await fetch(`${ctx.base}/api/dataset/json`, {
    method: "POST",
    headers: { ...ctx.headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: `query=${encodeURIComponent(JSON.stringify(query))}`,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Metabase query failed (${res.status}): ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error(`Metabase query error: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

let session: { base: string; headers: Record<string, string> } | null = null;

async function context() {
  const base = process.env.METABASE_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  if (session) return session;
  if (process.env.METABASE_API_KEY?.trim()) {
    session = { base, headers: { "x-api-key": process.env.METABASE_API_KEY.trim() } };
    return session;
  }
  // A regular user's login works; no admin rights needed.
  const username = process.env.METABASE_USERNAME?.trim();
  const password = process.env.METABASE_PASSWORD;
  if (!username || !password) return null;
  const res = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Metabase login failed (${res.status}). Check METABASE_USERNAME and METABASE_PASSWORD.`);
  const { id } = (await res.json()) as { id: string };
  session = { base, headers: { "X-Metabase-Session": id } };
  return session;
}
