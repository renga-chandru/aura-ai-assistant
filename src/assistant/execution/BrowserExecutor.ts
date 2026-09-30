import { ParsedCommand } from '../commands/types';
import { ExecutionResult, IDesktopBridge } from './types';
import { resolveWebsite } from './webRegistry';
import { DesktopExecutionBridge } from './MacAppExecutor';
import { NovairPermissionGuard } from '../permissions';
import { webInformationService } from '../../services/WebInformationService';

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

/**
 * Validates and safely normalizes an input URL string.
 * Strictly blocks dangerous protocols (javascript:, file:, data:, vbscript:, blob:).
 * Only http: and https: protocols are permitted.
 */
export function validateAndNormalizeUrl(rawInput: string): UrlValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: 'Empty URL specified.' };
  }

  const lower = trimmed.toLowerCase();
  const dangerousProtocols = ['javascript:', 'file:', 'data:', 'vbscript:', 'blob:', 'about:'];
  for (const protocol of dangerousProtocols) {
    if (lower.startsWith(protocol)) {
      return {
        valid: false,
        error: `Dangerous protocol rejected: "${protocol}". Only HTTP and HTTPS are permitted.`,
      };
    }
  }

  let candidate = trimmed;
  // If protocol missing, default to https://
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^[a-z0-9+.-]+:/i.test(candidate)) {
      return {
        valid: false,
        error: 'Unsupported protocol. Only HTTP and HTTPS are permitted.',
      };
    }
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
      };
    }

    if (!parsed.hostname || parsed.hostname.length < 3) {
      return {
        valid: false,
        error: 'Invalid hostname in URL.',
      };
    }

    return {
      valid: true,
      normalizedUrl: parsed.href,
    };
  } catch {
    return {
      valid: false,
      error: 'Malformed URL structure.',
    };
  }
}

/**
 * Browser & Web Control Executor (Phase 19)
 * Controlled execution for OPEN_URL and WEB_SEARCH with strict URL validation,
 * registry alias resolution, and desktop bridge dispatch.
 */
export class BrowserExecutor {
  private bridge: IDesktopBridge;
  private permissionGuard: NovairPermissionGuard;

  constructor(bridge?: IDesktopBridge, permissionGuard?: NovairPermissionGuard) {
    this.bridge = bridge || new DesktopExecutionBridge();
    this.permissionGuard = permissionGuard || new NovairPermissionGuard();
  }

