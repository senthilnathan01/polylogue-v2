import { GenerateContentResponse, GoogleGenAI } from '@google/genai';

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  return apiKey;
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('```')) {
    const lines = trimmed.split('\n');
    const withoutFence = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined);
    return withoutFence.join('\n').trim();
  }

  const objectStart = trimmed.indexOf('{');
  const arrayStart = trimmed.indexOf('[');
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);

  if (start === -1) {
    return trimmed;
  }

  const objectEnd = trimmed.lastIndexOf('}');
  const arrayEnd = trimmed.lastIndexOf(']');
  const end = Math.max(objectEnd, arrayEnd);

  return end > start ? trimmed.slice(start, end + 1) : trimmed.slice(start);
}

export class LLMService {
  constructor(private readonly modelName: string = 'gemini-2.5-flash') {}

  private createClient(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: getApiKey() });
  }

  async call(
    prompt: string,
    system = '',
    options: { jsonMode?: boolean } = {},
  ): Promise<string> {
    const config: { responseMimeType?: string; systemInstruction?: string } = {};

    if (options.jsonMode) {
      config.responseMimeType = 'application/json';
    }

    if (system) {
      config.systemInstruction = system;
    }

    const response: GenerateContentResponse =
      await this.createClient().models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config,
      });

    return response.text?.trim() ?? '';
  }

  async callJson<T>(prompt: string, system = ''): Promise<T> {
    const response = await this.call(prompt, system, { jsonMode: true });

    try {
      return JSON.parse(extractJsonPayload(response)) as T;
    } catch (error) {
      console.error('Failed to parse JSON response from Gemini:', response);
      throw error;
    }
  }

  async *stream(prompt: string, system = ''): AsyncGenerator<string> {
    const config: { systemInstruction?: string } = {};

    if (system) {
      config.systemInstruction = system;
    }

    const stream = await this.createClient().models.generateContentStream({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }
}

export const llm = new LLMService();
