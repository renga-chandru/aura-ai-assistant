/**
 * AURA Semantic Normalizer (Phase 24)
 *
 * Normalizes natural speech variations, handles contractions, politeness wrappers,
 * punctuation, and speech-recognition artifacts without hardcoding complete sentences.
 */

export class SemanticNormalizer {
  /**
   * Expands common English contractions
   */
  public static expandContractions(text: string): string {
    return text
      .replace(/\bhow's\b/gi, 'how is')
      .replace(/\bwhat's\b/gi, 'what is')
      .replace(/\bwho's\b/gi, 'who is')
      .replace(/\bwhere's\b/gi, 'where is')
      .replace(/\bthere's\b/gi, 'there is')
      .replace(/\bit's\b/gi, 'it is')
      .replace(/\bcan't\b/gi, 'cannot')
      .replace(/\bdon't\b/gi, 'do not')
      .replace(/\bwon't\b/gi, 'will not')
      .replace(/\bi'm\b/gi, 'i am')
      .replace(/\byou're\b/gi, 'you are')
      .replace(/\bwe're\b/gi, 'we are')
      .replace(/\bthey're\b/gi, 'they are')
      .replace(/\bi've\b/gi, 'i have')
      .replace(/\byou've\b/gi, 'you have')
      .replace(/\bi'd\s+like\s+to\b/gi, 'i want to')
      .replace(/\bi'd\b/gi, 'i would')
      .replace(/\byou'd\b/gi, 'you would')
      .replace(/\bi'll\b/gi, 'i will')
      .replace(/\byou'll\b/gi, 'you will')
      .replace(/\blet's\b/gi, 'let us');
  }

  /**
   * Normalizes raw user input into a clean semantic form
   */
  public static normalize(input: string): string {
    let clean = input.trim();
    if (!clean) return '';

    // Expand contractions
    clean = this.expandContractions(clean);

    // Remove trailing sentence punctuation
    clean = clean.replace(/[?.!]+$/g, '').trim();

    // Preserve greeting word if input is solely a greeting address (e.g. "Hi AURA" -> "hi")
    if (/^(?:hey|hi|hello|yo|greetings)\s+aura\b/i.test(clean)) {
      const greetingWord = clean.match(/^(?:hey|hi|hello|yo|greetings)/i)?.[0].toLowerCase() || 'hello';
      clean = clean.replace(/^(?:hey|hi|hello|yo|greetings)\s+aura\b[,:]?\s*/i, '').trim();
      if (!clean) return greetingWord;
    }

    if (clean.toLowerCase() === 'aura') {
      return 'hello';
    }

    // Strip assistant address (prefix)
    clean = clean.replace(/^aura\b[,:]?\s*/i, '');

    // Strip assistant address (suffix)
    clean = clean.replace(/[,]?\s*(?:hey|hi|hello|yo)?\s*aura$/i, '').trim();

    // Strip polite leading conversational fillers
    const leadingFillers = [
      /^(?:can\s+you\s+please|could\s+you\s+please|would\s+you\s+please|would\s+you\s+mind(?:\s+to)?|will\s+you\s+please)\b[,:]?\s*/i,
      /^(?:can\s+you|could\s+you|would\s+you|will\s+you)\b[,:]?\s*/i,
      /^(?:please|kindly|just|go\s+ahead\s+and|feel\s+free\s+to)\b[,:]?\s*/i,
      /^(?:i\s+want\s+to|i\s+would\s+like\s+to|i\s+need\s+to|help\s+me)\b[,:]?\s*/i,
      /^(?:show\s+me|display)\b[,:]?\s*/i,
    ];

    for (const filler of leadingFillers) {
      if (filler.test(clean)) {
        clean = clean.replace(filler, '').trim();
      }
    }

    // Strip polite trailing conversational fillers
    clean = clean.replace(/\b(?:for\s+me|please|if\s+you\s+can|if\s+possible|right\s+now)$/i, '').trim();

    // Collapse multiple spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
  }
}
