import { NextResponse } from "next/server";

// Import from the CLI's complexity module (relative to viewer)
import {
  loadComplexityConfig,
  saveComplexityConfig,
  resetComplexityConfig,
  hasJsonConfigOverride,
} from "../../../../../../scripts/lib/complexity/config";

import { DEFAULT_COMPLEXITY_CONFIG } from "../../../../../../config/complexity.config";

export const dynamic = "force-dynamic";

/**
 * GET /api/complexity/config
 * Returns the current complexity config.
 */
export async function GET() {
  try {
    const config = loadComplexityConfig();
    const hasOverride = hasJsonConfigOverride();

    return NextResponse.json({
      config,
      hasOverride,
      defaults: DEFAULT_COMPLEXITY_CONFIG,
    });
  } catch (err) {
    console.error("Error loading complexity config:", err);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/complexity/config
 * Save updated complexity config.
 *
 * Body: { config: ComplexityConfig } | { reset: true }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.reset === true) {
      resetComplexityConfig();
      return NextResponse.json({
        ok: true,
        message: "Config reset to defaults",
        config: DEFAULT_COMPLEXITY_CONFIG,
      });
    }

    if (!body.config) {
      return NextResponse.json(
        { error: "Missing config in request body" },
        { status: 400 }
      );
    }

    saveComplexityConfig(body.config);

    return NextResponse.json({
      ok: true,
      message: "Config saved",
      config: body.config,
    });
  } catch (err) {
    console.error("Error saving complexity config:", err);
    return NextResponse.json(
      { error: `Failed to save config: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
