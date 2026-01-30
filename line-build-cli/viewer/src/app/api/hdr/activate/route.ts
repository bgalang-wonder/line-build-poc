/**
 * POST /api/hdr/activate
 *
 * Switches the active HDR configuration.
 * Body: { configId: "express-6-pod" }
 */

import { NextRequest, NextResponse } from "next/server";
import { setActiveHdrConfig, loadHdrConfig } from "../../../../../../scripts/lib/hdrConfig";

export async function POST(request: NextRequest) {
  try {
    const { configId } = await request.json();

    if (!configId || typeof configId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid configId" },
        { status: 400 }
      );
    }

    // Verify the config exists before activating
    loadHdrConfig(configId);

    // Set as active
    setActiveHdrConfig(configId);

    return NextResponse.json({
      success: true,
      message: `Activated HDR config: ${configId}`,
      activeConfigId: configId,
    });
  } catch (error) {
    console.error("Failed to activate HDR config:", error);
    return NextResponse.json(
      { error: "Failed to activate HDR configuration" },
      { status: 500 }
    );
  }
}
