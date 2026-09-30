/**
 * Local Bridge AI Provider (Phase 25)
 *
 * Connects to the local server-side desktop bridge endpoint (/api/ai/chat).
 * Security guarantee: API keys are strictly stored on the server side and
 * never passed to or exposed in the client browser.
 */

import { IAIProvider, AIProviderRequest, AIProviderResponse } from '../types';

export class LocalBridgeProvider implements IAIProvider {
  public readonly name = 'LocalBridgeProvider';
  private endpoint = '/api/ai/chat';
  private healthEndpoint = '/api/ai/health';

  constructor(endpoint?: string) {
    if (endpoint) {
      this.endpoint = endpoint;
    }
  }

  public async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' && typeof fetch === 'undefined') {
      return false;
    }

    try {
      const res = await fetch(this.healthEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.available;
    } catch {
      return false;
    }
  }

  public async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs || 15000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          contextHistory: request.contextHistory,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `AI Bridge returned error ${response.status}: ${errorText.slice(0, 100)}`,
          provider: 'LocalBridge',
          model: 'bridge',
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      return {
        success: true,
        content: data.content || (data.rawStructured ? JSON.stringify(data.rawStructured) : ''),
        rawStructured: data.rawStructured,
        provider: data.provider || 'LocalBridge',
        model: data.model || 'unknown',
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        error: isAbort ? 'AI Provider request timed out.' : 'Failed to reach AI bridge.',
        provider: 'LocalBridge',
        model: 'bridge',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
