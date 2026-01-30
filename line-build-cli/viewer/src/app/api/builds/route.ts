import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { resolveBuildsDir } from "@/lib/dataPaths";

export const dynamic = "force-dynamic";

const DATA_DIR = resolveBuildsDir();

export async function GET() {
  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));

    const summaries = await Promise.all(
      files.map(async (f) => {
        const raw = await fs.readFile(path.join(DATA_DIR, f.name), "utf8");
        const json = JSON.parse(raw) as Record<string, unknown>;
        return {
          buildId: json.id as string,
          itemId: json.itemId as string,
          name: json.name as string | undefined,
          version: json.version as number,
          status: json.status as string,
          updatedAt: json.updatedAt as string,
          createdAt: json.createdAt as string,
        };
      })
    );

    summaries.sort((a, b) => a.itemId.localeCompare(b.itemId) || a.version - b.version);
    return NextResponse.json(summaries);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Failed to list builds" }, { status: 500 });
  }
}
