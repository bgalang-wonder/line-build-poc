import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { resolveSelectionPath } from "@/lib/dataPaths";

export const dynamic = "force-dynamic";

const SELECTION_PATH = resolveSelectionPath();

export type ViewerSelectionRequest =
  | { buildId: null }
  | { buildId: string; requestId: string; timestamp: string; stepId?: string };

export async function GET() {
  try {
    const raw = await fs.readFile(SELECTION_PATH, "utf8");
    const json = JSON.parse(raw) as ViewerSelectionRequest;
    return NextResponse.json(json);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ buildId: null } satisfies ViewerSelectionRequest);
    }
    return NextResponse.json({ error: "Failed to read selection" }, { status: 500 });
  }
}
