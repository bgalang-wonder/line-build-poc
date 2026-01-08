/**
 * Vertex AI Gemini Client Wrapper
 * Simplified version for line-build MVP (not CopilotKit-specific)
 */
import { GoogleGenAI } from "@google/genai";

export interface VertexAIConfig {
  project: string;
  location: string;
  model?: string;
}

export class VertexAIClient {
  private client: GoogleGenAI;
  private model: string;

  constructor(config: VertexAIConfig) {
    // The SDK will use GOOGLE_APPLICATION_CREDENTIALS automatically
    this.client = new GoogleGenAI({
      vertexai: true,
      project: config.project,
      location: config.location,
    });
    this.model = config.model || "gemini-2.5-flash";
  }

  /**
   * Generate content from a prompt
   */
  async generateContent(prompt: string, systemInstruction?: string): Promise<string> {
    try {
      const responseStream = await this.client.models.generateContentStream({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
        },
      });

      let fullText = "";

      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
        }
      }

      return fullText;
    } catch (error) {
      console.error("[VertexAIClient] Error generating content:", error);
      throw error;
    }
  }
}

/**
 * Create a Vertex AI client instance from environment variables
 */
export function createVertexAIClient(): VertexAIClient {
  const project = process.env.VERTEX_AI_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION || "us-central1";
  const model = process.env.VERTEX_AI_MODEL || "gemini-2.5-flash";

  if (!project) {
    throw new Error(
      "VERTEX_AI_PROJECT environment variable is required. Set GOOGLE_APPLICATION_CREDENTIALS for authentication."
    );
  }

  return new VertexAIClient({ project, location, model });
}
