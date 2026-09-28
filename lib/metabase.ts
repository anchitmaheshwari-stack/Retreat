// Pulls leads and onboardings per landing URL and month from a saved Metabase question.
//
// The question should return one row per lead (or one row per URL+date with counts).
// Column names are matched case-insensitively; override with the env vars below if needed.
//   METABASE_URL_COLUMN      landing page URL        (default: first column containing "url" or "page")
//   METABASE_DATE_COLUMN     lead / signup date      (default: first column containing "date", "created" or "month")
//   METABASE_LEADS_COLUMN    lead count              (optional; if missing, each row counts as 1 lead)
//   METABASE_ONBOARD_COLUMN  onboarding count/flag   (default: first column containing "onboard")

export type LeadCounts = Map<string, Map<string, { l: number; o: number }>>; // path -> month -> counts

const pick = (cols: string[], env: string | undefined, patterns: RegExp[]) => {
  if (env) {
    const c = cols.find((x) => x.toLowerCase() === env.toLowerCase());
    if (!c) throw new Error(`Metabase column "${env}" not found. Columns: ${cols.join(", ")}`);
    return c;
  }
  for (const p of patterns) {
    const c = cols.find((x) => p.test(x));
    if (c) return c;
  }
  return undefined;
};

const truthy = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n) && v.trim() !== "") return n;
    return /^(true|yes|y|onboarded|completed?)$/i.test(v.trim()) ? 1 : 0;
  }
  return 0;
};

export function toPath(u: string): string | null {
  if (!u) return null;
  try {
    const url = new URL(u.startsWith("http") ? u : `https://www.skydo.com${u.startsWith("/") ? "" : "/"}${u}`);
    return decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export async function fetchLeads(): Promise<LeadCounts | null> {
  const base = process.env.METABASE_URL?.replace(/\/+$/, "");
  const card = process.env.METABASE_CARD_ID;
  if (!base || !card) return null;
  const auth = await authHeader(base);
  if (!auth) return null;

  const res = await fetch(`${base}/api/card/${card}/query/json`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Metabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) throw new Error("Metabase did not return a row list");
  if (!rows.length) return new Map();

  const cols = Object.keys(rows[0]);
  const urlCol = pick(cols, process.env.METABASE_URL_COLUMN, [/url/i, /page/i, /path/i]);
  const dateCol = pick(cols, process.env.METABASE_DATE_COLUMN, [/date/i, /created/i, /month/i, /time/i]);
  const leadCol = pick(cols, process.env.METABASE_LEADS_COLUMN, [/lead/i]);
  const onbCol = pick(cols, process.env.METABASE_ONBOARD_COLUMN, [/onboard/i]);
  if (!urlCol || !dateCol) throw new Error(`Metabase question needs a URL and a date column. Columns: ${cols.join(", ")}`);

  const out: LeadCounts = new Map();
  for (const r of rows) {
    const path = toPath(String(r[urlCol] ?? ""));
    const d = String(r[dateCol] ?? "").slice(0, 7); // YYYY-MM
    if (!path || !/^\d{4}-\d{2}$/.test(d)) continue;
    const byMonth = out.get(path) ?? new Map();
    const cur = byMonth.get(d) ?? { l: 0, o: 0 };
    cur.l += leadCol ? truthy(r[leadCol]) : 1;
    cur.o += onbCol ? truthy(r[onbCol]) : 0;
    byMonth.set(d, cur);
    out.set(path, byMonth);
  }
  return out;
}

// An admin-issued API key, or else a regular user's login (no admin rights needed).
async function authHeader(base: string): Promise<Record<string, string> | null> {
  if (process.env.METABASE_API_KEY?.trim()) return { "x-api-key": process.env.METABASE_API_KEY };
  const username = process.env.METABASE_USERNAME;
  const password = process.env.METABASE_PASSWORD;
  if (!username || !password) return null;
  const res = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Metabase login failed (${res.status}). If your Metabase only allows Google sign-in, ask an admin for an API key instead.`);
  }
  const { id } = (await res.json()) as { id: string };
  return { "X-Metabase-Session": id };
}
