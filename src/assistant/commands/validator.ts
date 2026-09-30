import { ParsedCommand, DesktopRiskLevel } from './types';
import { getCommandRiskLevel } from './parser';

/**
 * Command Intent Validator & Risk Classifier
 * Prepares structured intents for the permission and sandbox layers without executing OS commands.
 */
export class NovairCommandValidator {
  public static validateParsedCommand(parsed: ParsedCommand): boolean {
    if (parsed.type === 'UNKNOWN') return false;
    return parsed.confidence >= 0.70;
  }

  public static getRiskLevel(parsed: ParsedCommand): DesktopRiskLevel {
    return getCommandRiskLevel(parsed.type);
  }

  public static formatSummary(parsed: ParsedCommand): string {
    if (parsed.type === 'UNKNOWN') {
      return `Unrecognized Query: "${parsed.originalInput}"`;
    }

    let summary = `[${parsed.type}]`;
    if (parsed.target) {
      summary += ` Target: "${parsed.target}"`;
    }
    if (parsed.query) {
      summary += ` Query: "${parsed.query}"`;
    }
    if (parsed.destination) {
      summary += ` Dest: "${parsed.destination}"`;
    }
    summary += ` | Risk: ${parsed.risk} | Conf: ${Math.round(parsed.confidence * 100)}%`;
    return summary;
  }
}
