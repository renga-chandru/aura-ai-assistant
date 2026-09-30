/**
 * AURA Semantic Entity Extractor (Phase 24)
 *
 * Extracts domain entities (apps, queries, URLs, files, folders, settings, math)
 * from normalized natural language, mapping natural aliases to allowlisted targets.
 */

import { resolveWebsite } from '../execution/webRegistry';
import { resolveApprovedDirectory } from '../execution/FilePathResolver';
import { resolveSystemSetting } from '../execution/systemActionRegistry';

// Semantic App Alias Dictionary mapped to allowlisted system applications
const APP_ALIAS_MAP: Record<string, string> = {
  // Browsers
  browser: 'Google Chrome',
  'the browser': 'Google Chrome',
  'web browser': 'Google Chrome',
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  safari: 'Safari',
  'apple browser': 'Safari',
  firefox: 'Firefox',

  // Code Editors
  'code editor': 'Visual Studio Code',
  'the code editor': 'Visual Studio Code',
  editor: 'Visual Studio Code',
  vscode: 'VS Code',
  'vs code': 'VS Code',
  'visual studio code': 'Visual Studio Code',
  code: 'VS Code',

  // System & Utilities
  finder: 'Finder',
  'file manager': 'Finder',
  'the file manager': 'Finder',
  calculator: 'Calculator',
  calc: 'Calculator',
  terminal: 'Terminal',
  'command line': 'Terminal',
  console: 'Terminal',
  'the console': 'Terminal',

  // Productivity
  notes: 'Notes',
  'apple notes': 'Notes',
  notepad: 'Notes',
  slack: 'Slack',
  spotify: 'Spotify',
  music: 'Apple Music',
  'apple music': 'Apple Music',
  photos: 'Photos',
  calendar: 'Calendar',
  reminders: 'Reminders',
  mail: 'Mail',
  email: 'Mail',
  messages: 'Messages',
  imessage: 'Messages',
  settings: 'System Settings',
  'system settings': 'System Settings',
  'system preferences': 'System Settings',
  preferences: 'System Settings',
};

const APPROVED_FOLDERS = [
  'downloads',
  'documents',
  'desktop',
  'pictures',
  'movies',
  'music',
  'applications',
  'library',
  'home',
];

export class EntityExtractor {
  /**
   * Resolves an app alias or name to an allowlisted application name
   */
  public static resolveApp(candidate: string): string | null {
    const lower = candidate.trim().toLowerCase();
    // Check exact alias
    if (APP_ALIAS_MAP[lower]) {
      return APP_ALIAS_MAP[lower];
    }
    // Check stripped "the"
    const strippedThe = lower.replace(/^the\s+/, '');
    if (APP_ALIAS_MAP[strippedThe]) {
      return APP_ALIAS_MAP[strippedThe];
    }
    return null;
  }

  /**
   * Resolves a folder candidate to an approved directory name
   */
  public static resolveFolder(candidate: string): string | null {
    const clean = candidate.trim().toLowerCase().replace(/^my\s+/, '').replace(/\s+folder$/, '');
    const resolved = resolveApprovedDirectory(clean);
    if (resolved) return resolved;
    if (APPROVED_FOLDERS.includes(clean)) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return null;
  }

  /**
   * Resolves website name or domain to URL
   */
  public static resolveUrl(candidate: string): string | null {
    const clean = candidate.trim();
    const webEntry = resolveWebsite(clean);
    if (webEntry) return webEntry.url;

    // Direct URL check
    if (/^https?:\/\//i.test(clean)) return clean;
    if (/^[a-z0-9-]+\.(com|org|net|io|edu|gov|dev|co|app)/i.test(clean)) {
      return `https://${clean}`;
    }
    return null;
  }

  /**
   * Resolves system setting action
   */
  public static resolveSetting(input: string): string | null {
    return resolveSystemSetting(input);
  }

  /**
   * Extracts clean web search query by stripping search carrier phrases
   */
  public static extractSearchQuery(text: string): string | null {
    let clean = text.trim();

    // Remove leading search verbs
    const searchPrefixes = [
      /^(?:search\s+for|search\s+the\s+web\s+for|search\s+web\s+for|search|look\s+up|look\s+for|find\s+me\s+some|find\s+me|find|google)\s+/i,
      /^(?:can\s+you\s+search\s+the\s+web\s+for|i\s+want\s+to\s+find\s+some|i\s+want\s+to\s+find)\s+/i,
    ];

    for (const prefix of searchPrefixes) {
      if (prefix.test(clean)) {
        clean = clean.replace(prefix, '').trim();
        break;
      }
    }

    // Strip "information about" or "info about" if leading
    clean = clean.replace(/^(?:information\s+about|info\s+about)\s+/i, '');

    // Strip trailing "online" or "on the web"
    clean = clean.replace(/\s+(?:online|on\s+the\s+web)$/i, '').trim();

    return clean.length > 0 ? clean : null;
  }
}

