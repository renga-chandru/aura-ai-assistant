# AURA — Project Standards & Rules (AGENTS.md)

This document specifies the mandatory architectural, design, performance, security, and coding standards for **AURA** across all development phases. Every feature, component, and module created in this repository MUST comply with these guidelines.

---

## 1. PRODUCT PHILOSOPHY & VISUAL IDENTITY
- **Hero Concept**: AURA is a futuristic personal AI assistant. The visual centerpiece is an intelligent, reactive 3D WebGL core floating in a deep-space environment.
- **Cinematic & Immersive**: The application MUST feel cinematic, dark, atmospheric, minimal, and technically sophisticated.
- **Strict Anti-Patterns**:
  - NO generic SaaS dashboards or grid admin panels.
  - NO cluttered sidebars or conventional chatbot text lists.
  - NO direct copies of existing assistants (e.g., JARVIS, ChatGPT web UI).
  - NO 2D glowing CSS circle placeholders—the core is powered by WebGL/Three.js shaders, particles, orbital geometry, and post-processing.
- **Color Palette**:
  - Dark Cinematic Foundation: Cosmic black (`#02040A`), deep space (`#080B18`), space navy (`#0A0B16`).
  - Primary Energy Signature: Warm amber (`#E5A93C` / `#FF9D00`), glowing gold (`#FFD700`), molten orange (`#FF5500`).
  - Secondary Accents: Subtle cyan/teal (`#3CE5D9` / `#00F0FF`) for data telemetry only.

---

## 2. PROJECT ARCHITECTURE & MODULARITY
Maintain clean separation of concerns inside `src/`:
- `src/app/` — Application entry, providers, global layout shell.
- `src/components/` — Generic reusable futuristic UI elements (HUD elements, glass overlays, minimal controls).
- `src/core/` — Core state machine definitions, system contracts, configuration.
- `src/features/` — Domain-specific feature modules.
- `src/scenes/` — Three.js / React Three Fiber 3D canvas and spatial scene compositions.
- `src/effects/` — Custom post-processing, shaders, glow, bloom, atmospheric distortion.
- `src/animations/` — Choreography, state transition logic, motion parameters.
- `src/audio/` — Web Audio API engine, audio-reactive spectrum analyzer, TTS/STT hooks.
- `src/ai/` — Abstract AI provider interface, adapter registry, prompt orchestrator.
- `src/commands/` — Controlled command pipeline, schema validator, permission guard.
- `src/system/` — Mac/OS platform bridge, system status, hardware telemetry.
- `src/hooks/` — Custom React & R3F hooks.
- `src/state/` — Centralized state stores (Zustand).
- `src/services/` — External API and runtime system services.
- `src/utils/` — Math, geometry, GLSL helpers, color manipulation.
- `src/styles/` — Design tokens, global CSS, glassmorphism utilities.
- `src/types/` — Strict TypeScript interface and type definitions.

---

## 3. STATE MODEL & SYSTEM BEHAVIOR
AURA operates on 5 fundamental states:
1. `IDLE` — Calm, rhythmic breathing pulse, slow orbital ring rotation, ambient cosmic particle drift.
2. `LISTENING` — Core expands, audio-reactive waveform micro-oscillations, energetic particle draw-in.
3. `THINKING` — High-speed ring counter-rotation, harmonic chromatic shift, accelerated shader frequency.
4. `SPEAKING` — Core dynamic modulation synchronized to audio amplitude/frequency, radiant light emission.
5. `EXECUTING` — Focused core stabilization, intense directional pulse, action status telemetry output.

Strict TypeScript union enforcement: `'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'EXECUTING'`

---

## 4. FUTURE AI ARCHITECTURE & SECURITY
- **Provider Abstraction**: All AI interactions must flow through `IAiProvider` adapter interfaces. Never couple UI components directly to OpenAI, Anthropic, Gemini, or local Ollama SDKs.
- **Key Management**: API keys must never be committed to repository code or exposed in frontend bundle artifacts. Always use secure environment variables and backend proxy wrappers.
- **Prompt Safety**: System prompts must enforce AURA's persona, structured JSON response format, and action intent payloads.

---

## 5. FUTURE COMPUTER CONTROL & PERMISSIONS
- **No Unrestricted Execution**: AURA must NEVER execute raw, arbitrary shell commands directly from AI outputs.
- **Controlled Command Pipeline**:
  `User Input -> AI Intent Parsing -> Structured Command Contract -> Validation Guard -> User Permission Prompt -> Safe Sandbox Execution -> Result telemetry`.
- **Permission Tiers**: Command types (File Read, App Launch, System Config, File Write/Delete) require explicit user permission toggles and audit logging.

---

## 6. VOICE PIPELINE & AUDIO-REACTIVITY
- **Decoupled STT / TTS**: Voice recognition (STT) and speech synthesis (TTS) must exist as independent service interfaces (`IVoiceService`).
- **Audio Reactivity**: Visual engines must subscribe to a centralized `AudioAnalyzer` frequency buffer to modulate core scale, shader noise, and particle velocity without triggering React re-renders.

---

## 7. PERFORMANCE & RENDERING DIRECTIVES
- **Target Frame Rate**: Smooth 60fps / 120fps experience on desktop hardware.
- **Render Loop Efficiency**: Execute 3D position and shader updates inside React Three Fiber's `useFrame` hook, bypassing React component state cycles.
- **Resource Cleanup**: Always register dispose handlers for Geometries, Materials, Textures, Shaders, and Web Audio Nodes.
- **Dynamic Quality Scaling**: Implement fallback settings (particle count reduction, post-processing bloom toggle) for lower-tier GPUs.

---

## 8. CODE QUALITY & VERIFICATION DIRECTIVES
- **TypeScript Strictness**: Zero implicit `any` usage. All props, state shapes, and API payloads must have explicit TypeScript types.
- **No Placeholders**: Never leave `TODO` stubs or hardcoded generic fallback strings in production code paths.
- **Verification Rule**: Every code change must compile cleanly with `npm run build` and pass TypeScript diagnostics (`npm run lint` / `oxlint`) before completion.
- **Phase Discipline**: Preserve existing working systems between phases. Do not skip phases or prematurely implement future phases until instructed.
