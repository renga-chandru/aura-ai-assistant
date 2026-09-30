import { ITaskPlanner, TaskPlan, PlannedStep } from './types';
import { localCommandParser } from '../commands/parser';
import { ParsedCommand } from '../commands/types';
import { SafeCalculator } from '../brain/SafeCalculator';

/**
 * Local Task Planner (Phase 23)
 *
 * Decomposes compound, multi-step natural language goals into sequential,
 * structured execution steps using existing validators and executors.
 */
export class LocalTaskPlanner implements ITaskPlanner {
  // Regex to split on conjunctions, commas, and natural connectors followed by action verbs
  public static readonly SPLIT_REGEX =
    /(?:,\s*)?\s+(?:and(?:\s+then)?|then|after\s+that|followed\s+by|once\s+that(?:\s+is|\'s)?\s+done)\s+(?=(?:calculate|compute|solve|perform|work\s+out|find|find\s+me|do|evaluate|search|look\s+up|look\s+for|google|open|launch|bring\s+up|start|get|close|quit|create|make|mkdir|move|delete|tell\s+me|extract|read|go|navigate)\b)|(?:,\s+)(?=(?:calculate|compute|solve|perform|work\s+out|find|do|evaluate|search|look\s+up|open|launch|bring\s+up|close|create|make|mkdir|move|delete|tell\s+me|extract|read|go|navigate)\b)/i;

  public isMultiStepIntent(input: string): boolean {
    const clean = input.trim();
    if (!LocalTaskPlanner.SPLIT_REGEX.test(clean)) {
      return false;
    }

    const parts = clean.split(LocalTaskPlanner.SPLIT_REGEX).map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2;
  }

  public plan(input: string): TaskPlan | null {
    const clean = input.trim().replace(/[.]+$/, '');
    if (!this.isMultiStepIntent(clean)) {
      return null;
    }

    const segments = clean.split(LocalTaskPlanner.SPLIT_REGEX).map((s) => s.trim()).filter(Boolean);
    if (segments.length < 2) return null;

    const steps: PlannedStep[] = [];
    let previousStepTarget: string | undefined;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const stepNumber = i + 1;
      const stepId = `step-${Date.now()}-${stepNumber}`;

      // 1. Check if segment is a calculation
      if (SafeCalculator.isCalculation(seg) || SafeCalculator.calculate(seg)) {
        steps.push({
          id: stepId,
          stepNumber,
          type: 'CALCULATION_STEP',
          description: `Calculate: ${seg}`,
          calculationExpression: seg,
          command: {
            type: 'CALCULATE',
            target: seg,
            query: seg,
            originalInput: seg,
            normalizedInput: seg.toLowerCase(),
            confidence: 1.0,
            risk: 'LOW',
          },
        });
        continue;
      }

      // 2. Check if segment is a search query that contextually inherits provider from previous step
      // e.g. "Open YouTube" -> "search for Python Level 2 tutorials"
      let commandToParse = seg;
      if (
        /^(?:search|look\s+up|look\s+for|find\s+me\s+some|find\s+me|find)\s+(?:for\s+)?(.+)$/i.test(seg) &&
        !/^(?:search|look\s+up|look\s+for|find)\s+(?:youtube|google|web)\b/i.test(seg)
      ) {
        if (previousStepTarget && previousStepTarget.toLowerCase().includes('youtube')) {
          commandToParse = `Search YouTube for ${seg.replace(/^(?:search|look\s+up|look\s+for|find\s+me\s+some|find\s+me|find)\s+(?:for\s+)?/i, '')}`;
        } else if (previousStepTarget && previousStepTarget.toLowerCase().includes('chrome')) {
          commandToParse = `Search Google for ${seg.replace(/^(?:search|look\s+up|look\s+for|find\s+me\s+some|find\s+me|find)\s+(?:for\s+)?/i, '')}`;
        }
      }

      // 3. Parse via localCommandParser
      const parsed = localCommandParser.parse(commandToParse);
      if (parsed.type === 'UNKNOWN') {
        // Fallback: see if it can be parsed as a calculation
        if (SafeCalculator.calculate(seg)) {
          steps.push({
            id: stepId,
            stepNumber,
            type: 'CALCULATION_STEP',
            description: `Calculate: ${seg}`,
            calculationExpression: seg,
            command: {
              type: 'CALCULATE',
              target: seg,
              query: seg,
              originalInput: seg,
              normalizedInput: seg.toLowerCase(),
              confidence: 1.0,
              risk: 'LOW',
            },
          });
          continue;
        }
        return null; // Cannot securely plan an unrecognized segment
      }

      // Track target for contextual chaining
      previousStepTarget = parsed.target;

      let stepType: PlannedStep['type'] = 'APP_COMMAND';
      if (parsed.type === 'CALCULATE') {
        stepType = 'CALCULATION_STEP';
      } else if (parsed.type === 'OPEN_APP' || parsed.type === 'CLOSE_APP') {
        stepType = 'APP_COMMAND';
      } else if (parsed.type === 'OPEN_URL' || parsed.type === 'WEB_SEARCH' || parsed.type === 'EXTRACT_INFO') {
        stepType = 'BROWSER_COMMAND';
      } else if (
        parsed.type === 'OPEN_FOLDER' ||
        parsed.type === 'OPEN_FILE' ||
        parsed.type === 'CREATE_FILE' ||
        parsed.type === 'CREATE_FOLDER' ||
        parsed.type === 'MOVE_FILE' ||
        parsed.type === 'DELETE_FILE'
      ) {
        stepType = 'FILE_COMMAND';
      } else if (
        parsed.type === 'SYSTEM_SETTING' ||
        parsed.type === 'SLEEP' ||
        parsed.type === 'RESTART' ||
        parsed.type === 'SHUTDOWN'
      ) {
        stepType = 'SYSTEM_COMMAND';
      }

      steps.push({
        id: stepId,
        stepNumber,
        type: stepType,
        description: `Execute: [${parsed.type}] ${parsed.target || parsed.query || ''}`,
        command: parsed,
      });
    }

    if (steps.length < 2) return null;

    return {
      id: `plan-${Date.now()}`,
      originalGoal: input,
      steps,
      isMultiStep: steps.length > 1,
    };
  }

  /**
   * Builds a structured TaskPlan from an array of validated ParsedCommands (e.g. from AI Brain)
   */
  public planFromCommands(commands: ParsedCommand[], originalGoal: string): TaskPlan | null {
    if (!commands || commands.length < 2) return null;

    const steps: PlannedStep[] = [];
    for (let i = 0; i < commands.length; i++) {
      const parsed = commands[i];
      const stepNumber = i + 1;
      const stepId = `step-${Date.now()}-${stepNumber}`;

      let stepType: PlannedStep['type'] = 'APP_COMMAND';
      if (parsed.type === 'CALCULATE') {
        stepType = 'CALCULATION_STEP';
      } else if (parsed.type === 'OPEN_APP' || parsed.type === 'CLOSE_APP') {
        stepType = 'APP_COMMAND';
      } else if (parsed.type === 'OPEN_URL' || parsed.type === 'WEB_SEARCH' || parsed.type === 'EXTRACT_INFO') {
        stepType = 'BROWSER_COMMAND';
      } else if (
        parsed.type === 'OPEN_FOLDER' ||
        parsed.type === 'OPEN_FILE' ||
        parsed.type === 'CREATE_FILE' ||
        parsed.type === 'CREATE_FOLDER' ||
        parsed.type === 'MOVE_FILE' ||
        parsed.type === 'DELETE_FILE'
      ) {
        stepType = 'FILE_COMMAND';
      } else if (
        parsed.type === 'SYSTEM_SETTING' ||
        parsed.type === 'SLEEP' ||
        parsed.type === 'RESTART' ||
        parsed.type === 'SHUTDOWN'
      ) {
        stepType = 'SYSTEM_COMMAND';
      }

      steps.push({
        id: stepId,
        stepNumber,
        type: stepType,
        description: `Execute: [${parsed.type}] ${parsed.target || parsed.query || ''}`,
        command: parsed,
      });
    }

    return {
      id: `plan-${Date.now()}`,
      originalGoal,
      steps,
      isMultiStep: true,
    };
  }
}

export const localTaskPlanner = new LocalTaskPlanner();
export const taskPlanner = localTaskPlanner;
