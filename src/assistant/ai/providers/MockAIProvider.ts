/**
 * Mock / Intelligent Local AI Provider (Phase 25)
 *
 * Provides realistic semantic AI responses for testing, offline operation,
 * or fallback when no remote LLM API key is configured.
 * Generates open-ended conversation, explanations, context tracking,
 * and structured action schemas.
 */

import { IAIProvider, AIProviderRequest, AIProviderResponse, AssistantAIResult } from '../types';

export class MockAIProvider implements IAIProvider {
  public readonly name = 'MockAIProvider';
  private simulateTimeout = false;
  private simulateMalformed = false;
  private simulateUnsupportedAction = false;

  public setSimulateTimeout(val: boolean) {
    this.simulateTimeout = val;
  }

  public setSimulateMalformed(val: boolean) {
    this.simulateMalformed = val;
  }

  public setSimulateUnsupportedAction(val: boolean) {
    this.simulateUnsupportedAction = val;
  }

  public async isAvailable(): Promise<boolean> {
    return !this.simulateTimeout;
  }

  public async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    if (this.simulateTimeout) {
      return {
        success: false,
        error: 'AI Provider request timed out.',
        provider: 'MockAI',
        model: 'sim-v1',
      };
    }

    if (this.simulateMalformed) {
      return {
        success: true,
        content: '{ broken json: true, ',
        provider: 'MockAI',
        model: 'sim-v1',
      };
    }

    if (this.simulateUnsupportedAction) {
      const unsupportedResult: AssistantAIResult = {
        type: 'action_request',
        message: 'I will run this system command.',
        actions: [
          {
            intent: 'UNRESTRICTED_SHELL_EXEC',
            rawTarget: 'rm -rf /',
          },
        ],
        confidence: 0.9,
      };
      return {
        success: true,
        content: JSON.stringify(unsupportedResult),
        rawStructured: unsupportedResult,
        provider: 'MockAI',
        model: 'sim-v1',
      };
    }

    const prompt = request.prompt.trim();
    const lower = prompt.toLowerCase();
    const history = request.contextHistory || [];

    // Context analysis from recent conversation history
    const recentAssistantContext = history
      .filter((h) => h.role === 'assistant')
      .map((h) => h.content.toLowerCase())
      .join(' ');
    const recentUserContext = history
      .filter((h) => h.role === 'user')
      .map((h) => h.content.toLowerCase())
      .join(' ');

    const hasAwsContext =
      recentAssistantContext.includes('aws') ||
      recentAssistantContext.includes('amazon web services') ||
      recentUserContext.includes('aws');

    let result: AssistantAIResult;

