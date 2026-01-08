/**
 * ChatIntegrationService
 *
 * Handles integration between chat messages and CopilotKit form actions.
 * Transforms natural language from chat into structured WorkUnit data.
 *
 * Workflow:
 * 1. User sends chat message (free-form chef notes)
 * 2. Service calls Vertex AI to interpret the message
 * 3. AI generates structured JSON with WorkUnit candidates
 * 4. Service validates and extracts WorkUnits
 * 5. Form actions add/edit/remove units as needed
 * 6. Chat history is preserved in LineBuild.sourceConversations
 */

import { WorkUnit, LineBuild } from '@/lib/model/types';
import { VertexAIClient, createVertexAIClient } from '@/lib/ai/vertex/client';

export interface ChatInterpretation {
  conversationContext: string; // Summary of what was discussed
  suggestedActions: WorkUnitSuggestion[];
  clarifications?: string[]; // Ask user for more info if ambiguous
  confidence: 'high' | 'medium' | 'low';
}

export interface WorkUnitSuggestion {
  index: number;
  action: 'add' | 'edit' | 'remove'; // What to do with this unit
  workUnit?: Partial<WorkUnit>; // Data for add/edit
  unitIdToModify?: string; // For edit/remove operations
  reasoning: string; // Explain why this unit was suggested
}

/**
 * System prompt for chat interpretation
 * Guides the LLM to extract structured WorkUnits from chef notes
 */
const CHAT_INTERPRETATION_SYSTEM_PROMPT = `You are a line build system that interprets natural language from chefs into structured work units.

Your job is to parse chef notes and convert them into JSON-structured WorkUnits that can be executed.

ActionTypes available: PREP, HEAT, TRANSFER, ASSEMBLE, PORTION, PLATE, FINISH, QUALITY_CHECK

For each work unit, extract:
- action: What operation? (e.g., PREP, HEAT, TRANSFER)
- target: What item? (can be a name, system will link to BOM)
- equipment: What equipment? (e.g., waterbath, fryer, turbo)
- time: How long? (e.g., "5 min" → { value: 5, unit: "min", type: "active" })
- phase: When in the process? (PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS)
- dependencies: What must happen before this? (by index, e.g., [0] means after step 0)

Return JSON with this structure:
{
  "conversationContext": "Brief summary of what the user described",
  "suggestedActions": [
    {
      "index": 0,
      "action": "add",
      "workUnit": {
        "tags": {
          "action": "PREP",
          "target": { "name": "chicken breast", "bomId": null },
          "equipment": "cutting_board",
          "time": { "value": 3, "unit": "min", "type": "active" },
          "phase": "PRE_COOK"
        },
        "dependsOn": []
      },
      "reasoning": "Chef mentioned prepping chicken breast"
    }
  ],
  "clarifications": null,
  "confidence": "high"
}

IMPORTANT:
- Return ONLY valid JSON, no markdown, no extra text
- If you're unsure about an action, set confidence to "medium" and add clarifications
- If the input is too ambiguous, set confidence to "low" and ask clarifying questions
- dependsOn should be an array of indices (0-based) referencing earlier work units
- For time: use "active" for hands-on work, "passive" for waiting/cooking
`;

export class ChatIntegrationService {
  private vertexAI: VertexAIClient;
  private currentBuild: LineBuild | null = null;

  constructor(vertexAI?: VertexAIClient) {
    this.vertexAI = vertexAI || createVertexAIClient();
  }

  /**
   * Set the current build context for the chat session
   * Used to validate dependencies and extract work unit info
   */
  setContext(build: LineBuild): void {
    this.currentBuild = build;
  }

  /**
   * Process a chat message and convert to structured work units
   * Returns suggested actions that can be applied to the build
   */
  async interpretMessage(userMessage: string): Promise<ChatInterpretation> {
    try {
      const prompt = this.buildPrompt(userMessage);
      const response = await this.vertexAI.generateContent(
        prompt,
        CHAT_INTERPRETATION_SYSTEM_PROMPT
      );

      // Parse the JSON response
      const interpretation = this.parseResponse(response);
      return interpretation;
    } catch (error) {
      console.error('[ChatIntegrationService] Error interpreting message:', error);
      return {
        conversationContext: `Error processing: ${userMessage}`,
        suggestedActions: [],
        clarifications: ['Could not understand. Please rephrase.'],
        confidence: 'low',
      };
    }
  }

