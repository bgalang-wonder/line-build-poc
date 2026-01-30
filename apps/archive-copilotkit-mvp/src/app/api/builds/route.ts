import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV_VAR = "LINE_BUILD_POC_DATA_DIR";
const FALLBACK_RELATIVE_TO_NEXT_APP = "../../poc/line-build-cli/data";

type BuildSummary = {
  buildId: string;
  itemId: string;
  version: number;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  createdAt: string;
  relativePath: string;
};

function resolveDataRootAbs(): string {
  const env = process.env[ENV_VAR];
  if (typeof env === "string" && env.trim().length > 0) {
    return path.resolve(env.trim());
  }

  /**
   * Per docs/handoff/POC_TASKS.json -> shared_conventions.viewer_data_root_strategy:
   * resolve "../../poc/line-build-cli/data" relative to the Next app.
   *
   * We support both common dev execution patterns:
   * - running Next from apps/line-build-mvp
   * - running Next from repo root
   */
  const candidates = [
    path.resolve(process.cwd(), FALLBACK_RELATIVE_TO_NEXT_APP),
    path.resolve(process.cwd(), "apps/line-build-mvp", FALLBACK_RELATIVE_TO_NEXT_APP),
  ];

  for (const c of candidates) {
    if (fsSync.existsSync(c)) return c;
  }

  // Deterministic failure (no implicit guessing beyond known candidates).
  throw new Error(
    `Unable to resolve PoC data root. Set ${ENV_VAR} or create one of: ${candidates.join(
      ", ",
    )}`,
  );
}

function coerceStatus(status: unknown): BuildSummary["status"] {
  return status === "draft" || status === "published" || status === "archived"
    ? status
    : "draft";
}

export async function GET() {
  try {
    const dataRootAbs = resolveDataRootAbs();
    const buildsDirAbs = path.join(dataRootAbs, "line-builds");

    const entries = await fs.readdir(buildsDirAbs, { withFileTypes: true });
    const ids = entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => e.name.slice(0, -".json".length));

    const summaries = await Promise.all(
      ids.map(async (id): Promise<BuildSummary> => {
        const raw = await fs.readFile(path.join(buildsDirAbs, `${id}.json`), {
          encoding: "utf8",
        });
        const json = JSON.parse(raw) as Record<string, unknown>;

        const buildId = typeof json.id === "string" ? json.id : id;
        const itemId =
          typeof json.itemId === "string"
            ? json.itemId
            : typeof json.menuItemId === "string"
              ? json.menuItemId
              : "";
        const version = typeof json.version === "number" ? json.version : 0;
        const status = coerceStatus(json.status);
        const updatedAt = typeof json.updatedAt === "string" ? json.updatedAt : "";
        const createdAt = typeof json.createdAt === "string" ? json.createdAt : "";

        return {
          buildId,
          itemId,
          version,
          status,
          updatedAt,
          createdAt,
          relativePath: `line-builds/${id}.json`,
        };
      }),
    );

    // Stable ordering independent of filesystem traversal order.
    summaries.sort((a, b) => {
      if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
      if (a.version !== b.version) return a.version - b.version;
      return a.buildId.localeCompare(b.buildId);
    });

    return NextResponse.json(summaries);
  } catch (err) {
    // If directory doesn't exist yet, treat as empty store.
    if ((err as { code?: string }).code === "ENOENT") {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to list builds",
      },
      { status: 500 },
    );
  }
}

