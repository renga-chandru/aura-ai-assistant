/**
 * Central Allowlist Web Registry (Phase 19)
 * Maps common website names and aliases to verified canonical HTTPS URLs and search endpoints.
 */

export interface WebRegistryEntry {
  name: string;
  aliases: string[];
  url: string;
  searchUrl?: string;
  description?: string;
}

export const WEB_REGISTRY: WebRegistryEntry[] = [
  {
    name: 'YouTube',
    aliases: ['youtube', 'yt'],
    url: 'https://www.youtube.com',
    searchUrl: 'https://www.youtube.com/results?search_query=',
    description: 'YouTube Video Streaming',
  },
  {
    name: 'Google',
    aliases: ['google'],
    url: 'https://www.google.com',
    searchUrl: 'https://www.google.com/search?q=',
    description: 'Google Search Engine',
  },
  {
    name: 'GitHub',
    aliases: ['github', 'gh'],
    url: 'https://github.com',
    searchUrl: 'https://github.com/search?q=',
    description: 'GitHub Software Development Platform',
  },
  {
    name: 'ChatGPT',
    aliases: ['chatgpt', 'openai'],
    url: 'https://chatgpt.com',
    description: 'OpenAI ChatGPT',
  },
  {
    name: 'Gmail',
    aliases: ['gmail', 'google mail'],
    url: 'https://mail.google.com',
    description: 'Google Mail',
  },
  {
    name: 'LinkedIn',
    aliases: ['linkedin'],
    url: 'https://www.linkedin.com',
    description: 'LinkedIn Professional Network',
  },
  {
    name: 'Google Drive',
    aliases: ['google drive', 'drive', 'gdrive'],
    url: 'https://drive.google.com',
    description: 'Google Drive Cloud Storage',
  },
  {
    name: 'Reddit',
    aliases: ['reddit'],
    url: 'https://www.reddit.com',
    searchUrl: 'https://www.reddit.com/search/?q=',
    description: 'Reddit Social Network',
  },
  {
    name: 'Wikipedia',
    aliases: ['wikipedia', 'wiki'],
    url: 'https://www.wikipedia.org',
    searchUrl: 'https://en.wikipedia.org/wiki/Special:Search?search=',
    description: 'Wikipedia Online Encyclopedia',
  },
  {
    name: 'X',
    aliases: ['twitter', 'x', 'x.com'],
    url: 'https://x.com',
    searchUrl: 'https://x.com/search?q=',
    description: 'X (formerly Twitter)',
  },
];

/**
 * Resolves a natural-language website name or alias against the central web registry.
 */
export function resolveWebsite(nameOrAlias: string): WebRegistryEntry | undefined {
  if (!nameOrAlias) return undefined;
  const normalized = nameOrAlias.trim().toLowerCase().replace(/\/$/, '');

  return WEB_REGISTRY.find((entry) => {
    if (entry.name.toLowerCase() === normalized) return true;
    if (entry.url.toLowerCase().replace(/\/$/, '') === normalized) return true;
    return entry.aliases.some((alias) => alias.toLowerCase() === normalized);
  });
}

/**
 * Checks whether a target is a registered website name or alias.
 */
export function isWebsiteName(nameOrAlias: string): boolean {
  return resolveWebsite(nameOrAlias) !== undefined;
}
