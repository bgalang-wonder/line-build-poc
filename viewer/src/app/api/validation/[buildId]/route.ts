import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { resolveValidationDir } from "@/lib/dataPaths";

export const dynamic = "force-dynamic";

const DATA_DIR = resolveValidationDir();

export async function GET(
  _request: Request,
  { params }: { params: { buildId: string } }
) {
  const { buildId } = params;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${buildId}.latest.json`), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Validation not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to read validation" }, { status: 500 });
  }
}
