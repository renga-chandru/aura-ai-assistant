/**
 * AURA Local Semantic Natural Language Understanding Engine (Phase 24)
 *
 * Implements IAssistantUnderstanding without an external LLM dependency.
 * Understands user meaning, intent, slots, and multi-step tasks across natural paraphrases.
 */

import {
  IAssistantUnderstanding,
  UnderstandingResult,
  StructuredAction,
  ConversationIntent,
} from './types';
import { BrainContext } from '../brain/types';
import { SemanticNormalizer } from './semanticNormalizer';
import { EntityExtractor } from './entityExtractor';
import { SafeCalculator } from '../brain/SafeCalculator';
import { getCommandRiskLevel } from '../commands/parser';
import { DesktopAwarenessService } from '@/system';
import { resolveApp } from '../execution/appRegistry';

export class LocalSemanticUnderstanding implements IAssistantUnderstanding {
  private static readonly MULTI_STEP_SPLIT_REGEX =
    /(?:,\s*)?\s+(?:and(?:\s+then)?|then|after\s+that|followed\s+by|once\s+that(?:\s+is|\'s)?\s+done)\s+(?=(?:calculate|compute|solve|perform|work\s+out|find|find\s+me|do|evaluate|search|look\s+up|look\s+for|google|open|launch|bring\s+up|start|get|close|quit|create|move|delete)\b)|(?:,\s+)(?=(?:calculate|compute|solve|perform|work\s+out|find|do|evaluate|search|look\s+up|open|launch|bring\s+up|close|create|move|delete)\b)/i;

  public async understand(rawInput: string, context?: BrainContext): Promise<UnderstandingResult> {
    const originalText = rawInput.trim();
    if (!originalText) {
      return {
        mode: 'conversation',
        intent: 'GREETING',
        confidence: 1.0,
        entities: {},
        actions: [],
        originalText: rawInput,
        normalizedText: '',
        clarificationNeeded: false,
      };
    }

    let normalized = SemanticNormalizer.normalize(originalText);
    let lower = normalized.toLowerCase();

    // Phase 31 Context Resolution & Conversational Questions
    if (context?.activeContext) {
      if (/^what (?:was|is) the result/i.test(lower) || /^what did (?:i|you)(?: just)? calculate/i.test(lower)) {
        if (context.activeContext['calculation']) {
           return {
             mode: 'conversation', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
             originalText, normalizedText: lower, clarificationNeeded: false,
             chatResponse: `The result was ${context.activeContext['calculation'].value}.`
           };
        } else {
           return {
             mode: 'ambiguous', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
             originalText, normalizedText: lower, clarificationNeeded: true,
             clarificationQuestion: 'I am not sure which calculation you are referring to. Could you clarify?'
           };
        }
      }

      if (/^what did (?:i|you)(?: just)? search for/i.test(lower)) {
        if (context.activeContext['search']) {
           return {
             mode: 'conversation', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
             originalText, normalizedText: lower, clarificationNeeded: false,
             chatResponse: `You recently searched for "${context.activeContext['search'].value}".`
           };
        }
      }

      if (/^what app did (?:i|you)(?: just)? open/i.test(lower)) {
        if (context.activeContext['app']) {
           return {
             mode: 'conversation', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
             originalText, normalizedText: lower, clarificationNeeded: false,
             chatResponse: `You recently opened ${context.activeContext['app'].value}.`
           };
        }
      }
    }

    // Phase 32 Desktop Awareness (Stateless)
    console.log('LOWER IS:', lower);
    if (/^what app am i using\b/i.test(lower) || /^what is the active (app|application)\b/i.test(lower)) {
      const activeApp = DesktopAwarenessService.getActiveApp();
      return {
        mode: 'conversation', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
        originalText, normalizedText: lower, clarificationNeeded: false,
        chatResponse: activeApp ? `You are currently using ${activeApp}.` : "I'm not sure what application is currently active."
      };
    }

    const isRunningMatch = lower.match(/^is (.+?) (open|running)\b/i);
    if (isRunningMatch) {
      const appName = isRunningMatch[1].trim();
      const resolved = resolveApp(appName);
      if (resolved) {
        const running = DesktopAwarenessService.isAppRunning(resolved.canonicalName);
        return {
          mode: 'conversation', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
          originalText, normalizedText: lower, clarificationNeeded: false,
          chatResponse: running ? `Yes, ${resolved.canonicalName} is currently running.` : `No, ${resolved.canonicalName} is not running right now.`
        };
      } else {
        return {
          mode: 'conversation', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
          originalText, normalizedText: lower, clarificationNeeded: false,
          chatResponse: `I don't recognize ${appName} as a supported application.`
        };
      }
    }

    if (context?.activeContext) {

      // Remove conversational continuations
      lower = lower.replace(/^(?:now|then|after that|and)\s+/i, '');
      normalized = normalized.replace(/^(?:Now|Then|After that|And)\s+/i, '').replace(/^(?:now|then|after that|and)\s+/i, '');

      // Resolve calculation references
      if (/\b(?:that|it|the result)\b/.test(lower) && context.activeContext['calculation']) {
        const isMathContext = /^(?:calculate|compute|multiply|divide|add|subtract|plus|minus|times)\b/.test(lower) || /^[\d\s\+\-\*\/\(\)\.]+$/.test(lower.replace(/\b(that|it|the result)\b/g, '1'));
        if (isMathContext) {
          lower = lower.replace(/\b(?:that|it|the result)\b/g, context.activeContext['calculation'].value);
          normalized = normalized.replace(/\b(?:that|it|the result)\b/ig, context.activeContext['calculation'].value);
        }
      }

      // Resolve file/folder references
      if (/\b(?:the file|this file)\b/.test(lower) && context.activeContext['file']) {
        lower = lower.replace(/\b(?:the file|this file)\b/g, context.activeContext['file'].value);
        normalized = normalized.replace(/\b(?:the file|this file)\b/ig, context.activeContext['file'].value);
      }
      if (/\b(?:that folder|the folder|this folder)\b/.test(lower) && context.activeContext['folder']) {
        lower = lower.replace(/\b(?:that folder|the folder|this folder)\b/g, context.activeContext['folder'].value);
        normalized = normalized.replace(/\b(?:that folder|the folder|this folder)\b/ig, context.activeContext['folder'].value);
      }

      // Resolve app references
      if (/\b(?:it|that|the app|the application)\b/.test(lower) && context.activeContext['app']) {
        const isAppContext = /^(?:close|quit|exit|switch to|open)\b/.test(lower);
        if (isAppContext) {
          lower = lower.replace(/\b(?:it|that|the app|the application)\b/g, context.activeContext['app'].value);
          normalized = normalized.replace(/\b(?:it|that|the app|the application)\b/ig, context.activeContext['app'].value);
        }
      }

      // Phase 32: Resolve ambiguous file types in active folder
      const fileTypeMatch = lower.match(/\bthe ([a-z0-9]+)$/i) || lower.match(/\bthe ([a-z0-9]+) file\b/i);
      if (fileTypeMatch && context.activeContext['folder']) {
        const ext = fileTypeMatch[1].toLowerCase();
        // Check if it's a known extension-like word
        if (['pdf', 'txt', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'csv'].includes(ext)) {
          const files = DesktopAwarenessService.getFilesInFolder(context.activeContext['folder'].value);
          const matches = files.filter((f: string) => f.toLowerCase().endsWith(`.${ext}`));
          if (matches.length === 1) {
            lower = lower.replace(fileTypeMatch[0], matches[0]);
            normalized = normalized.replace(new RegExp(fileTypeMatch[0], 'ig'), matches[0]);
          } else if (matches.length > 1) {
            return {
              mode: 'ambiguous', intent: 'QUESTION', confidence: 1.0, entities: {}, actions: [],
              originalText, normalizedText: lower, clarificationNeeded: true,
              clarificationQuestion: `I found multiple ${ext.toUpperCase()} files. Which one should I open?`
            };
          }
        }
      }
    }

    // 0. Prohibited System / Shell Execution Check
    if (
      /^(sudo|defaults|killall|launchctl|chmod|chown|osascript|eval|exec)\b/i.test(lower) ||
      /^(?:run|execute)\s+(sudo|defaults|killall|launchctl|chmod|chown|osascript|sh|bash|zsh)/i.test(lower)
    ) {
      return {
        mode: 'action',
        intent: 'UNKNOWN_ACTION',
        confidence: 1.0,
        entities: { rawTarget: originalText },
        actions: [
          {
            intent: 'UNKNOWN_ACTION',
            entities: { rawTarget: originalText },
            confidence: 1.0,
            parsedCommand: {
              type: 'UNKNOWN',
              originalInput: originalText,
              normalizedInput: normalized,
              confidence: 0,
              risk: 'HIGH',
            },
          },
        ],
        originalText,
        normalizedText: normalized,
        clarificationNeeded: false,
      };
    }

    // 1. Ambiguity & Incomplete Request Detection
    const ambiguityResult = this.checkAmbiguity(lower, originalText, context);
    if (ambiguityResult) {
      return ambiguityResult;
    }

    // 2. Conversational Intent Classification
    const conversationMatch = this.matchConversationIntent(lower);
    if (conversationMatch) {
      return {
        mode: 'conversation',
        intent: conversationMatch,
        confidence: 0.98,
        entities: {},
        actions: [],
        originalText,
        normalizedText: normalized,
        clarificationNeeded: false,
      };
    }

    // 3. Multi-Step Intent Detection
    if (LocalSemanticUnderstanding.MULTI_STEP_SPLIT_REGEX.test(originalText)) {
      const segments = originalText
        .split(LocalSemanticUnderstanding.MULTI_STEP_SPLIT_REGEX)
        .map((s) => s.trim())
        .filter(Boolean);

      if (segments.length >= 2) {
        const actions: StructuredAction[] = [];
        let allValid = true;

        for (const seg of segments) {
          const action = this.parseSingleAction(seg, context);
          if (action && action.intent !== 'UNKNOWN_ACTION') {
            actions.push(action);
          } else {
            allValid = false;
            break;
          }
        }

        if (allValid && actions.length >= 2) {
          return {
            mode: 'multi_action',
            intent: 'MULTI_STEP',
            confidence: 0.95,
            entities: {},
            actions,
            originalText,
            normalizedText: normalized,
            clarificationNeeded: false,
          };
        }
      }
    }

    // 4. Calculations (Arithmetic, Percentages, Word Operators)
    const mathExpression = this.extractMathExpression(lower, originalText);
    if (mathExpression) {
      const calcResult = SafeCalculator.calculate(mathExpression);
      if (calcResult) {
        return {
          mode: 'action',
          intent: 'CALCULATE',
          confidence: 0.98,
          entities: { mathExpression },
          actions: [
            {
              intent: 'CALCULATE',
              entities: { mathExpression },
              confidence: 0.98,
              parsedCommand: {
                type: 'CALCULATE',
                target: mathExpression,
                query: mathExpression,
                originalInput: originalText,
                normalizedInput: lower,
                confidence: 0.98,
                risk: 'LOW',
              }
            },
          ],
          originalText,
          normalizedText: lower,
          clarificationNeeded: false,
        };
      }
    }

    // 5. Single Computer Action
    const singleAction = this.parseSingleAction(normalized, context, originalText);
    if (singleAction && singleAction.intent !== 'UNKNOWN_ACTION') {
      return {
        mode: 'action',
        intent: singleAction.intent,
        confidence: singleAction.confidence,
        entities: singleAction.entities,
        actions: [singleAction],
        originalText,
        normalizedText: normalized,
        clarificationNeeded: false,
      };
    }

    // 6. Unknown / General Conversation Fallback
    return {
      mode: 'unknown',
      intent: 'UNKNOWN_CONVERSATION',
      confidence: 0.2,
      entities: {},
      actions: [],
      originalText,
      normalizedText: normalized,
      clarificationNeeded: false,
    };
  }

  /**
   * Ambiguity and missing slot detection
   */
  private checkAmbiguity(
    lower: string,
    originalText: string,
    context?: BrainContext
  ): UnderstandingResult | null {
    const hasRecentTarget = Boolean(
      context?.lastAction?.target && Date.now() - context.lastAction.timestamp < 120000
    );

    // "open it", "bring it up", "launch it"
    if (/^(?:open|bring\s+up|launch|pop\s+open)\s+(?:it|this|that)$/i.test(lower)) {
      if (!hasRecentTarget) {
        return {
          mode: 'ambiguous',
          intent: 'OPEN_APP',
          confidence: 0.85,
          entities: {},
          actions: [],
          originalText,
          normalizedText: lower,
          clarificationNeeded: true,
          clarificationQuestion: 'What would you like me to open?',
        };
      }
    }

    // "close it", "quit it", "exit it"
    if (/^(?:close|quit|exit|shut\s+down)\s+(?:it|this|that)$/i.test(lower)) {
      if (!hasRecentTarget) {
        return {
          mode: 'ambiguous',
          intent: 'CLOSE_APP',
          confidence: 0.85,
          entities: {},
          actions: [],
          originalText,
          normalizedText: lower,
          clarificationNeeded: true,
          clarificationQuestion: 'What would you like me to close?',
        };
      }
    }

    // "move this file", "move it", "move the file"
    if (/^move\s+(?:this\s+file|it|the\s+file|this)$/i.test(lower)) {
      return {
        mode: 'ambiguous',
        intent: 'MOVE_FILE',
        confidence: 0.85,
        entities: {},
        actions: [],
        originalText,
        normalizedText: lower,
        clarificationNeeded: true,
        clarificationQuestion: 'Where should I move it?',
      };
    }

    // "delete it", "delete this file"
    if (/^(?:delete|remove|trash)\s+(?:it|this|this\s+file|the\s+file)$/i.test(lower)) {
      return {
        mode: 'ambiguous',
        intent: 'DELETE_FILE',
        confidence: 0.85,
        entities: {},
        actions: [],
        originalText,
        normalizedText: lower,
        clarificationNeeded: true,
        clarificationQuestion: 'Which file would you like me to delete?',
      };
    }

    // "open the file I just mentioned" / "open the file" without target
    if (/^open\s+(?:the\s+file\s+i\s+just\s+mentioned|the\s+file|that\s+file)$/i.test(lower)) {
      if (!hasRecentTarget) {
        return {
          mode: 'ambiguous',
          intent: 'OPEN_FILE',
          confidence: 0.85,
          entities: {},
          actions: [],
          originalText,
          normalizedText: lower,
          clarificationNeeded: true,
          clarificationQuestion: 'Which file would you like me to open?',
        };
      }
    }

    // "open my project"
    if (/^open\s+(?:my\s+)?project$/i.test(lower)) {
      return {
        mode: 'ambiguous',
        intent: 'OPEN_FOLDER',
        confidence: 0.85,
        entities: {},
        actions: [],
        originalText,
        normalizedText: lower,
        clarificationNeeded: true,
        clarificationQuestion: 'Which project folder or file would you like me to open?',
      };
    }

    return null;
  }

  /**
   * Matches conversational intentions across natural variations
   */
  private matchConversationIntent(lower: string): ConversationIntent | null {
    // 1. GREETING
    if (
      /^(?:hi|hello|hey|hiya|yo|greetings|good\s+morning|good\s+afternoon|good\s+evening|good\s+to\s+see\s+you|hello\s+there|hey\s+there)$/i.test(
        lower
      )
    ) {
      return 'GREETING';
    }

    // 2. CASUAL_CHECKIN
    if (
      /^(?:how\s+are\s+you(?:(?:\s+doing)?|(?:\s+today)?)|how\s+is\s+it\s+going|how\s+are\s+things|you\s+doing\s+okay|are\s+you\s+doing\s+okay|how\s+have\s+you\s+been|what\s+is\s+up|what\'s\s+up|how\s+is\s+everything|how\s+do\s+you\s+feel)$/i.test(
        lower
      )
    ) {
      return 'CASUAL_CHECKIN';
    }

    // 3. IDENTITY
    if (
      /^(?:who\s+are\s+you|what\s+is\s+your\s+name|tell\s+me\s+about\s+yourself|what\s+are\s+you|who\s+made\s+you|introduce\s+yourself)$/i.test(
        lower
      )
    ) {
      return 'IDENTITY';
    }

    // 4. CAPABILITIES
    if (
      /^(?:what\s+can\s+you\s+do(?:\s+for\s+me)?|what\s+are\s+your\s+capabilities|what\s+do\s+you\s+do|what\s+are\s+your\s+features|list\s+(?:your\s+)?features|help(?:\s+me)?|how\s+can\s+you\s+help\s+me)$/i.test(
        lower
      )
    ) {
      return 'CAPABILITIES';
    }

    // 5. THANKS
    if (
      /^(?:thank\s+you|thanks|i\s+appreciate\s+it|appreciate\s+it|thanks\s+a\s+lot|thank\s+you\s+so\s+much|many\s+thanks)$/i.test(
        lower
      )
    ) {
      return 'THANKS';
    }

    // 6. GOODBYE
    if (
      /^(?:bye|goodbye|see\s+you(?:\s+later)?|cya|take\s+care|have\s+a\s+good\s+one|catch\s+you\s+later)$/i.test(
        lower
      )
    ) {
      return 'GOODBYE';
    }

    return null;
  }

  /**
   * Extracts math expression from queries like "what is 25 times 4", "work out 120 divided by 6", "calculate 45 plus 78 and tell me the result"
   */
  private extractMathExpression(lower: string, original: string): string | null {
    // Strip calculation carrier prefixes
    const mathPrefix = /^(?:what\s+is|what\'s|how\s+much\s+is|calculate|compute|solve|perform|work\s+out|find|do)\s+/i;
    let candidate = lower.replace(mathPrefix, '').trim();

    if (
      SafeCalculator.isCalculation(candidate) ||
      SafeCalculator.isCalculation(original) ||
      SafeCalculator.calculate(candidate) ||
      SafeCalculator.calculate(original)
    ) {
      return candidate || original;
    }
    return null;
  }

  /**
   * Parses a single actionable clause into a StructuredAction with an attached ParsedCommand
   */
  public parseSingleAction(
    text: string,
    _context?: BrainContext,
    rawFallback?: string
  ): StructuredAction | null {
    const raw = text.trim();
    const normalized = SemanticNormalizer.normalize(raw);
    const lower = normalized.toLowerCase();
    const originalInput = rawFallback || raw;

    // 0. Calculations
    if (SafeCalculator.isCalculation(raw) || SafeCalculator.calculate(raw)) {
      return {
        intent: 'CALCULATE',
        entities: { mathExpression: raw },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'CALCULATE',
          target: raw,
          query: raw,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: 'LOW',
        },
      };
    }

    // 1. Power Commands
    if (/^(shut\s*down|power\s*off|turn\s*off(?:\s+my\s+mac)?)\b/i.test(lower)) {
      return {
        intent: 'SHUTDOWN',
        entities: { rawTarget: 'System' },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'SHUTDOWN',
          target: 'System',
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('SHUTDOWN'),
        },
      };
    }

    if (/^(restart|reboot(?:\s+my\s+mac)?)\b/i.test(lower)) {
      return {
        intent: 'RESTART',
        entities: { rawTarget: 'System' },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'RESTART',
          target: 'System',
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('RESTART'),
        },
      };
    }

    if (/^(sleep|put\s+(?:my\s+)?(?:mac|computer)\s+to\s+sleep)\b/i.test(lower)) {
      return {
        intent: 'SLEEP',
        entities: { rawTarget: 'System' },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'SLEEP',
          target: 'System',
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('SLEEP'),
        },
      };
    }