  public async openUrl(urlOrSite: string): Promise<ExecutionResult> {
    const startTime = performance.now();

    // 1. Check if website name or alias matches WEB_REGISTRY
    const webEntry = resolveWebsite(urlOrSite);
    const targetUrl = webEntry ? webEntry.url : urlOrSite;
    const displayName = webEntry ? webEntry.name : targetUrl;

    // 2. Validate URL strictly
    const validation = validateAndNormalizeUrl(targetUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      return {
        success: false,
        action: 'OPEN_URL',
        target: urlOrSite,
        message: `I couldn't open that URL: ${validation.error}`,
        errorCode: 'INVALID_URL',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // 3. Permission audit log
    this.permissionGuard.logAudit({
      requestId: `url-audit-${Date.now()}`,
      commandId: `cmd-url-${Date.now()}`,
      action: 'OPEN_URL',
      target: validation.normalizedUrl,
      granted: true,
      timestamp: new Date().toISOString(),
    });

    // 4. Verify desktop bridge availability
    const isAvailable = await this.bridge.isAvailable();
    if (!isAvailable) {
      return {
        success: false,
        action: 'OPEN_URL',
        target: displayName,
        message: 'Desktop browser control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // 5. Open URL via desktop bridge in user's default browser
    const res = await this.bridge.openUrl(validation.normalizedUrl);
    const duration = performance.now() - startTime;

    if (res.success) {
      return {
        success: true,
        action: 'OPEN_URL',
        target: displayName,
        message: `Opening ${displayName}.`,
        executionTimeMs: duration,
      };
    } else {
      return {
        success: false,
        action: 'OPEN_URL',
        target: displayName,
        message: `I couldn't open that URL: ${res.error || 'Execution failed.'}`,
        errorCode: res.error || 'EXECUTION_FAILED',
        executionTimeMs: duration,
      };
    }
  }

  public async searchWeb(query: string, providerName?: string): Promise<ExecutionResult> {
    const startTime = performance.now();
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return {
        success: false,
        action: 'WEB_SEARCH',
        message: 'No search query specified.',
        errorCode: 'EMPTY_QUERY',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // Determine search engine template from provider
    let searchUrl: string;
    let providerLabel = 'the web';

    const webEntry = providerName ? resolveWebsite(providerName) : undefined;
    if (webEntry?.searchUrl) {
      searchUrl = `${webEntry.searchUrl}${encodeURIComponent(cleanQuery)}`;
      providerLabel = webEntry.name;
    } else if (providerName?.toLowerCase().includes('youtube')) {
      searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
      providerLabel = 'YouTube';
    } else {
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
      providerLabel = 'the web';
    }

    // Validate constructed search URL
    const validation = validateAndNormalizeUrl(searchUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      return {
        success: false,
        action: 'WEB_SEARCH',
        query: cleanQuery,
        message: `Invalid search URL: ${validation.error}`,
        errorCode: 'INVALID_SEARCH_URL',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // Permission audit log
    this.permissionGuard.logAudit({
      requestId: `search-audit-${Date.now()}`,
      commandId: `cmd-search-${Date.now()}`,
      action: 'WEB_SEARCH',
      target: providerLabel,
      granted: true,
      timestamp: new Date().toISOString(),
    });

    // Verify desktop bridge availability
    const isAvailable = await this.bridge.isAvailable();
    if (!isAvailable) {
      return {
        success: false,
        action: 'WEB_SEARCH',
        query: cleanQuery,
        message: 'Desktop browser control is unavailable in this environment.',
        errorCode: 'BRIDGE_UNAVAILABLE',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // Open search results via desktop bridge
    const res = await this.bridge.openUrl(validation.normalizedUrl);
    const duration = performance.now() - startTime;

    if (res.success) {
      return {
        success: true,
        action: 'WEB_SEARCH',
        query: cleanQuery,
        target: providerLabel,
        message: `Searching ${providerLabel} for ${cleanQuery}.`,
        executionTimeMs: duration,
      };
    } else {
      return {
        success: false,
        action: 'WEB_SEARCH',
        query: cleanQuery,
        message: `I couldn't perform that search: ${res.error || 'Execution failed.'}`,
        errorCode: res.error || 'EXECUTION_FAILED',
        executionTimeMs: duration,
      };
    }
  }

  public async execute(command: ParsedCommand, context?: { previousSteps: any[] }): Promise<ExecutionResult> {
    if (command.type === 'OPEN_URL') {
      return await this.openUrl(command.target || command.originalInput);
    }

    if (command.type === 'WEB_SEARCH') {
      const query = command.query || command.target || '';
      const provider = command.query && command.target ? command.target : undefined;
      const res = await this.searchWeb(query, provider);
      
      // Attempt background information retrieval
      const searchData = await webInformationService.search(query);
      if (searchData.success && searchData.results) {
        res.data = searchData.results;
      } else {
        res.data = { __error: searchData.error || 'Network or API error during retrieval.' };
      }
      return res;
    }

    if (command.type === 'EXTRACT_INFO') {
      // Find the most recent successful WEB_SEARCH step
      const previousSearch = context?.previousSteps
        ?.slice()
        .reverse()
        .find(s => s.intent === 'WEB_SEARCH' && s.result?.success && s.result.data);

      if (!previousSearch || previousSearch.result.data.__error) {
        const errorMsg = previousSearch?.result.data?.__error || 'No web search results available to extract from.';
        return {
          success: false,
          action: 'EXTRACT_INFO',
          message: errorMsg,
          errorCode: 'NO_SOURCE_DATA',
        };
      }

      const sources = previousSearch.result.data;
      const query = previousSearch.command.query || previousSearch.command.target || '';
      
      const extractData = await webInformationService.extract(query, sources);
      
      if (extractData.success) {
         return {
            success: true,
            action: 'EXTRACT_INFO',
            data: extractData,
            message: 'Information extracted successfully.',
         };
      } else {
         return {
            success: false,
            action: 'EXTRACT_INFO',
            message: extractData.error || 'Failed to extract information from search results.',
            errorCode: 'EXTRACTION_FAILED',
         };
      }
    }

    return {
      success: false,
      action: command.type,
      message: `Action [${command.type}] is not a browser control action.`,
      errorCode: 'UNSUPPORTED_BROWSER_ACTION',
    };
  }
}

export const browserExecutor = new BrowserExecutor();
