/**
 * GET /api/hdr/config
 * Returns the active HDR configuration.
 *
 * POST /api/hdr/config
 * Saves or updates an HDR configuration.
 * Query param ?new=true creates a new config instead of overwriting.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadActiveHdrConfig,
  saveHdrConfig,
  setActiveHdrConfig,
} from "../../../../../../scripts/lib/hdrConfig";
import type { HdrPodConfig } from "../../../../../../config/hdr-pod.mock";

export async function GET() {
  try {
    const config = loadActiveHdrConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to load active HDR config:", error);
    return NextResponse.json(
      { error: "Failed to load HDR configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config: HdrPodConfig = await request.json();

    // Validate basic structure
    if (!config.hdrId || !config.name || !Array.isArray(config.pods)) {
      return NextResponse.json(
        { error: "Invalid HDR configuration structure" },
        { status: 400 }
      );
    }

    // Check if this is a "Save As" (new config) operation
    const isNew = request.nextUrl.searchParams.get("new") === "true";

    if (isNew) {
      // Ensure hdrId is unique for new configs
      // (In production, you'd check if file exists)
      saveHdrConfig(config);
      setActiveHdrConfig(config.hdrId);
      return NextResponse.json({
        success: true,
        message: `Created new HDR config: ${config.name}`,
        config,
      });
    } else {
      // Overwrite existing config
      saveHdrConfig(config);
      return NextResponse.json({
        success: true,
        message: `Saved HDR config: ${config.name}`,
        config,
      });
    }
  } catch (error) {
    console.error("Failed to save HDR config:", error);
    return NextResponse.json(
      { error: "Failed to save HDR configuration" },
      { status: 500 }
    );
  }
}
