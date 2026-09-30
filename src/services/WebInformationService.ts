export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ExtractedInformation {
  success: boolean;
  facts: string[];
  sources: SearchResult[];
  error?: string;
}

export interface WebInformationService {
  search(query: string): Promise<{ success: boolean; results?: SearchResult[]; error?: string }>;
  extract(query: string, sources: SearchResult[]): Promise<ExtractedInformation>;
}

export class DefaultWebInformationService implements WebInformationService {
  public async search(_query: string): Promise<{ success: boolean; results?: SearchResult[]; error?: string }> {
    // If we had a real API key (e.g., process.env.SERP_API_KEY), we'd use it here.
    // For now, fail cleanly.
    return {
      success: false,
      error: 'Web search API is not configured or unavailable.',
    };
  }

  public async extract(_query: string, sources: SearchResult[]): Promise<ExtractedInformation> {
    if (!sources || sources.length === 0) {
      return {
        success: false,
        facts: [],
        sources: [],
        error: 'No sources provided to extract information from.',
      };
    }

    // In a real implementation, this would pass the sources to an LLM or extraction engine to summarize.
    // Since we don't have an active LLM for extraction here by default, fail safely if unmocked.
    return {
      success: false,
      facts: [],
      sources,
      error: 'Information extraction engine is not configured.',
    };
  }
}

export const webInformationService = new DefaultWebInformationService();
