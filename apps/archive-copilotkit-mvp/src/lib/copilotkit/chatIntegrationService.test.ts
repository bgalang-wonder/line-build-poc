/**
 * ChatIntegrationService Tests
 *
 * Tests for natural language interpretation and WorkUnit extraction
 * Note: These are unit tests for the message parsing logic only.
 * Integration tests with actual Vertex AI require env setup.
 */

import { ChatIntegrationService } from './chatIntegrationService';
import { LineBuild } from '@/lib/model/types';

// Mock VertexAI client to avoid ESM import issues in Jest
const mockGenerateContent = jest.fn();

class MockVertexAIClient {
  async generateContent(prompt: string, systemInstruction?: string): Promise<string> {
    return mockGenerateContent(prompt, systemInstruction);
  }
}

describe('ChatIntegrationService', () => {
  let service: ChatIntegrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockVertexAI = new MockVertexAIClient();
    service = new ChatIntegrationService(mockVertexAI as any);
  });

  describe('generateAssistantMessage', () => {
    it('should generate a summary for high confidence interpretations', () => {
      const interpretation = {
        conversationContext: 'Chef wants to prep and cook chicken',
        suggestedActions: [
          {
            index: 0,
            action: 'add' as const,
            workUnit: {
              tags: {
                action: 'PREP',
                target: { name: 'chicken breast', bomId: null },
              },
            },
            reasoning: 'Chef mentioned prepping chicken',
          },
        ],
        clarifications: undefined,
        confidence: 'high' as const,
      };

      const response = service.generateAssistantMessage(interpretation);

      expect(response).toBeDefined();
      expect(response).toContain('suggesting');
      expect(response).toContain('1');
    });

    it('should handle low confidence with clarifications', () => {
      const lowConfInterpretation = {
        conversationContext: 'Unclear message',
        suggestedActions: [],
        clarifications: ['Could you provide more details?'],
        confidence: 'low' as const,
      };

      const response = service.generateAssistantMessage(lowConfInterpretation);

      expect(response).toContain('Could you provide more details?');
    });

    it('should list multiple suggested actions', () => {
      const interpretation = {
        conversationContext: 'Prep and cook',
        suggestedActions: [
          {
            index: 0,
            action: 'add' as const,
            workUnit: { tags: { action: 'PREP', target: { name: 'item' } } },
            reasoning: 'Prep step',
          },
          {
            index: 1,
            action: 'add' as const,
            workUnit: { tags: { action: 'HEAT', target: { name: 'item' } } },
            reasoning: 'Heat step',
          },
        ],
        confidence: 'high' as const,
      };

      const response = service.generateAssistantMessage(interpretation);

      expect(response).toContain('2');
      expect(response).toContain('Add');
    });

    it('should include clarifications when present', () => {
      const interpretation = {
        conversationContext: 'Medium confidence',
        suggestedActions: [
          {
            index: 0,
            action: 'add' as const,
            workUnit: { tags: { action: 'PREP', target: { name: 'item' } } },
            reasoning: 'Prep step',
          },
        ],
        clarifications: ['Is this 5 minutes or 5 seconds?', 'Which waterbath?'],
        confidence: 'medium' as const,
      };

      const response = service.generateAssistantMessage(interpretation);

      expect(response).toContain('clarify');
      expect(response).toContain('Is this 5 minutes or 5 seconds?');
      expect(response).toContain('Which waterbath?');
    });
  });

  describe('setContext', () => {
    it('should accept a LineBuild context', () => {
      const mockBuild: LineBuild = {
        id: '123',
        menuItemId: 'item-1',
        menuItemName: 'Chicken Dish',
        workUnits: [
          {
            id: '1',
            tags: {
              action: 'PREP',
              target: { name: 'chicken', bomId: null },
            },
            dependsOn: [],
          },
        ],
        metadata: {
          author: 'test',
          version: 1,
          status: 'draft',
        },
      };

      expect(() => service.setContext(mockBuild)).not.toThrow();
    });

    it('should handle empty work units', () => {
      const mockBuild: LineBuild = {
        id: '456',
        menuItemId: 'item-2',
        menuItemName: 'Empty Build',
        workUnits: [],
        metadata: {
          author: 'test',
          version: 1,
          status: 'draft',
        },
      };

      expect(() => service.setContext(mockBuild)).not.toThrow();
    });
  });

  describe('interpretMessage', () => {
    it('should handle API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.interpretMessage('test message');

      expect(result.confidence).toEqual('low');
      expect(result.clarifications?.length).toBeGreaterThan(0);
      expect(result.suggestedActions.length).toEqual(0);
    });

    it('should handle invalid JSON responses', async () => {
      mockGenerateContent.mockResolvedValueOnce('This is not JSON at all');

      const result = await service.interpretMessage('test message');

      expect(result.confidence).toEqual('low');
      expect(result.suggestedActions.length).toEqual(0);
    });

    it('should handle valid JSON responses', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        JSON.stringify({
          conversationContext: 'Chef wants to prep chicken',
          suggestedActions: [
            {
              index: 0,
              action: 'add',
              workUnit: {
                tags: {
                  action: 'PREP',
                  target: { name: 'chicken', bomId: null },
                },
                dependsOn: [],
              },
              reasoning: 'Chef mentioned prepping',
            },
          ],
          confidence: 'high',
        })
      );

      const result = await service.interpretMessage('Prep chicken');

      expect(result.confidence).toEqual('high');
      expect(result.suggestedActions.length).toEqual(1);
      expect(result.suggestedActions[0].action).toEqual('add');
    });

    it('should filter malformed actions', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        JSON.stringify({
          conversationContext: 'Test',
          suggestedActions: [
            {
              index: 0,
              action: 'invalid_action',
              // Missing required workUnit for 'add'
            },
            {
              index: 1,
              action: 'add',
              workUnit: { tags: { action: 'PREP', target: { name: 'item' } } },
            },
          ],
          confidence: 'high',
        })
      );

      const result = await service.interpretMessage('test');

      // Only the valid action should be included
      expect(result.suggestedActions.length).toEqual(1);
      expect(result.suggestedActions[0].action).toEqual('add');
    });

    it('should handle complex nested JSON', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        JSON.stringify({
          conversationContext: 'Complex workflow',
          suggestedActions: [
            {
              index: 0,
              action: 'add',
              workUnit: {
                tags: {
                  action: 'PREP',
                  target: { name: 'chicken breast', bomId: '40-12345' },
                  equipment: 'cutting_board',
                  time: { value: 3, unit: 'min', type: 'active' },
                  phase: 'PRE_COOK',
                },
                dependsOn: [],
              },
              reasoning: 'Initial prep step',
            },
            {
              index: 1,
              action: 'add',
              workUnit: {
                tags: {
                  action: 'HEAT',
                  target: { name: 'chicken breast', bomId: '40-12345' },
                  equipment: 'waterbath',
                  time: { value: 5, unit: 'min', type: 'active' },
                  phase: 'COOK',
                },
                dependsOn: [0],
              },
              reasoning: 'Heat after prep',
            },
          ],
          clarifications: ['Verify waterbath temperature'],
          confidence: 'high',
        })
      );

      const result = await service.interpretMessage('Prep chicken then heat');

      expect(result.suggestedActions.length).toEqual(2);
      expect(result.suggestedActions[1].workUnit?.dependsOn).toContain(0);
      expect(result.clarifications).toContain('Verify waterbath temperature');
    });
  });
});
