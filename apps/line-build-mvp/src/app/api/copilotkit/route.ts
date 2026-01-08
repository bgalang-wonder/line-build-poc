import { NextRequest, NextResponse } from "next/server";

/**
 * CopilotKit Runtime Handler (benchtop-x0c.9.3 + bulk edit tools)
 * Handles search tool and bulk edit tool requests
 * Full integration with CopilotKit runtime will happen when chat actions are defined
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle CopilotKit tool call requests
    if (body.action === "execute_tool") {
      const { toolName, parameters } = body;

      // Import search tools dynamically
      const {
        searchLineBuilds,
        filterLineBuildsByStatus,
        filterLineBuildsbyAction,
        filterLineBuildsbyPhase,
        filterLineBuildsbyAuthor,
        getSearchFacets,
      } = await import("@/lib/copilotkit/searchTools");

      // Import bulk edit tools dynamically
      const {
        findStepsMatchingCriteria,
        proposeBulkEdit,
        applyBulkEdit,
        cancelProposal,
        getProposal,
        listPendingProposals,
        formatFindResultSummary,
        formatProposalSummary,
        formatBulkEditResultSummary,
      } = await import("@/lib/copilotkit/bulkEditTools");

      switch (toolName) {
        // Search tools
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

        // Bulk edit tools
        case "findStepsMatchingCriteria": {
          const criteria = {
            equipment: parameters.equipment,
            actionType: parameters.actionType,
            timeGreaterThan: parameters.timeGreaterThanMinutes
              ? parameters.timeGreaterThanMinutes * 60
              : undefined,
            timeLessThan: parameters.timeLessThanMinutes
              ? parameters.timeLessThanMinutes * 60
              : undefined,
            phase: parameters.phase,
            targetName: parameters.targetName,
            station: parameters.station,
            draftOnly: parameters.draftOnly ?? true,
          };
          const result = await findStepsMatchingCriteria(criteria);
          return NextResponse.json({
            ...result,
            summary: formatFindResultSummary(result),
          });
        }

        case "proposeBulkEdit": {
          const criteria = {
            equipment: parameters.equipment,
            actionType: parameters.actionType,
            timeGreaterThan: parameters.timeGreaterThanMinutes
              ? parameters.timeGreaterThanMinutes * 60
              : undefined,
            phase: parameters.phase,
            targetName: parameters.targetName,
            draftOnly: true,
          };

          let newValue: unknown;
          switch (parameters.editType) {
            case "updateEquipment":
              newValue = parameters.newEquipment;
              break;
            case "updateStation":
              newValue = parameters.newStation;
              break;
            case "updatePhase":
              newValue = parameters.newPhase;
              break;
            case "updateTargetName":
              newValue = parameters.newTargetName;
              break;
            case "updateTime":
              newValue = {
                value: parameters.newTimeMinutes,
                unit: "min",
                type: parameters.newTimeType || "active",
              };
              break;
          }

          const proposal = await proposeBulkEdit(
            criteria,
            parameters.editType,
            newValue,
            parameters.equipment
              ? `equipment containing "${parameters.equipment}"`
              : undefined
          );
          return NextResponse.json({
            ...proposal,
            summary: formatProposalSummary(proposal),
          });
        }

        case "applyBulkEdit": {
          if (!parameters.confirmed) {
            return NextResponse.json({
              error: "Confirmation required",
              message:
                "Please confirm you want to apply this bulk edit before proceeding.",
            });
          }
          const result = await applyBulkEdit(parameters.proposalId);
          return NextResponse.json({
            ...result,
            summary: formatBulkEditResultSummary(result),
          });
        }

        case "cancelBulkEditProposal": {
          const success = cancelProposal(parameters.proposalId);
          return NextResponse.json({
            success,
            message: success
              ? `Proposal ${parameters.proposalId} cancelled`
              : `Could not cancel proposal ${parameters.proposalId}`,
          });
        }

        case "getBulkEditProposal": {
          const proposal = getProposal(parameters.proposalId);
          if (!proposal) {
            return NextResponse.json(
              { error: `Proposal ${parameters.proposalId} not found` },
              { status: 404 }
            );
          }
          return NextResponse.json({
            ...proposal,
            summary: formatProposalSummary(proposal),
          });
        }

        case "listPendingBulkEdits": {
          const pending = listPendingProposals();
          return NextResponse.json({
            count: pending.length,
            proposals: pending.map((p) => ({
              id: p.id,
              createdAt: p.createdAt,
              editDescription: p.editDescription,
              totalChanges: p.totalChanges,
              status: p.status,
            })),
          });
        }

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
        // Search tools
        {
          name: "searchLineBuilds",
          description:
            "Search line builds by menu item name, ID, or other text. Returns matching builds with their details.",
          parameters: {
            query: {
              type: "string",
              description:
                "Search query for menu item name, ID, or build ID (supports partial matches)",
            },
          },
        },
        {
          name: "filterByStatus",
          description:
            "Filter line builds by their current status (draft or active).",
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
          description:
            "Filter line builds containing a specific cooking action type.",
          parameters: {
            actionType: {
              type: "string",
              enum: [
                "PREP",
                "HEAT",
                "TRANSFER",
                "ASSEMBLE",
                "PORTION",
                "PLATE",
                "FINISH",
                "QUALITY_CHECK",
              ],
              description:
                "Action type to filter by: PREP, HEAT, TRANSFER, ASSEMBLE, PORTION, PLATE, FINISH, or QUALITY_CHECK",
            },
          },
        },
        {
          name: "filterByPhase",
          description:
            "Filter line builds containing a specific cooking phase.",
          parameters: {
            phase: {
              type: "string",
              enum: ["PRE_COOK", "COOK", "POST_COOK", "ASSEMBLY", "PASS"],
              description:
                "Cooking phase to filter by: PRE_COOK, COOK, POST_COOK, ASSEMBLY, or PASS",
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
        // Bulk edit tools
        {
          name: "findStepsMatchingCriteria",
          description:
            "Find steps across all line builds matching specific criteria. Use this to discover steps that might need bulk editing. Returns a list of matching steps with their build context.",
          parameters: {
            equipment: {
              type: "string",
              description:
                "Find steps using this equipment (partial match, e.g., 'fryer', 'waterbath')",
              required: false,
            },
            actionType: {
              type: "string",
              enum: [
                "PREP",
                "HEAT",
                "TRANSFER",
                "ASSEMBLE",
                "PORTION",
                "PLATE",
                "FINISH",
                "QUALITY_CHECK",
              ],
              description: "Find steps with this action type",
              required: false,
            },
            timeGreaterThanMinutes: {
              type: "number",
              description:
                "Find steps with time greater than this many minutes",
              required: false,
            },
            timeLessThanMinutes: {
              type: "number",
              description: "Find steps with time less than this many minutes",
              required: false,
            },
            phase: {
              type: "string",
              enum: ["PRE_COOK", "COOK", "POST_COOK", "ASSEMBLY", "PASS"],
              description: "Find steps in this phase",
              required: false,
            },
            targetName: {
              type: "string",
              description:
                "Find steps targeting items with this name (partial match)",
              required: false,
            },
            station: {
              type: "string",
              description: "Find steps at this station (partial match)",
              required: false,
            },
            draftOnly: {
              type: "boolean",
              description: "Only search draft builds (default: true)",
              required: false,
            },
          },
        },
        {
          name: "proposeBulkEdit",
          description:
            "Propose a bulk edit for steps matching criteria. Creates a preview of changes WITHOUT applying them. The user must confirm before changes are applied.",
          parameters: {
            equipment: {
              type: "string",
              description: "Match steps using this equipment",
              required: false,
            },
            actionType: {
              type: "string",
              enum: [
                "PREP",
                "HEAT",
                "TRANSFER",
                "ASSEMBLE",
                "PORTION",
                "PLATE",
                "FINISH",
                "QUALITY_CHECK",
              ],
              description: "Match steps with this action type",
              required: false,
            },
            timeGreaterThanMinutes: {
              type: "number",
              description: "Match steps with time greater than this",
              required: false,
            },
            phase: {
              type: "string",
              enum: ["PRE_COOK", "COOK", "POST_COOK", "ASSEMBLY", "PASS"],
              description: "Match steps in this phase",
              required: false,
            },
            targetName: {
              type: "string",
              description: "Match steps targeting items with this name",
              required: false,
            },
            editType: {
              type: "string",
              enum: [
                "updateEquipment",
                "updateTime",
                "updateStation",
                "updatePhase",
                "updateTargetName",
              ],
              description: "Type of edit to perform",
              required: true,
            },
            newEquipment: {
              type: "string",
              description: "New equipment value (for updateEquipment)",
              required: false,
            },
            newStation: {
              type: "string",
              description: "New station value (for updateStation)",
              required: false,
            },
            newPhase: {
              type: "string",
              enum: ["PRE_COOK", "COOK", "POST_COOK", "ASSEMBLY", "PASS"],
              description: "New phase value (for updatePhase)",
              required: false,
            },
            newTargetName: {
              type: "string",
              description: "New target name (for updateTargetName)",
              required: false,
            },
            newTimeMinutes: {
              type: "number",
              description: "New time in minutes (for updateTime)",
              required: false,
            },
            newTimeType: {
              type: "string",
              enum: ["active", "passive"],
              description: "Time type: active or passive (for updateTime)",
              required: false,
            },
          },
        },
        {
          name: "applyBulkEdit",
          description:
            "Apply a previously proposed bulk edit. This actually modifies the line builds and records changes in the changelog. Requires user confirmation.",
          parameters: {
            proposalId: {
              type: "string",
              description: "ID of the proposal to apply",
              required: true,
            },
            confirmed: {
              type: "boolean",
              description: "User has confirmed they want to apply this edit",
              required: true,
            },
          },
        },
        {
          name: "cancelBulkEditProposal",
          description:
            "Cancel a pending bulk edit proposal without applying it.",
          parameters: {
            proposalId: {
              type: "string",
              description: "ID of the proposal to cancel",
              required: true,
            },
          },
        },
        {
          name: "getBulkEditProposal",
          description:
            "Get detailed information about a specific bulk edit proposal.",
          parameters: {
            proposalId: {
              type: "string",
              description: "ID of the proposal to retrieve",
              required: true,
            },
          },
        },
        {
          name: "listPendingBulkEdits",
          description:
            "List all pending bulk edit proposals that have not been applied yet.",
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
