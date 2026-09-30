import { CalculationResult } from './types';

/**
 * Safe Mathematical Expression Evaluator (Phase 23 & Phase 28.1)
 *
 * Implements a secure recursive descent parser for arithmetic operations.
 * CRITICAL SECURITY:
 * - NEVER uses eval() or new Function().
 * - NEVER executes arbitrary JavaScript or shell code.
 * - Strictly bounded to numeric operations (+, -, *, /, %, ^).
 */
export class SafeCalculator {
  /**
   * Fast detection of calculation intent across natural language patterns
   */
  public static isCalculation(input: string): boolean {
    const clean = input.trim().toLowerCase();

    // Check for explicit calculation verbs
    const calcVerbs = /^(?:what\s+is|what's|calculate|solve|evaluate|compute|perform|work\s+out|find|do)\s+/i;
    if (calcVerbs.test(clean)) {
      const rest = clean.replace(calcVerbs, '').replace(/[?!.]+$/, '').trim();
      if (this.containsMathPatterns(rest)) return true;
    }

    // Direct percentage questions: "what is 25% of 200" or "25% of 200"
    if (/\b\d+(?:\.\d+)?\s*%\s+of\s+\d+/i.test(clean)) {
      return true;
    }

    // Direct arithmetic statements: "2+2", "25 times 4", "100 divided by 5", "50 minus 20", "9 squared"
    return this.containsMathPatterns(clean);
  }

  private static containsMathPatterns(str: string): boolean {
    let trimmed = str
      .replace(/[?!.]+$/, '')
      .replace(/(?:,\s*)?(?:and|then)?\s*(?:tell|show)\s+me\s+(?:the\s+)?(?:result|answer|outcome).*/i, '')
      .trim();

    // Check for squared / cubed / power
    if (/\b\d+(?:\.\d+)?\s*(?:squared|cubed|\^)\b/i.test(trimmed)) {
      return true;
    }

    // Words indicating arithmetic
    if (/\b\d+\s*(?:times|multiplied\s+by|divided\s+by|plus|minus|over|\+|\*|\/|\^)\s*\d+/i.test(trimmed)) {
      return true;
    }

    // Simple symbols: e.g. "2+2", "10 - 4", "25*4", "100 / 5", "12 x 8", "9^2"
    if (/^\s*\(?\s*\d+(?:\.\d+)?\s*(?:[+\-*/x\^]|times|plus|minus)\s*\(?\s*\d+/i.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Safely calculates the answer to an arithmetic expression
   */
  public static calculate(rawInput: string): CalculationResult | null {
    const cleanInput = rawInput.trim();
    if (!cleanInput) return null;

    // 1. Percentage check: e.g. "25% of 200" or "what is 25% of 200?"
    const pctMatch = cleanInput.match(/(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)/i);
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      const total = parseFloat(pctMatch[2]);
      if (!isNaN(pct) && !isNaN(total)) {
        const result = (pct / 100) * total;
        const formattedResult = this.formatNumber(result);
        return {
          expression: `${pct}% of ${total}`,
          result,
          formattedAnswer: `${pct}% of ${total} is ${formattedResult}.`,
        };
      }
    }

    // 2. Strip conversational prefixes & suffixes
    let expr = cleanInput
      .replace(/^(?:can\s+you\s+|could\s+you\s+|please\s+|hey\s+aura\s+|aura\s+|hey\s+novair\s+|novair\s+)/i, '')
      .replace(/^(?:what\s+is|what's|calculate|solve|evaluate|compute|perform|work\s+out|find|do|now\s+calculate|tell\s+me)\s+/i, '')
      .replace(/(?:,\s*)?(?:and|then)?\s*(?:tell|show)\s+me\s+(?:the\s+)?(?:result|answer|outcome).*/i, '')
      .replace(/[?!.]+$/, '')
      .trim();

    const originalExprWords = expr;

    // 3. Replace natural words with symbols
    expr = expr
      .replace(/\braised\s+to\s+the\s+power\s+of\b/gi, '^')
      .replace(/\bto\s+the\s+power\s+of\b/gi, '^')
      .replace(/\bto\s+the\s+power\b/gi, '^')
      .replace(/(\d+(?:\.\d+)?)\s*squared\b/gi, '$1 ^ 2')
      .replace(/(\d+(?:\.\d+)?)\s*cubed\b/gi, '$1 ^ 3')
      .replace(/\bmultiply\s+(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)\b/gi, '$1 * $2')
      .replace(/\bdivide\s+(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)\b/gi, '$1 / $2')
      .replace(/\badd\s+(\d+(?:\.\d+)?)\s+(?:and|to)\s+(\d+(?:\.\d+)?)\b/gi, '$1 + $2')
      .replace(/\bsubtract\s+(\d+(?:\.\d+)?)\s+from\s+(\d+(?:\.\d+)?)\b/gi, '$2 - $1')
      .replace(/\bmultiplied\s+by\b/gi, '*')
      .replace(/\btimes\b/gi, '*')
      .replace(/\bdivided\s+by\b/gi, '/')
      .replace(/\bover\b/gi, '/')
      .replace(/\bplus\b/gi, '+')
      .replace(/\bminus\b/gi, '-')
      .replace(/\bsubtract\b/gi, '-')
      .replace(/\b(\d+)\s*[xX]\s*(\d+)\b/g, '$1 * $2');

    // 4. Strict Security Guard: Only allow valid characters [0-9 + - * / ^ ( ) . \s]
    if (!/^[0-9+\-*/^().\s]+$/.test(expr)) {
      return null;
    }

    // Ensure there are digits and operators
    if (!/\d/.test(expr) || !/[+\-*/^]/.test(expr)) {
      return null;
    }

    try {
      const result = this.parseAndEvaluate(expr);
      if (result === null || !isFinite(result)) {
        return null;
      }

      const formattedResult = this.formatNumber(result);
      // Construct a friendly, conversational answer
      let formattedAnswer = `${formattedResult}.`;
      if (originalExprWords.length > 0 && originalExprWords.length < 30) {
        formattedAnswer = `${originalExprWords.trim()} is ${formattedResult}.`;
      } else {
        formattedAnswer = `${expr.trim()} = ${formattedResult}.`;
      }

      return {
        expression: originalExprWords,
        result,
        formattedAnswer,
      };
    } catch {
      return null;
    }
  }

  private static formatNumber(num: number): string {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    // Round to max 4 decimal places and remove trailing zeros
    return parseFloat(num.toFixed(4)).toString();
  }

  /**
   * Deterministic Recursive Descent Parser for safe arithmetic AST evaluation
   */
  private static parseAndEvaluate(expr: string): number | null {
    const tokens = this.tokenize(expr);
    if (tokens.length === 0) return null;

    let index = 0;

    const peek = (): string | undefined => tokens[index];
    const consume = (): string => tokens[index++];

    const parseExpression = (): number => {
      let value = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const nextTerm = parseTerm();
        if (op === '+') value += nextTerm;
        else value -= nextTerm;
      }
      return value;
    };

    const parseTerm = (): number => {
      let value = parsePower();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const nextPower = parsePower();
        if (op === '*') {
          value *= nextPower;
        } else {
          if (nextPower === 0) {
            throw new Error('Division by zero');
          }
          value /= nextPower;
        }
      }
      return value;
    };

    const parsePower = (): number => {
      let value = parseFactor();
      while (peek() === '^') {
        consume();
        const nextFactor = parseFactor();
        value = Math.pow(value, nextFactor);
      }
      return value;
    };

    const parseFactor = (): number => {
      // Unary operator (+ or -)
      if (peek() === '+') {
        consume();
        return parseFactor();
      }
      if (peek() === '-') {
        consume();
        return -parseFactor();
      }

      const token = peek();
      if (!token) throw new Error('Unexpected end of expression');

      if (token === '(') {
        consume(); // Consume '('
        const value = parseExpression();
        if (consume() !== ')') {
          throw new Error("Missing closing parenthesis ')'");
        }
        return value;
      }

      // Must be a number
      if (/^\d+(?:\.\d+)?$/.test(token)) {
        consume();
        return parseFloat(token);
      }

      throw new Error(`Unexpected token: ${token}`);
    };

    const finalResult = parseExpression();
    if (index !== tokens.length) {
      throw new Error('Unparsed tokens remaining');
    }

    return finalResult;
  }

  private static tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    const len = expr.length;

    while (i < len) {
      const ch = expr[i];

      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      if ('+-*/^()'.includes(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }

      if (/\d|\./.test(ch)) {
        let numStr = '';
        while (i < len && (/\d/.test(expr[i]) || expr[i] === '.')) {
          numStr += expr[i];
          i++;
        }
        tokens.push(numStr);
        continue;
      }

      // Any illegal character
      throw new Error(`Illegal character in calculation: ${ch}`);
    }

    return tokens;
  }
}

