import { NextRequest, NextResponse } from "next/server";

/**
 * CopilotKit Runtime Handler (benchtop-x0c.9.3)
 * Placeholder that returns search tool definitions as JSON
 * Full integration with CopilotKit runtime will happen when chat actions are defined
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Handle CopilotKit tool call requests
    if (body.action === "execute_tool") {
      const { toolName, parameters } = body;
      
      // Import tools dynamically
      const {
        searchLineBuilds,
        filterLineBuildsByStatus,
        filterLineBuildsbyAction,
        filterLineBuildsbyPhase,
        filterLineBuildsbyAuthor,
        getSearchFacets,
      } = await import("@/lib/copilotkit/searchTools");

      switch (toolName) {
        case "searchLineBuilds":
          return NextResponse.json(
            await searchLineBuilds(parameters.query)
          );
        case "filterByStatus":
          return NextResponse.json(
            await filterLineBuildsByStatus(parameters.status)
          );
        case "filterByAction":
          return NextResponse.json(
            await filterLineBuildsbyAction(parameters.actionType)
          );
        case "filterByPhase":
          return NextResponse.json(
            await filterLineBuildsbyPhase(parameters.phase)
          );
        case "filterByAuthor":
          return NextResponse.json(
            await filterLineBuildsbyAuthor(parameters.author)
          );
        case "getSearchFacets":
          return NextResponse.json(await getSearchFacets());
        default:
          return NextResponse.json(
            { error: `Unknown tool: ${toolName}` },
            { status: 400 }
          );
      }
    }

    // Return tool definitions for discovery
    return NextResponse.json({
      tools: [
        {
          name: "searchLineBuilds",
          description:
            "Search line builds by menu item name, ID, or other text. Returns matching builds with their details.",
          parameters: {
            query: {
              type: "string",
              description: "Search query for menu item name, ID, or build ID (supports partial matches)",
            },
          },
        },
        {
          name: "filterByStatus",
          description: "Filter line builds by their current status (draft or active).",
          parameters: {
            status: {
              type: "string",
              enum: ["draft", "active"],
              description: "Status to filter by: 'draft' or 'active'",
            },
          },
        },
        {
          name: "filterByAction",
          description: "Filter line builds containing a specific cooking action type.",
          parameters: {
            actionType: {
              type: "string",
              enum: ["PREP", "HEAT", "TRANSFER", "ASSEMBLE", "PORTION", "PLATE", "FINISH", "QUALITY_CHECK"],
              description:
                "Action type to filter by: PREP, HEAT, TRANSFER, ASSEMBLE, PORTION, PLATE, FINISH, or QUALITY_CHECK",
            },
          },
        },
        {
          name: "filterByPhase",
          description: "Filter line builds containing a specific cooking phase.",
          parameters: {
            phase: {
              type: "string",
              enum: ["PRE_COOK", "COOK", "POST_COOK", "ASSEMBLY", "PASS"],
              description: "Cooking phase to filter by: PRE_COOK, COOK, POST_COOK, ASSEMBLY, or PASS",
            },
          },
        },
        {
          name: "filterByAuthor",
          description: "Filter line builds by their author/creator.",
          parameters: {
            author: {
              type: "string",
              description: "Author name or part of it (supports partial matches)",
            },
          },
        },
        {
          name: "getSearchFacets",
          description:
            "Get available search filters and their counts. Useful for showing available options to the user.",
          parameters: {},
        },
      ],
    });
  } catch (error) {
    console.error("CopilotKit API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process CopilotKit request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
