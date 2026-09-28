import { googleFetch } from "./google";

export type SheetPage = { url: string; type: string; kw: string };

// Reads URL, Page Type, Primary Keyword from the first three columns of the tab.
export async function readPages(): Promise<SheetPage[]> {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error("SHEET_ID is not set");
  const tab = process.env.SHEET_TAB || "Sheet1";
  const range = encodeURIComponent(`'${tab}'!A:C`);
  const data = await googleFetch<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}`,
  );
  const [header, ...rows] = data.values ?? [];
  if (!header || !/url/i.test(header[0] ?? "")) throw new Error(`Tab "${tab}" should start with a URL column`);
  return rows
    .filter((r) => r[0]?.startsWith("http"))
    .map((r) => ({ url: r[0].trim(), type: (r[1] ?? "").trim() || "Other", kw: (r[2] ?? "").trim() }));
}
