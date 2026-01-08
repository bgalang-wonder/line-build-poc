import { NextRequest, NextResponse } from "next/server";

// Placeholder for CopilotKit backend route
// Full implementation will be completed when CopilotKit actions are defined
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: "CopilotKit runtime not yet fully configured" },
    { status: 501 }
  );
}
