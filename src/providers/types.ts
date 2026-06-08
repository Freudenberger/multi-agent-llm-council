/** LLM Provider abstraction */

export type GenerateInput = {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
};

export type GenerateOutput = {
  content: string;
  model: string;
};

export type LLMProvider = {
  generate(input: GenerateInput): Promise<GenerateOutput>;
};
