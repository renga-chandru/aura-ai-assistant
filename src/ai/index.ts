import {
  IAiProvider,
  AiProviderConfig,
  AiMessage,
  AiStreamChunk,
  CommandIntent,
} from '@/types';

/**
 * Placeholder Abstract AI Provider Adapter
 * Future AI implementations flow through this IAiProvider adapter contract.
 */
export class MockAiProvider implements IAiProvider {
  public readonly config: AiProviderConfig = {
    providerId: 'mock-provider',
    displayName: 'AURA Cognitive Subsystem Stub',
    modelName: 'aura-v1-foundation',
  };

  public async initialize(_apiKey?: string): Promise<boolean> {
    return true;
  }

  public async generateResponse(_messages: AiMessage[]): Promise<string> {
    return 'AURA Core Engine is running in Phase 1 mode.';
  }

  public async streamResponse(
    _messages: AiMessage[],
    onChunk: (chunk: AiStreamChunk) => void
  ): Promise<void> {
    onChunk({ delta: 'AURA Phase 1 Core Initialized.', done: true });
  }

  public async parseIntent(userInput: string): Promise<CommandIntent> {
    return {
      intentId: `intent-${Date.now()}`,
      rawUserInput: userInput,
      confidence: 1.0,
      extractedParameters: {},
    };
  }
}
