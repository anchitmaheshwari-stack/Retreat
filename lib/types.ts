export type MonthMetrics = {
  c: number; // clicks
  i: number; // impressions
  p: number | null; // avg position (page)
  kp: number | null; // avg position for the primary keyword on this page
  l: number; // leads
  o: number; // onboardings
};

export type Month = {
  k: string; // "2026-08"
  label: string; // "Aug"
  name: string; // "August 2026"
  days: number; // days of data in the range
  range: string; // "Aug 1–31"
  partial: boolean;
};

export type Row = {
  url: string; // path, e.g. /compare/skydo-vs-wise
  type: string;
  kw: string;
  m: Record<string, MonthMetrics>;
};

export type Snapshot = {
  generatedAt: string;
  source: "live" | "sample";
  months: Month[];
  types: string[];
  rows: Row[];
  warnings: string[];
};
