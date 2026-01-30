import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";

/**
 * CopilotKit Runtime Handler
 *
 * This endpoint provides the proper CopilotKit runtime protocol required for:
 * - useCopilotAction hooks on the client side
 * - CopilotSidebar and other CopilotKit UI components
 * - Agent registration and runtime sync
 *
 * The runtime uses Google Generative AI (Gemini) as the LLM backend.
 * Client-side actions registered via useCopilotAction() are automatically
 * discovered and executed by the runtime.
 */

// Create the Google Generative AI adapter for Gemini
const serviceAdapter = new GoogleGenerativeAIAdapter({
  model: process.env.VERTEX_AI_MODEL || "gemini-2.0-flash",
});

// Create the CopilotKit runtime
// The runtime handles:
// - Protocol handshake with CopilotKitProvider
// - Tool/action discovery and execution
// - Conversation management
const runtime = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
