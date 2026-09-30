# AURA

**Personal AI Desktop Assistant**

AURA (Advanced Universal Reactive Assistant) is a futuristic personal AI desktop assistant designed to transform human-computer interaction through an immersive, cinematic visual experience. Centered around a living WebGL intelligence core, AURA responds dynamically to voice and text while safely performing desktop automation tasks.

## Overview

AURA moves beyond conventional chatbots and SaaS dashboards by offering a highly visual, audio-reactive 3D interface. Through safe, schema-validated OS integrations, AURA acts as a bridge between powerful AI models and your local desktop environment. 

## Key Capabilities

- **Audio-Reactive Intelligence Core**: A multi-layered 3D WebGL core that responds to speech frequencies, varying its visual state based on system context (Idle, Listening, Thinking, Speaking, Executing).
- **Voice & Text Modality**: Seamlessly transition between Web Speech API voice commands and a futuristic terminal command bar.
- **Contextual Memory**: Remembers prior conversation steps, file references, and calculations for a natural follow-up experience.
- **Desktop Automation**: Performs controlled local tasks like opening applications, manipulating files, searching the web, and adjusting system settings.

## Supported Desktop Actions

- **Applications**: Open and close OS applications (Calculator, Chrome, Safari, Finder, Terminal, VS Code, Notes).
- **Files & Folders**: Open directories, create files, read files, move files.
- **System Control**: Adjust volume, mute/unmute, sleep, restart, shutdown (requires confirmation).
- **Browser Actions**: Search the web, navigate to URLs, and extract real-time web context.

## Security Model

AURA is built with a rigorous security-first architecture. It **never executes arbitrary shell commands** from an AI prompt.
- **Strict Command Schema**: The AI must produce JSON matching defined action types. 
- **Application Sandbox**: Only explicit actions mapped to allowed system scripts are permitted.
- **Path Traversal Protection**: Prevents access outside designated safe directories.
- **Confirmation Guards**: High-risk actions (Restart, Shutdown, Delete File) mandate explicit user confirmation.
- **No Secret Leakage**: API credentials and secrets remain out of the client bundle.

## Architecture & Technology Stack

**Frontend Framework**: React 19, TypeScript, Vite
**3D & Graphics**: Three.js, React Three Fiber (R3F), `@react-three/drei`, Custom GLSL Shaders
**State Management**: Zustand
**Styling**: Tailwind CSS, Vanilla CSS Design Tokens
**Voice**: Web Audio API, Web Speech API (STT / TTS)

```
User Input -> AI Intent Parsing -> Command Schema Contract -> Validation Guard -> Permission Toggle -> OS Sandbox Execution
```

## Setup & Installation

**Prerequisites:**
- Node.js (v18+)
- macOS (for native desktop automation actions)

```bash
# Clone the repository
git clone https://github.com/your-username/project-aura.git
cd project-aura

# Install dependencies
npm install
```

## Environment Configuration

Create a `.env` file in the root directory from the `.env.example`:

```bash
cp .env.example .env
```

Populate the required environment variables:
- `AURA_AI_API_KEY`: Your provider API key (OpenAI, Anthropic, Gemini, etc.)
- `AURA_AI_PROVIDER`: The AI provider engine to use.

## Run Commands

```bash
# Start the development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## Testing

AURA includes a comprehensive test suite for security enforcement, command pipelines, and execution edge cases.

```bash
# Run all phase integration tests
npx tsx tests/phase*.test.ts
```

## Limitations

- **Platform**: AURA's local desktop executors are optimized for macOS.
- **Voice Synthesis**: Dependent on browser-native SpeechSynthesis support.
- **Execution Sandboxing**: Commands strictly limited to pre-approved workflows; arbitrary OS management is blocked by design for safety.
