import { GoogleAuth } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

let auth: GoogleAuth | null = null;

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  // Accept raw JSON or base64-encoded JSON
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

export async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  auth ??= new GoogleAuth({ credentials: credentials(), scopes: SCOPES });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google API ${res.status} for ${url.split("?")[0]}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}
