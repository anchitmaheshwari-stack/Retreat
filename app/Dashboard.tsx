"use client";

import { useEffect } from "react";
import { MARKUP } from "@/lib/markup";
import { initDashboard } from "@/lib/dashboard";
import type { Snapshot } from "@/lib/types";

export default function Dashboard({ snapshot }: { snapshot: Snapshot }) {
  useEffect(() => {
    initDashboard(snapshot);
  }, [snapshot]);
  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
