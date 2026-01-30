/**
 * GET /api/hdr/list
 *
 * Returns list of all available HDR configurations with metadata.
 */

import { NextResponse } from "next/server";
import { listHdrConfigs } from "../../../../../../scripts/lib/hdrConfig";

export async function GET() {
  try {
    const configs = listHdrConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Failed to list HDR configs:", error);
    return NextResponse.json(
      { error: "Failed to list HDR configurations" },
      { status: 500 }
    );
  }
}
