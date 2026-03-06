import { LLMService } from '../services/llm-service';

export abstract class BaseAgent {
  protected llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  abstract run(...args: unknown[]): Promise<unknown>;
}
