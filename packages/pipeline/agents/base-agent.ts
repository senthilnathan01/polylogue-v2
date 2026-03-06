import { LLMProvider } from '@/packages/core/providers';

export abstract class BaseAgent {
  protected llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  abstract run(...args: unknown[]): Promise<unknown>;
}
