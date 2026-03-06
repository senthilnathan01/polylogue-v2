import { GeminiLlmProvider } from '@/lib/providers/gemini-llm-provider';

export { GeminiLlmProvider as LLMService };

export const llm = new GeminiLlmProvider();