  /**
   * Build the prompt with current build context
   */
  private buildPrompt(userMessage: string): string {
    let prompt = `User message: "${userMessage}"\n\n`;

    if (this.currentBuild && this.currentBuild.workUnits.length > 0) {
      prompt += `Current build has ${this.currentBuild.workUnits.length} work units:\n`;
      this.currentBuild.workUnits.forEach((unit, idx) => {
        const action = unit.tags?.action || 'UNKNOWN';
        const target = unit.tags?.target?.name || 'unknown item';
        prompt += `  [${idx}] ${action} ${target}\n`;
      });
      prompt += '\n';
    }

    prompt += 'Interpret the message and suggest work units to add/edit/remove.\n';
    prompt += 'Return ONLY JSON, no additional text.';

    return prompt;
  }

  /**
   * Parse the LLM response and validate it's proper JSON
   */
  private parseResponse(response: string): ChatInterpretation {
    try {
      // Extract JSON from response (may have extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (
        !parsed.conversationContext ||
        !Array.isArray(parsed.suggestedActions) ||
        !['high', 'medium', 'low'].includes(parsed.confidence)
      ) {
        throw new Error('Invalid response structure');
      }

      // Validate each suggested action
      const validatedActions = parsed.suggestedActions
        .filter((action: any) => this.validateSuggestedAction(action))
        .map((action: any, idx: number) => ({
          index: idx,
          action: action.action, // add, edit, or remove
          workUnit: action.workUnit,
          unitIdToModify: action.unitIdToModify,
          reasoning: action.reasoning || 'System suggestion',
        }));

      return {
        conversationContext: parsed.conversationContext,
        suggestedActions: validatedActions,
        clarifications: parsed.clarifications,
        confidence: parsed.confidence,
      };
    } catch (error) {
      console.error('[ChatIntegrationService] Parse error:', error);
      return {
        conversationContext: 'Parse error',
        suggestedActions: [],
        clarifications: ['Could not parse response. Please try again.'],
        confidence: 'low',
      };
    }
  }

  /**
   * Validate a suggested action has required fields
   */
  private validateSuggestedAction(action: any): boolean {
    if (!action.action || !['add', 'edit', 'remove'].includes(action.action)) {
      return false;
    }

    if (action.action === 'add' && !action.workUnit) {
      return false;
    }

    if ((action.action === 'edit' || action.action === 'remove') && !action.unitIdToModify) {
      return false;
    }

    return true;
  }

  /**
   * Generate assistant response for chat display
   * Summarizes what was suggested to the user
   */
  generateAssistantMessage(interpretation: ChatInterpretation): string {
    if (interpretation.confidence === 'low') {
      const clarification =
        interpretation.clarifications?.[0] || 'I need more information to understand your request.';
      return `${clarification}\n\nCould you provide more details?`;
    }

    const actionSummary = interpretation.suggestedActions
      .map((action) => {
        if (action.action === 'add') {
          const target = action.workUnit?.tags?.target?.name || 'item';
          const actionType = action.workUnit?.tags?.action || 'action';
          return `• Add: ${actionType} ${target}`;
        } else if (action.action === 'edit') {
          return `• Edit: Modify existing step`;
        } else {
          return `• Remove: Delete a step`;
        }
      })
      .join('\n');

    let message = `Got it! I'm suggesting:\n${actionSummary}`;

    if (interpretation.clarifications && interpretation.clarifications.length > 0) {
      message += `\n\nA few things to clarify:\n`;
      message += interpretation.clarifications.map((c) => `• ${c}`).join('\n');
    }

    return message;
  }
}

/**
 * Singleton instance
 */
let chatServiceInstance: ChatIntegrationService | null = null;

export function getChatIntegrationService(): ChatIntegrationService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatIntegrationService();
  }
  return chatServiceInstance;
}