    // 1. Contextual follow-up: "What about S3?" or "Tell me about S3" with AWS context
    if ((lower.includes('what about s3') || lower.includes('what is s3') || lower.includes('tell me about s3')) && hasAwsContext) {
      result = {
        type: 'explanation',
        message:
          'Within AWS, Amazon S3 (Simple Storage Service) is an industry-standard object storage service offering 99.999999999% (11 9s) durability. It organizes data into buckets, making it ideal for hosting static assets, media archives, data lakes, and automated cloud backups.',
        confidence: 0.98,
      };
    }
    // 2. Open-ended conversation: Tiring / stressful day
    else if (lower.includes('tiring day') || lower.includes('long day') || lower.includes('exhausted') || lower.includes('hard day')) {
      result = {
        type: 'conversation',
        message:
          "I hear you. Take a deep breath and unwind—you've made it through the day. Would you like me to put on some quiet music, or is there anything light I can help wrap up for you?",
        confidence: 0.95,
      };
    }
    // 3. Open-ended inquiry: "Tell me something interesting"
    else if (lower.includes('tell me something interesting') || lower.includes('something cool') || lower.includes('interesting fact')) {
      result = {
        type: 'conversation',
        message:
          'Did you know that neutron stars are so dense that a single teaspoon of their material would weigh about 6 billion tons on Earth? Furthermore, they can spin hundreds of times every second, creating pulsar beams across space.',
        confidence: 0.95,
      };
    }
    // 4. Open-ended inquiry: "I'm bored"
    else if (lower.includes("i'm bored") || lower.includes('im bored') || lower.includes('bored')) {
      result = {
        type: 'conversation',
        message:
          "Let's change that! We could explore a fascinating tech topic, brainstorm project ideas, do a quick programming puzzle, or look up something new to learn. What sounds fun right now?",
        confidence: 0.92,
      };
    }
    // 5. Technical explanation: "Explain cloud computing"
    else if (lower.includes('cloud computing') || lower.includes('explain cloud')) {
      result = {
        type: 'explanation',
        message:
          'Cloud computing is the on-demand delivery of IT resources over the internet with pay-as-you-go pricing.\n\nKey Concepts:\n• Compute & Storage: Rather than maintaining physical servers in a closet, you rent processing power and virtual drives from providers like AWS, Azure, or GCP.\n• Scalability: Your app can automatically scale from 10 users to 10 million without buying hardware.\n• Core Service Models: Infrastructure as a Service (IaaS), Platform as a Service (PaaS), and Software as a Service (SaaS).',
        confidence: 0.96,
      };
    }
    // 6. Project brainstorming: "MCA project ideas" or "project ideas"
    else if (lower.includes('mca project') || lower.includes('project ideas') || lower.includes('project review')) {
      result = {
        type: 'explanation',
        message:
          'Here are three impactful MCA project concepts:\n\n1. Autonomous Desktop AI Agent: Local semantic intent orchestration with strict permission gating, audio reactivity, and zero shell exposure.\n2. Microservices Observability & Anomaly Pipeline: Real-time telemetry ingestion using OpenTelemetry, Apache Kafka, and automated latency anomaly detection.\n3. Zero-Knowledge Document Verification: A privacy-first verification portal using cryptographic proofs for credentials without exposing raw identity records.',
        confidence: 0.96,
      };
    }
    // 7. Interview preparation: "Help me prepare for an interview"
    else if (lower.includes('interview') || lower.includes('prepare for interview')) {
      result = {
        type: 'explanation',
        message:
          "To prepare effectively for your interview, focus on three pillars:\n\n1. Technical Core: Review fundamental data structures, system design tradeoffs, and time complexities.\n2. Architecture Rationale: Be prepared to articulate *why* you chose specific technologies in your projects.\n3. STAR Method: Structure behavioral questions around Situation, Task, Action, and Result.\n\nWould you like to practice a technical question together?",
        confidence: 0.95,
      };
    }
    // 8. General inquiry: "Tell me about AWS"
    else if (lower.includes('tell me about aws') || lower.includes('what is aws')) {
      result = {
        type: 'explanation',
        message:
          'Amazon Web Services (AWS) is a comprehensive cloud platform offering over 200 fully-featured services globally. It encompasses computing (EC2), managed storage (S3), relational and NoSQL databases (RDS, DynamoDB), and serverless execution (Lambda).',
        confidence: 0.96,
      };
    }
    // 9. Multi-step task: Chrome + search React + Documents
    else if (
      (lower.includes('open chrome') || lower.includes('launch chrome')) &&
      lower.includes('search') &&
      lower.includes('documents')
    ) {
      result = {
        type: 'multi_action_request',
        message: 'Opening Google Chrome, searching for React tutorials, and opening your Documents folder.',
        actions: [
          { intent: 'OPEN_APP', app: 'Google Chrome' },
          { intent: 'WEB_SEARCH', query: 'React tutorials' },
          { intent: 'OPEN_FOLDER', folder: 'Documents' },
        ],
        confidence: 0.98,
      };
    }
    // 10. Multi-step task: Chrome + search Python
    else if (
      (lower.includes('chrome') || lower.includes('browser')) &&
      (lower.includes('search') || lower.includes('find') || lower.includes('look for')) &&
      lower.includes('python')
    ) {
      result = {
        type: 'multi_action_request',
        message: 'Launching Google Chrome and searching for Python tutorials.',
        actions: [
          { intent: 'OPEN_APP', app: 'Google Chrome' },
          { intent: 'WEB_SEARCH', query: 'Python tutorials' },
        ],
        confidence: 0.98,
      };
    }
    // 11. High-risk computer action: Restart Mac
    else if (lower.includes('restart my mac') || lower.includes('restart the mac') || lower.includes('reboot my mac') || lower === 'restart') {
      result = {
        type: 'action_request',
        message: 'Initiating system restart request.',
        actions: [{ intent: 'RESTART', rawTarget: 'System' }],
        confidence: 0.99,
      };
    }
    // 12. High-risk computer action: Shutdown
    else if (lower.includes('shutdown') || lower.includes('shut down my mac') || lower === 'shutdown') {
      result = {
        type: 'action_request',
        message: 'Initiating system shutdown request.',
        actions: [{ intent: 'SHUTDOWN', rawTarget: 'System' }],
        confidence: 0.99,
      };
    }
    // 13. System Sleep
    else if (lower.includes('sleep my mac') || lower === 'sleep') {
      result = {
        type: 'action_request',
        message: 'Putting Mac to sleep.',
        actions: [{ intent: 'SLEEP', rawTarget: 'System' }],
        confidence: 0.99,
      };
    }
    // 14. File deletion (High-risk)
    else if (lower.includes('delete that file') || lower.includes('delete file') || lower.includes('remove file')) {
      const fileMatch = lower.match(/(?:delete|remove)\s+(?:file\s+|that\s+file\s+)?([a-zA-Z0-9._-]+)/i);
      const fileName = fileMatch && fileMatch[1] && fileMatch[1] !== 'file' ? fileMatch[1] : 'target_file.txt';
      result = {
        type: 'action_request',
        message: 'Requesting file deletion.',
        actions: [{ intent: 'DELETE_FILE', file: fileName }],
        confidence: 0.9,
      };
    }
    // 15. Ambiguous commands requiring clarification
    else if (/^(?:can\s+you\s+|please\s+)?open\s+it\b/i.test(lower)) {
      result = {
        type: 'clarification',
        message: 'What would you like me to open?',
        clarificationNeeded: true,
        clarificationQuestion: 'What would you like me to open?',
        confidence: 0.95,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?move\s+this\s+file\b/i.test(lower)) {
      result = {
        type: 'clarification',
        message: 'Where should I move it?',
        clarificationNeeded: true,
        clarificationQuestion: 'Where should I move it?',
        confidence: 0.95,
      };
    }
    // 16. App open actions
    else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+calculator\b/i.test(lower) || lower === 'calculator') {
      result = {
        type: 'action_request',
        message: 'Opening Calculator.',
        actions: [{ intent: 'OPEN_APP', app: 'Calculator' }],
        confidence: 0.98,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+(?:google\s+)?chrome\b/i.test(lower) || lower === 'chrome') {
      result = {
        type: 'action_request',
        message: 'Opening Google Chrome.',
        actions: [{ intent: 'OPEN_APP', app: 'Google Chrome' }],
        confidence: 0.98,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+finder\b/i.test(lower) || lower === 'finder') {
      result = {
        type: 'action_request',
        message: 'Opening Finder.',
        actions: [{ intent: 'OPEN_APP', app: 'Finder' }],
        confidence: 0.98,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+safari\b/i.test(lower) || lower === 'safari') {
      result = {
        type: 'action_request',
        message: 'Opening Safari.',
        actions: [{ intent: 'OPEN_APP', app: 'Safari' }],
        confidence: 0.98,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+notes\b/i.test(lower) || lower === 'notes') {
      result = {
        type: 'action_request',
        message: 'Opening Notes.',
        actions: [{ intent: 'OPEN_APP', app: 'Notes' }],
        confidence: 0.98,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+terminal\b/i.test(lower) || lower === 'terminal') {
      result = {
        type: 'action_request',
        message: 'Opening Terminal.',
        actions: [{ intent: 'OPEN_APP', app: 'Terminal' }],
        confidence: 0.98,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+(?:vs\s*code|visual\s+studio\s+code|code)\b/i.test(lower)) {
      result = {
        type: 'action_request',
        message: 'Opening Visual Studio Code.',
        actions: [{ intent: 'OPEN_APP', app: 'Visual Studio Code' }],
        confidence: 0.98,
      };
    } else if (/^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+(?:settings|system\s+preferences|system\s+settings)\b/i.test(lower)) {
      result = {
        type: 'action_request',
        message: 'Opening System Preferences.',
        actions: [{ intent: 'OPEN_APP', app: 'System Preferences' }],
        confidence: 0.98,
      };
    }
    // 17. App close actions
    else if (/^(?:can\s+you\s+|please\s+)?(?:close|quit)\s+([a-zA-Z\s]+)/i.test(lower)) {
      const appMatch = lower.match(/(?:close|quit)\s+([a-zA-Z\s]+)/i);
      const rawAppName = appMatch ? appMatch[1].trim() : 'Google Chrome';
      result = {
        type: 'action_request',
        message: `Closing ${rawAppName}.`,
        actions: [{ intent: 'CLOSE_APP', app: rawAppName }],
        confidence: 0.98,
      };
    }
    // 18. Web search actions
    else if (/^(?:search\s+google\s+for|search\s+for|google|search)\s+(.+)/i.test(lower)) {
      const qMatch = lower.match(/(?:search\s+google\s+for|search\s+for|google|search)\s+(.+)/i);
      const query = qMatch ? qMatch[1].trim() : prompt;
      result = {
        type: 'action_request',
        message: `Searching Google for ${query}.`,
        actions: [{ intent: 'WEB_SEARCH', query }],
        confidence: 0.98,
      };
    }
    // 19. Open URL actions
    else if (/^open\s+(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.(?:com|org|net|io|edu|gov|dev)[^\s]*)/i.test(lower)) {
      const urlMatch = prompt.match(/^open\s+([^\s]+)/i);
      const url = urlMatch ? urlMatch[1].trim() : prompt;
      result = {
        type: 'action_request',
        message: `Opening ${url}.`,
        actions: [{ intent: 'OPEN_URL', url }],
        confidence: 0.98,
      };
    }
    // 20. Folder open actions
    else if (/^open\s+(?:folder\s+)?(documents|downloads|desktop|movies|music|pictures)\b/i.test(lower)) {
      const fMatch = lower.match(/^open\s+(?:folder\s+)?(documents|downloads|desktop|movies|music|pictures)/i);
      const folder = fMatch ? fMatch[1].charAt(0).toUpperCase() + fMatch[1].slice(1).toLowerCase() : 'Documents';
      result = {
        type: 'action_request',
        message: `Opening ${folder} folder.`,
        actions: [{ intent: 'OPEN_FOLDER', folder }],
        confidence: 0.98,
      };
    }
    // 21. File actions
    else if (/^open\s+file\s+(.+)/i.test(lower)) {
      const fileMatch = prompt.match(/^open\s+file\s+(.+)/i);
      const file = fileMatch ? fileMatch[1].trim() : '';
      result = {
        type: 'action_request',
        message: `Opening file ${file}.`,
        actions: [{ intent: 'OPEN_FILE', file }],
        confidence: 0.98,
      };
    } else if (/^create\s+file\s+(.+)/i.test(lower)) {
      const fileMatch = prompt.match(/^create\s+file\s+(.+)/i);
      const file = fileMatch ? fileMatch[1].trim() : '';
      result = {
        type: 'action_request',
        message: `Creating file ${file}.`,
        actions: [{ intent: 'CREATE_FILE', file }],
        confidence: 0.98,
      };
    } else if (/^move\s+file\s+(.+)\s+to\s+(.+)/i.test(lower)) {
      const moveMatch = prompt.match(/^move\s+file\s+(.+)\s+to\s+(.+)/i);
      const file = moveMatch ? moveMatch[1].trim() : '';
      const destination = moveMatch ? moveMatch[2].trim() : 'Documents';
      result = {
        type: 'action_request',
        message: `Moving file ${file} to ${destination}.`,
        actions: [{ intent: 'MOVE_FILE', file, destination }],
        confidence: 0.98,
      };
    }
    // 22. System volume settings
    else if (lower.includes('volume up') || lower.includes('increase volume')) {
      result = {
        type: 'action_request',
        message: 'Increasing system volume.',
        actions: [{ intent: 'SYSTEM_SETTING', setting: 'volume_up' }],
        confidence: 0.98,
      };
    } else if (lower.includes('volume down') || lower.includes('decrease volume')) {
      result = {
        type: 'action_request',
        message: 'Decreasing system volume.',
        actions: [{ intent: 'SYSTEM_SETTING', setting: 'volume_down' }],
        confidence: 0.98,
      };
    } else if (lower === 'mute' || lower.includes('mute audio') || lower.includes('mute volume')) {
      result = {
        type: 'action_request',
        message: 'Muting system audio.',
        actions: [{ intent: 'SYSTEM_SETTING', setting: 'mute' }],
        confidence: 0.98,
      };
    } else if (lower === 'unmute' || lower.includes('unmute audio')) {
      result = {
        type: 'action_request',
        message: 'Unmuting system audio.',
        actions: [{ intent: 'SYSTEM_SETTING', setting: 'unmute' }],
        confidence: 0.98,
      };
    }
    // 23. Default open-ended conversational response
    else {
      result = {
        type: 'conversation',
        message: `I understand. I'm here to help you with that or assist with your Mac whenever you need.`,
        confidence: 0.85,
      };
    }

    return {
      success: true,
      content: JSON.stringify(result),
      rawStructured: result,
      provider: 'MockAI',
      model: 'sim-v1',
    };
  }
}
