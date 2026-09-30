import { CommandActionType, DesktopRiskLevel, ParsedCommand } from './types';
import { resolveWebsite } from '../execution/webRegistry';
import { resolveApprovedDirectory } from '../execution/FilePathResolver';
import { resolveSystemSetting } from '../execution/systemActionRegistry';
import { SafeCalculator } from '../brain/SafeCalculator';

/**
 * Checks if input represents an affirmative confirmation for a pending high-risk action
 */
export function isConfirmationIntent(input: string): boolean {
  const clean = input.trim().toLowerCase().replace(/[!.?]+$/, '');
  return /^(yes|confirm|do it|proceed|sure|yep|yeah|ok|okay|restart|restart it|yes restart|shut down|shutdown|turn off|yes shut down|sleep|put to sleep|yes sleep)\b/i.test(
    clean
  );
}

/**
 * Checks if input represents a cancellation for a pending high-risk action
 */
export function isCancellationIntent(input: string): boolean {
  const clean = input.trim().toLowerCase().replace(/[!.?]+$/, '');
  return /^(no|cancel|don't do it|dont do it|never mind|nevermind|stop|abort|do not do it)\b/i.test(clean);
}

export interface INaturalLanguageCommandParser {
  parse(input: string): ParsedCommand;
}

/**
 * Common Application Name Mapping Dictionary
 */
const APP_NAME_MAP: Record<string, string> = {
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  browser: 'Google Chrome',
  'the browser': 'Google Chrome',
  'web browser': 'Google Chrome',
  safari: 'Safari',
  'apple browser': 'Safari',
  firefox: 'Firefox',
  vscode: 'VS Code',
  'vs code': 'VS Code',
  'visual studio code': 'Visual Studio Code',
  'code editor': 'Visual Studio Code',
  'the code editor': 'Visual Studio Code',
  code: 'VS Code',
  notes: 'Notes',
  finder: 'Finder',
  'file manager': 'Finder',
  'the file manager': 'Finder',
  terminal: 'Terminal',
  'command line': 'Terminal',
  console: 'Terminal',
  slack: 'Slack',
  spotify: 'Spotify',
  calculator: 'Calculator',
  calc: 'Calculator',
  mail: 'Mail',
  email: 'Mail',
  messages: 'Messages',
  imessage: 'Messages',
  settings: 'System Settings',
  'system settings': 'System Settings',
  'system preferences': 'System Settings',
  photos: 'Photos',
  calendar: 'Calendar',
  reminders: 'Reminders',
  music: 'Apple Music',
};

/**
 * Common Folder Name List
 */
const FOLDER_NAMES = ['downloads', 'documents', 'desktop', 'pictures', 'movies', 'music', 'applications', 'library', 'home'];

/**
 * Classifies risk level based on command action type (Phase 17 Requirement 8)
 */
export function getCommandRiskLevel(action: CommandActionType): DesktopRiskLevel {
  switch (action) {
    case 'DELETE_FILE':
    case 'SLEEP':
    case 'RESTART':
    case 'SHUTDOWN':
      return 'HIGH';

    case 'CLOSE_APP':
    case 'MOVE_FILE':
    case 'CREATE_FILE':
    case 'CREATE_FOLDER':
    case 'SYSTEM_SETTING':
      return 'MEDIUM';

    case 'OPEN_APP':
    case 'OPEN_URL':
    case 'WEB_SEARCH':
    case 'EXTRACT_INFO':
    case 'OPEN_FILE':
    case 'OPEN_FOLDER':
    case 'CALCULATE':
    case 'UNKNOWN':
    default:
      return 'LOW';
  }
}

/**
 * Local Deterministic Natural Language Command Parser (Phase 17)
 * Normalizes input, strips polite filler phrases, matches command patterns, and extracts structured intent.
 * Designed behind INaturalLanguageCommandParser interface for future AI provider compatibility.
 */
export class LocalNaturalLanguageCommandParser implements INaturalLanguageCommandParser {
  /**
   * Safely normalize user input string while preserving meaningful target casing
   */
  public normalize(input: string): string {
    let clean = input.trim();
    // Strip trailing punctuation
    clean = clean.replace(/[?.!]+$/g, '').trim();

    // Strip polite leading conversational fillers (case insensitive)
    const politePrefixes = [
      /^(can you please|could you please|would you please),?\s+/i,
      /^(can you|could you|would you),?\s+/i,
      /^(please|hey aura|aura|hey novair|novair|i want to|i need to),?\s+/i,
      /^(show me|bring up|display),?\s+/i,
    ];

    for (const prefix of politePrefixes) {
      if (prefix.test(clean)) {
        clean = clean.replace(prefix, '').trim();
      }
    }

    // Strip trailing conversational fillers
    clean = clean.replace(/\s+for\s+me$/i, '').trim();
    clean = clean.replace(/\s+please$/i, '').trim();

    return clean;
  }

  public parse(rawInput: string): ParsedCommand {
    const originalInput = rawInput.trim();
    if (!originalInput) {
      return {
        type: 'UNKNOWN',
        originalInput: rawInput,
        normalizedInput: '',
        confidence: 0,
        risk: 'LOW',
      };
    }

    const normalized = this.normalize(originalInput);
    const lower = normalized.toLowerCase();

    // Security Guard: Arbitrary system commands (sudo, defaults, launchctl, killall, shell scripts) are strictly prohibited
    if (
      /^(sudo|defaults|killall|launchctl|chmod|chown|osascript|eval|exec)\b/i.test(lower) ||
      /^(?:run|execute)\s+(sudo|defaults|killall|launchctl|chmod|chown|osascript|sh|bash|zsh)/i.test(lower)
    ) {
      return {
        type: 'UNKNOWN',
        originalInput: rawInput,
        normalizedInput: normalized,
        confidence: 0,
        risk: 'HIGH',
      };
    }

    // 1. SHUTDOWN Command
    if (/^(shut\s*down|power\s*off|turn\s*off)\b/i.test(lower)) {
      return {
        type: 'SHUTDOWN',
        target: 'System',
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('SHUTDOWN'),
      };
    }

    // 2. RESTART Command
    if (/^(restart|reboot)\b/i.test(lower)) {
      return {
        type: 'RESTART',
        target: 'System',
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('RESTART'),
      };
    }

    // 3. SLEEP Command
    if (/^(sleep|put\s+(?:my\s+)?(?:mac|computer)\s+to\s+sleep)\b/i.test(lower)) {
      return {
        type: 'SLEEP',
        target: 'System',
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('SLEEP'),
      };
    }

    // 4. WEB SEARCH Commands
    // Example: "Search YouTube for React tutorials"
    const searchForMatch = normalized.match(/^search\s+([a-z0-9\s]+?)\s+for\s+(.+)$/i);
    if (searchForMatch) {
      const searchTarget = searchForMatch[1].trim();
      const searchQuery = searchForMatch[2].trim();
      const website = resolveWebsite(searchTarget);
      return {
        type: 'WEB_SEARCH',
        target: website ? website.name : this.capitalizeWord(searchTarget),
        query: searchQuery,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('WEB_SEARCH'),
      };
    }

    // Example: "Google weather" or "Search the web for React tutorials" or "look up React tutorials" or "find React tutorials online"
    const googleMatch = normalized.match(
      /^(google|search\s+the\s+web\s+for|search\s+web\s+for|search\s+for|search|look\s+up|look\s+for|find\s+me\s+some|find\s+me|find)\s+(.+)$/i
    );
    if (googleMatch) {
      const enginePrefix = googleMatch[1].toLowerCase();
      let searchQuery = googleMatch[2].trim();
      searchQuery = searchQuery.replace(/^(?:information\s+about|info\s+about)\s+/i, '');
      const isFileRef = /^(?:file\s+|folder\s+)|(\.[a-z0-9]+)$/i.test(searchQuery);
      if (!isFileRef || enginePrefix.includes('google') || enginePrefix.includes('search')) {
        searchQuery = searchQuery.replace(/\s+online$/i, '').trim();
        const engine = enginePrefix.includes('the web') ? 'The Web' : 'Google';
        return {
          type: 'WEB_SEARCH',
          target: engine,
          query: searchQuery,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('WEB_SEARCH'),
        };
      }
    }

    // 5. OPEN URL Commands
    // 5a. Explicit protocol check (e.g. "Open javascript:alert(1)", "Open file:///Users/test/file", "Open https://github.com")
    const protocolMatch = normalized.match(/^(?:open|go\s+to|visit)\s+([a-z0-9+.-]+:[^\s]+)$/i);
    if (protocolMatch) {
      return {
        type: 'OPEN_URL',
        target: protocolMatch[1].trim(),
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('OPEN_URL'),
      };
    }

    // 5b. Web Registry lookup (e.g. "Open YouTube", "Open GitHub", "Open Gmail", "Open ChatGPT")
    const openWebMatch = normalized.match(/^(?:open|go\s+to|visit)\s+(.+)$/i);
    if (openWebMatch) {
      const candidate = openWebMatch[1].trim();
      const webEntry = resolveWebsite(candidate);
      if (webEntry) {
        return {
          type: 'OPEN_URL',
          target: webEntry.url,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('OPEN_URL'),
        };
      }
    }

    // 5c. Standard domain URL check (e.g. "Open github.com", "Go to google.com", "Visit twitter.com")
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|org|net|io|edu|gov|dev|co|app))/i;
    const urlMatch = lower.match(urlPattern);
    if (urlMatch && (lower.startsWith('open') || lower.startsWith('go to') || lower.startsWith('visit') || urlMatch[0] === lower)) {
      let rawUrl = urlMatch[0];
      if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        rawUrl = `https://${rawUrl}`;
      }
      return {
        type: 'OPEN_URL',
        target: rawUrl,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('OPEN_URL'),
      };
    }

    // 6. DELETE FILE Command
    // Example: "Delete report.docx", "Remove temp.txt", "Delete report.pdf"
    const deleteMatch = normalized.match(/^(?:delete|remove|trash|erase)\s+(?:file\s+)?(?:called\s+|named\s+)?(.+)$/i);
    if (deleteMatch) {
      return {
        type: 'DELETE_FILE',
        target: deleteMatch[1].trim(),
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('DELETE_FILE'),
      };
    }

    // 7. MOVE FILE Command
    // Example: "Move report.pdf to Desktop", "Move notes.txt to Documents", "Move file.txt to Downloads"
    const moveMatch = normalized.match(
      /^move\s+(?:file\s+)?([^\s]+?)\s+(?:to|into|in)\s+(?:the\s+)?(?:folder\s+)?(.+?)(?:\s+folder)?$/i
    );
    if (moveMatch) {
      const rawSource = moveMatch[1].trim();
      const rawDest = moveMatch[2].trim();
      const resolvedDest = resolveApprovedDirectory(rawDest) || this.capitalizeWord(rawDest);
      return {
        type: 'MOVE_FILE',
        target: rawSource,
        destination: resolvedDest,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('MOVE_FILE'),
      };
    }

    // 8. CREATE FILE Command
    // Example: "Create a file called notes.txt", "Create notes.txt in Documents", "Create a new file todo.txt"
    const createFileMatch = normalized.match(
      /^(?:create|make|touch)\s+(?:a\s+)?(?:new\s+)?(?:file\s+)?(?:called\s+|named\s+)?([^\s]+?\.[a-z0-9]+)(?:\s+(?:in|inside|to|into)\s+(?:the\s+)?(?:folder\s+)?(.+?)(?:\s+folder)?)?$/i
    );
    if (createFileMatch) {
      const rawTarget = createFileMatch[1].trim();
      const rawDest = createFileMatch[2] ? createFileMatch[2].trim() : undefined;
      const resolvedDest = rawDest ? (resolveApprovedDirectory(rawDest) || this.capitalizeWord(rawDest)) : 'Documents';
      return {
        type: 'CREATE_FILE',
        target: rawTarget,
        destination: resolvedDest,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('CREATE_FILE'),
      };
    }

    // 8b. CREATE FOLDER Command
    // Example: "Create a folder called AURA inside Documents"
    const createFolderMatch = normalized.match(
      /^(?:create|make|mkdir)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory)\s+(?:called\s+|named\s+)?([^\s]+?)(?:\s+(?:in|inside|to|into)\s+(?:the\s+)?(?:folder\s+)?(.+?)(?:\s+folder)?)?$/i
    );
    if (createFolderMatch) {
      const rawTarget = createFolderMatch[1].trim();
      const rawDest = createFolderMatch[2] ? createFolderMatch[2].trim() : undefined;
      const resolvedDest = rawDest ? (resolveApprovedDirectory(rawDest) || this.capitalizeWord(rawDest)) : 'Documents';
      return {
        type: 'CREATE_FOLDER',
        target: rawTarget,
        destination: resolvedDest,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('CREATE_FOLDER'),
      };
    }

    // 9. CLOSE APP Commands
    // Example: "Close Chrome", "Quit Safari", "Exit Slack"
    const closeMatch = lower.match(/^(close|quit|exit|stop|terminate|kill)\s+(?:app\s+)?(.+)$/i);
    if (closeMatch) {
      const appTargetRaw = closeMatch[2].trim();
      const mappedTarget = APP_NAME_MAP[appTargetRaw.toLowerCase()] || this.capitalizeWord(appTargetRaw);
      return {
        type: 'CLOSE_APP',
        target: mappedTarget,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('CLOSE_APP'),
      };
    }

    // 10. SYSTEM SETTING Commands
    // Example: "Increase volume", "Turn volume down", "Mute", "Unmute", "Volume up"
    const resolvedSetting = resolveSystemSetting(normalized);
    if (resolvedSetting) {
      return {
        type: 'SYSTEM_SETTING',
        target: resolvedSetting,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('SYSTEM_SETTING'),
      };
    }
    if (/\b(brightness|volume|wifi|bluetooth|system setting|mute|audio|sound)\b/i.test(lower)) {
      return {
        type: 'SYSTEM_SETTING',
        target: normalized,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.85,
        risk: getCommandRiskLevel('SYSTEM_SETTING'),
      };
    }

    // 11. OPEN FOLDER Commands
    // Example: "Open my Downloads folder", "Open Downloads", "Show me Documents", "Open Desktop folder"
    const folderVerbMatch = normalized.match(/^(?:open|show|explore|browse)\s+(?:my\s+)?([a-z0-9\s]+?)(?:\s+folder)?$/i);
    const folderCandidate = folderVerbMatch ? folderVerbMatch[1].trim() : normalized;
    const resolvedApproved = resolveApprovedDirectory(folderCandidate);
    if (resolvedApproved && (folderVerbMatch || lower.includes('folder') || FOLDER_NAMES.includes(lower))) {
      return {
        type: 'OPEN_FOLDER',
        target: resolvedApproved,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('OPEN_FOLDER'),
      };
    }

    // 12. OPEN FILE Commands
    // Example: "Open report.pdf", "Show notes.txt", "Open my report.pdf", "Open ../../etc/passwd", "Open /etc/hosts"
    const openFileMatch = normalized.match(
      /^(?:open|show|view)\s+(?:my\s+)?(?:file\s+)?([^\s]+?\.[a-z0-9]+|\.\.[^\s]*|\/[^\s]*|~\/[^\s]*)$/i
    );
    if (openFileMatch) {
      return {
        type: 'OPEN_FILE',
        target: openFileMatch[1].trim(),
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('OPEN_FILE'),
      };
    }

    // 13. OPEN APP Commands (Primary application launcher verbs)
    // Example: "Open Chrome", "Launch Safari", "Start Notes", "Bring up Chrome", "Get Chrome open"
    const getOpenMatch = lower.match(/^get\s+(.+?)\s+open$/i);
    const openAppMatch = lower.match(/^(?:open|launch|start|run|execute|bring\s+up|fire\s+up|switch\s+to|pop\s+open)\s+(?:app\s+)?(.+)$/i);
    const rawAppCandidate = getOpenMatch ? getOpenMatch[1].trim() : (openAppMatch ? openAppMatch[1].trim() : null);

    if (rawAppCandidate) {
      const mappedTarget = APP_NAME_MAP[rawAppCandidate.toLowerCase()] || this.capitalizeWord(rawAppCandidate);
      return {
        type: 'OPEN_APP',
        target: mappedTarget,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('OPEN_APP'),
      };
    }

    // Fallback: Check if target is a known app name directly (e.g., "Chrome" or "Safari")
    if (APP_NAME_MAP[lower]) {
      return {
        type: 'OPEN_APP',
        target: APP_NAME_MAP[lower],
        originalInput,
        normalizedInput: normalized,
        confidence: 0.85,
        risk: getCommandRiskLevel('OPEN_APP'),
      };
    }

    // 13b. EXTRACT INFO Command
    // Example: "tell me what you find", "get the result", "extract the information"
    const extractInfoMatch = lower.match(/^(?:tell\s+me\s+what\s+you\s+find|tell\s+me\s+the\s+result|get\s+the\s+(?:information|info|result|answer)|extract\s+the\s+(?:information|info|result|answer)|read\s+(?:it|the\s+result|the\s+page))$/i);
    if (extractInfoMatch) {
      return {
        type: 'EXTRACT_INFO',
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('EXTRACT_INFO'),
      };
    }

    // 14. CALCULATE Command
    if (SafeCalculator.isCalculation(rawInput) || SafeCalculator.calculate(rawInput)) {
      return {
        type: 'CALCULATE',
        target: normalized,
        query: normalized,
        originalInput,
        normalizedInput: normalized,
        confidence: 0.95,
        risk: getCommandRiskLevel('CALCULATE'),
      };
    }

    // 15. UNKNOWN Command fallback
    return {
      type: 'UNKNOWN',
      originalInput,
      normalizedInput: normalized,
      confidence: 0,
      risk: 'LOW',
    };
  }

  private capitalizeWord(str: string): string {
    if (!str) return str;
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export const localCommandParser = new LocalNaturalLanguageCommandParser();
