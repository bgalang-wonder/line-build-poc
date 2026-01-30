import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV_VAR = "LINE_BUILD_POC_DATA_DIR";
const FALLBACK_RELATIVE_TO_NEXT_APP = "../../poc/line-build-cli/data";

function resolveDataRootAbs(): string {
  const env = process.env[ENV_VAR];
  if (typeof env === "string" && env.trim().length > 0) {
    return path.resolve(env.trim());
  }

  const candidates = [
    path.resolve(process.cwd(), FALLBACK_RELATIVE_TO_NEXT_APP),
    path.resolve(process.cwd(), "apps/line-build-mvp", FALLBACK_RELATIVE_TO_NEXT_APP),
  ];

  for (const c of candidates) {
    if (fsSync.existsSync(c)) return c;
  }

  throw new Error(
    `Unable to resolve PoC data root. Set ${ENV_VAR} or create one of: ${candidates.join(
      ", ",
    )}`,
  );
}

export async function GET(
  _req: Request,
  { params }: { params: unknown },
) {
  const { buildId } = (await params) as { buildId: string };

  try {
    const dataRootAbs = resolveDataRootAbs();
    const validationDirAbs = path.join(dataRootAbs, "validation");
    const filePath = path.join(validationDirAbs, `${buildId}.latest.json`);

    const raw = await fs.readFile(filePath, { encoding: "utf8" });
    const json = JSON.parse(raw) as unknown;
    return NextResponse.json(json);
  } catch (err) {
    if ((err as { code?: string }).code === "ENOENT") {
      return NextResponse.json(
        { error: "Validation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to read validation",
        buildId,
      },
      { status: 500 },
    );
  }
}

