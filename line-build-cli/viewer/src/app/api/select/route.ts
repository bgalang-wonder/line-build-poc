import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * API endpoint to trigger navigation to a specific build.
 * This is a convenience endpoint for Claude Code to use.
 * 
 * Returns a redirect URL that the viewer can navigate to.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const buildId = searchParams.get("buildId");
  
  if (!buildId) {
    return NextResponse.json({ error: "buildId parameter required" }, { status: 400 });
  }
  
  // Return the viewer URL with the buildId parameter
  const viewerUrl = `/?buildId=${encodeURIComponent(buildId)}`;
  return NextResponse.json({ url: viewerUrl, buildId });
}
