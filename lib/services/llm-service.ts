import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set");
}

const ai = new GoogleGenAI({ apiKey });

export class LLMService {
  private modelName: string;

  constructor(modelName: string = "gemini-2.5-flash") {
    this.modelName = modelName;
  }

  async call(prompt: string, system: string = "", jsonMode: boolean = false): Promise<string> {
    const config: any = {};
    if (jsonMode) {
      config.responseMimeType = "application/json";
    }
    if (system) {
      config.systemInstruction = system;
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: this.modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: config,
    });

    return response.text || "";
  }

  async *stream(prompt: string, system: string = ""): AsyncGenerator<string> {
    const config: any = {};
    if (system) {
      config.systemInstruction = system;
    }

    const response = await ai.models.generateContentStream({
      model: this.modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: config,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  }
}

export const llm = new LLMService();
