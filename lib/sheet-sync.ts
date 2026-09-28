// Daily write of organic leads and onboardings per URL into columns O:R of the "Sheet1 GSC MoM" tab.
// Touches only O:R of that tab. Validation failures abort the write.
import { googleFetch } from "./google";
import { fetchCardWeeklyTotals, fetchLeadRows, fetchWeeklyLeadTotals, normPath, type LeadRow } from "./metabase";

const TAB = process.env.LEADS_TAB || "Sheet1 GSC MoM";
const AUG = "2026-08";
const SEP = "2026-09";
const HEADERS = ["Leads (Aug)", "Leads (Sept)", "Onboardings (Aug)", "Onboardings (Sept)"];
const LEADS_CARD = 5351;
// Sunday-start weeks that sit fully inside August 2026, compared against question 5351.
const AUG_WEEKS = ["2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23"];

type Totals = { la: number; ls: number; oa: number; os: number };
export type SyncResult = { ok: boolean; wrote: boolean; report: string; problems: string[]; flags: string[] };

const sheetUrl = (range: string) =>
  `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(range)}`;
const num = (v: unknown) => Number(String(v ?? "").replace(/,/g, "")) || 0;
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

export async function syncLeadsToSheet({ dryRun = false } = {}): Promise<SyncResult> {
  const problems: string[] = [];
  const flags: string[] = [];
  const today = istDate();
  if (today >= "2026-10-01") {
    return {
      ok: false, wrote: false, problems: [`Run date ${today} is in October or later. New month columns need your go-ahead, so nothing was written.`], flags,
      report: `Stopped: run date ${today} is in October or later. Confirm how to add the new month columns.`,
    };
  }

  // 1. Column A (URL), B (Page Type) and the previous run's O:R.
  const sheet = await googleFetch<{ values?: string[][] }>(sheetUrl(`'${TAB}'!A1:R`));
  const values = sheet.values ?? [];
  const body = values.slice(1);
  const urlRows = body.map((r, i) => ({ i, url: (r[0] ?? "").trim(), type: (r[1] ?? "").trim() || "Other", prev: r.slice(14, 18).map(num) }));
  const withUrl = urlRows.filter((r) => r.url);

  // 2. Run the SQL and map by normalised path.
  const rows = await fetchLeadRows(AUG);
  if (!rows) throw new Error("Metabase is not configured (METABASE_URL and login).");
  const byPath = new Map<string, Totals>();
  for (const r of rows) {
    const t = byPath.get(r.path) ?? { la: 0, ls: 0, oa: 0, os: 0 };
    if (r.month === AUG) { t.la += r.l; t.oa += r.o; }
    if (r.month === SEP) { t.ls += r.l; t.os += r.o; }
    byPath.set(r.path, t);
  }
  const zero: Totals = { la: 0, ls: 0, oa: 0, os: 0 };
  const out = urlRows.map((r) => (r.url ? byPath.get(normPath(r.url)) ?? zero : null));

  // Validation
  const weekly = await fetchWeeklyLeadTotals("2026-08-02", "2026-08-30");
  const card = await fetchCardWeeklyTotals(LEADS_CARD);
  const checks: string[] = [];
  if (!weekly || !card) problems.push(`Could not run the question ${LEADS_CARD} comparison.`);
  else {
    let sa = 0, sb = 0;
    for (const w of AUG_WEEKS) {
      const a = weekly.get(w) ?? 0, b = card.get(w) ?? 0;
      sa += a; sb += b;
      if (a !== b) problems.push(`Week of ${w}: SQL has ${a} leads, question ${LEADS_CARD} has ${b}.`);
    }
    checks.push(`Aug weeks (${AUG_WEEKS[0]} to 2026-08-29), all paths: SQL ${sa} leads, question ${LEADS_CARD} ${sb}`);
  }
  urlRows.forEach((r, k) => {
    const t = out[k];
    if (t && (t.oa > t.la || t.os > t.ls)) problems.push(`Row ${r.i + 2} (${r.url}): onboardings exceed leads.`);
  });
  const written = out.filter(Boolean).length;
  if (written !== withUrl.length) problems.push(`Would write ${written} rows but column A has ${withUrl.length} URLs.`);
  checks.push(`Rows: ${written} written, ${withUrl.length} URLs in column A`);
  checks.push("Onboardings never exceed leads on any row");

  const sum = (f: (t: Totals) => number, list: (Totals | null)[]) => list.reduce((s, t) => s + (t ? f(t) : 0), 0);
  const prev = { la: 0, ls: 0, oa: 0, os: 0 };
  for (const r of withUrl) { prev.la += r.prev[0]; prev.ls += r.prev[1]; prev.oa += r.prev[2]; prev.os += r.prev[3]; }
  const now = { la: sum((t) => t.la, out), ls: sum((t) => t.ls, out), oa: sum((t) => t.oa, out), os: sum((t) => t.os, out) };
  if (now.la !== prev.la) flags.push(`Aug leads in the tab changed from ${prev.la} to ${now.la}.`);
  if (Math.abs(now.oa - prev.oa) > 3) flags.push(`Aug onboardings in the tab changed from ${prev.oa} to ${now.oa}.`);

  // 3. One batch write of O:R, values only.
  let wrote = false;
  if (!problems.length && !dryRun) {
    const data = [HEADERS, ...out.map((t) => (t ? [t.la, t.ls, t.oa, t.os] : ["", "", "", ""]))];
    await googleFetch(`${sheetUrl(`'${TAB}'!O1:R${data.length}`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ range: `'${TAB}'!O1:R${data.length}`, majorDimension: "ROWS", values: data }),
    });
    wrote = true;
  }

  return { ok: !problems.length, wrote, problems, flags, report: report(urlRows, out, rows, prev, now, problems, flags, wrote, dryRun, today, checks) };
}

function report(
  urlRows: { url: string; type: string }[], out: (Totals | null)[], rows: LeadRow[],
  prev: Totals, now: Totals, problems: string[], flags: string[], wrote: boolean, dryRun: boolean, today: string, checks: string[],
) {
  const byType = new Map<string, Totals>();
  urlRows.forEach((r, k) => {
    const t = out[k];
    if (!t) return;
    const a = byType.get(r.type) ?? { la: 0, ls: 0, oa: 0, os: 0 };
    a.la += t.la; a.ls += t.ls; a.oa += t.oa; a.os += t.os;
    byType.set(r.type, a);
  });
  const inTab = new Set(urlRows.filter((r) => r.url).map((r) => normPath(r.url)));
  const extra = new Map<string, Totals>();
  for (const r of rows) {
    if (inTab.has(r.path) || (r.month !== AUG && r.month !== SEP)) continue;
    const t = extra.get(r.path) ?? { la: 0, ls: 0, oa: 0, os: 0 };
    if (r.month === AUG) { t.la += r.l; t.oa += r.o; } else { t.ls += r.l; t.os += r.o; }
    extra.set(r.path, t);
  }
  const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
  const status = problems.length ? "Validation failed, nothing written" : wrote ? "Written to sheet" : dryRun ? "Dry run, nothing written" : "Not written";
  const lines = [
    `Run ${today} (IST): ${status}`,
    "",
    ...(problems.length ? ["| Validation problem |", "| --- |", ...problems.map((p) => row([p])), ""] : []),
    ...(flags.length ? ["| Flag |", "| --- |", ...flags.map((f) => row([f])), ""] : []),
    ...(problems.length ? [] : ["| Check passed |", "| --- |", ...checks.map((c) => row([c])), ""]),
    "1. Totals by Page Type",
    "",
    row(["Page Type", "Leads Aug", "Leads Sept", "Onb Aug", "Onb Sept"]),
    row(["---", "---:", "---:", "---:", "---:"]),
    ...[...byType].sort((a, b) => b[1].ls + b[1].la - (a[1].ls + a[1].la)).map(([k, t]) => row([k, t.la, t.ls, t.oa, t.os])),
    row(["Total", now.la, now.ls, now.oa, now.os]),
    "",
    "2. Paths with leads that are not in the tab",
    "",
    row(["Path", "Leads Aug", "Leads Sept", "Onb Aug", "Onb Sept"]),
    row(["---", "---:", "---:", "---:", "---:"]),
    ...[...extra].sort((a, b) => b[1].la + b[1].ls - (a[1].la + a[1].ls)).map(([p, t]) => row([p, t.la, t.ls, t.oa, t.os])),
    "",
    "3. Sept totals vs previous run",
    "",
    row(["Metric", "Previous", "Now", "Change"]),
    row(["---", "---:", "---:", "---:"]),
    row(["Leads Sept", prev.ls, now.ls, signed(now.ls - prev.ls)]),
    row(["Onboardings Sept", prev.os, now.os, signed(now.os - prev.os)]),
  ];
  return lines.join("\n");
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