    // 2. System Settings (Volume & Audio)
    const settingMatch = EntityExtractor.resolveSetting(normalized);
    if (settingMatch) {
      return {
        intent: 'SYSTEM_SETTING',
        entities: { systemSetting: settingMatch },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'SYSTEM_SETTING',
          target: settingMatch,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('SYSTEM_SETTING'),
        },
      };
    }

    // 3. Web Search
    // Matches "search for Python tutorials", "look up Python tutorials", "find Python tutorials online",
    // "can you search the web for Python tutorials?", "look for React hooks", "find me some Python tutorials",
    // "search YouTube for Python tutorials"
    const searchTargetMatch = normalized.match(/^search\s+([a-z0-9\s]+?)\s+for\s+(.+)$/i);
    if (searchTargetMatch) {
      const searchTarget = searchTargetMatch[1].trim();
      const searchQuery = searchTargetMatch[2].trim();
      const url = EntityExtractor.resolveUrl(searchTarget);
      return {
        intent: 'WEB_SEARCH',
        entities: { query: searchQuery, rawTarget: searchTarget, url: url || undefined },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'WEB_SEARCH',
          target: url ? searchTarget : 'Google',
          query: searchQuery,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('WEB_SEARCH'),
        },
      };
    }

    const isSearchPattern =
      /^(?:search\s+the\s+web\s+for|search\s+web\s+for|search\s+for|search|look\s+up|look\s+for|find\s+me\s+some|find\s+me|find|google)\s+(.+)$/i;
    const searchMatch = normalized.match(isSearchPattern);
    if (searchMatch) {
      const candidateQuery = searchMatch[1].trim();
      // Ensure candidate is not a local folder or file request
      const isFileOrFolder =
        /^(?:file\s+|folder\s+)|(\.[a-z0-9]+)$/i.test(candidateQuery) ||
        EntityExtractor.resolveFolder(candidateQuery) !== null;

      if (!isFileOrFolder) {
        const query = EntityExtractor.extractSearchQuery(normalized) || candidateQuery;
        return {
          intent: 'WEB_SEARCH',
          entities: { query },
          confidence: 0.95,
          rawSegment: raw,
          parsedCommand: {
            type: 'WEB_SEARCH',
            target: 'Google',
            query,
            originalInput,
            normalizedInput: normalized,
            confidence: 0.95,
            risk: getCommandRiskLevel('WEB_SEARCH'),
          },
        };
      }
    }

    // 4. Web URLs
    const urlResolved = EntityExtractor.resolveUrl(normalized.replace(/^(?:open|go\s+to|visit)\s+/i, ''));
    if (urlResolved && (lower.startsWith('open') || lower.startsWith('go to') || lower.startsWith('visit'))) {
      return {
        intent: 'OPEN_URL',
        entities: { url: urlResolved },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'OPEN_URL',
          target: urlResolved,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('OPEN_URL'),
        },
      };
    }

    // 5. Files: Delete, Move, Create, Open
    // Delete file
    const deleteMatch = normalized.match(
      /^(?:delete|remove|trash|erase)\s+(?:file\s+)?(?:called\s+|named\s+)?(.+)$/i
    );
    if (deleteMatch) {
      const filename = deleteMatch[1].trim();
      return {
        intent: 'DELETE_FILE',
        entities: { filename },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'DELETE_FILE',
          target: filename,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('DELETE_FILE'),
        },
      };
    }

    // Move file
    const moveMatch = normalized.match(
      /^move\s+(?:file\s+)?([^\s]+?)\s+(?:to|into|in)\s+(?:the\s+)?(?:folder\s+)?(.+?)(?:\s+folder)?$/i
    );
    if (moveMatch) {
      const filename = moveMatch[1].trim();
      const rawDest = moveMatch[2].trim();
      const destination = EntityExtractor.resolveFolder(rawDest) || rawDest;
      return {
        intent: 'MOVE_FILE',
        entities: { filename, destination },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'MOVE_FILE',
          target: filename,
          destination,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('MOVE_FILE'),
        },
      };
    }

    // Create file
    const createMatch = normalized.match(
      /^(?:create|make|touch)\s+(?:a\s+)?(?:new\s+)?(?:file\s+)?(?:called\s+|named\s+)?([^\s]+?)(?:\s+(?:in|inside|to|into)\s+(?:the\s+)?(?:folder\s+)?(.+?)(?:\s+folder)?)?$/i
    );
    if (createMatch) {
      const filename = createMatch[1].trim();
      const rawDest = createMatch[2] ? createMatch[2].trim() : undefined;
      const destination = rawDest ? (EntityExtractor.resolveFolder(rawDest) || rawDest) : 'Documents';
      return {
        intent: 'CREATE_FILE',
        entities: { filename, destination },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'CREATE_FILE',
          target: filename,
          destination,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('CREATE_FILE'),
        },
      };
    }

    // Open Folder
    const folderMatch = normalized.match(
      /^(?:open|show(?:\s+me)?|explore|browse)\s+(?:my\s+)?([a-z0-9\s]+?)(?:\s+folder)?$/i
    );
    const folderCandidate = folderMatch ? folderMatch[1].trim() : normalized;
    const resolvedFolder = EntityExtractor.resolveFolder(folderCandidate);
    if (resolvedFolder && (folderMatch || lower.includes('folder') || ['downloads', 'documents', 'desktop', 'pictures', 'movies', 'music', 'applications'].includes(lower))) {
      return {
        intent: 'OPEN_FOLDER',
        entities: { folderName: resolvedFolder },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'OPEN_FOLDER',
          target: resolvedFolder,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('OPEN_FOLDER'),
        },
      };
    }

    // Open File
    const openFileMatch = normalized.match(
      /^(?:open|show(?:\s+me)?|view)\s+(?:my\s+)?(?:file\s+)?([^\s]+?\.[a-z0-9]+|\.\.[^\s]*|\/[^\s]*|~\/[^\s]*)$/i
    );
    if (openFileMatch) {
      const filename = openFileMatch[1].trim();
      return {
        intent: 'OPEN_FILE',
        entities: { filename },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'OPEN_FILE',
          target: filename,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('OPEN_FILE'),
        },
      };
    }

    // 6. Application Control: Close App
    const closeAppMatch = lower.match(/^(?:close|quit|exit|stop|terminate|kill)\s+(?:app\s+)?(.+)$/i);
    if (closeAppMatch) {
      const rawTarget = closeAppMatch[1].trim();
      const appName = EntityExtractor.resolveApp(rawTarget) || rawTarget;
      return {
        intent: 'CLOSE_APP',
        entities: { appName },
        confidence: 0.95,
        rawSegment: raw,
        parsedCommand: {
          type: 'CLOSE_APP',
          target: appName,
          originalInput,
          normalizedInput: normalized,
          confidence: 0.95,
          risk: getCommandRiskLevel('CLOSE_APP'),
        },
      };
    }

    // 7. Application Control: Open / Launch / Bring Up / Start / Get Open
    // Handles natural variations:
    // "can you bring up Chrome?", "launch the browser", "please start Google Chrome",
    // "get Chrome open", "fire up VS Code", "open Notes"
    let openAppTargetCandidate: string | null = null;

    // Pattern A: "get [app] open"
    const getOpenMatch = lower.match(/^get\s+(.+?)\s+open$/i);
    if (getOpenMatch) {
      openAppTargetCandidate = getOpenMatch[1].trim();
    }

    // Pattern B: "bring up [app]", "launch [app]", "start [app]", "open [app]", "fire up [app]", "switch to [app]"
    const openVerbMatch = lower.match(
      /^(?:open|launch|start|bring\s+up|fire\s+up|run|execute|switch\s+to|pop\s+open)\s+(?:app\s+)?(.+)$/i
    );
    if (openVerbMatch && !openAppTargetCandidate) {
      openAppTargetCandidate = openVerbMatch[1].trim();
    }

    if (openAppTargetCandidate) {
      // Check if target is actually an app alias
      const resolvedApp = EntityExtractor.resolveApp(openAppTargetCandidate);
      if (resolvedApp) {
        return {
          intent: 'OPEN_APP',
          entities: { appName: resolvedApp },
          confidence: 0.95,
          rawSegment: raw,
          parsedCommand: {
            type: 'OPEN_APP',
            target: resolvedApp,
            originalInput,
            normalizedInput: normalized,
            confidence: 0.95,
            risk: getCommandRiskLevel('OPEN_APP'),
          },
        };
      }

      // Check if target was a website name (e.g. "open YouTube", "open GitHub")
      const resolvedWeb = EntityExtractor.resolveUrl(openAppTargetCandidate);
      if (resolvedWeb) {
        return {
          intent: 'OPEN_URL',
          entities: { url: resolvedWeb },
          confidence: 0.95,
          rawSegment: raw,
          parsedCommand: {
            type: 'OPEN_URL',
            target: resolvedWeb,
            originalInput,
            normalizedInput: normalized,
            confidence: 0.95,
            risk: getCommandRiskLevel('OPEN_URL'),
          },
        };
      }
    }

    return null;
  }
}

export const localSemanticUnderstanding = new LocalSemanticUnderstanding();
