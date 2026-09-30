/**
 * NOVAIR System Action Registry (Phase 21)
 *
 * Defines strictly allowlisted system settings and actions.
 * Arbitrary macOS settings, arbitrary defaults, sudo, kill, launchctl,
 * and arbitrary AppleScript are strictly prohibited.
 */

export type AllowedSystemSetting = 'volume_up' | 'volume_down' | 'mute' | 'unmute';

export interface SystemSettingDefinition {
  id: AllowedSystemSetting;
  name: string;
  description: string;
  aliases: string[];
}

export const SYSTEM_SETTINGS_REGISTRY: Record<AllowedSystemSetting, SystemSettingDefinition> = {
  volume_up: {
    id: 'volume_up',
    name: 'Volume Up',
    description: 'Increases the macOS audio output volume by 10%.',
    aliases: [
      'volume up',
      'increase volume',
      'turn volume up',
      'turn the volume up',
      'turn up volume',
      'turn up the volume',
      'turn it up',
      'raise volume',
      'louder',
      'make it louder',
      'boost volume',
    ],
  },
  volume_down: {
    id: 'volume_down',
    name: 'Volume Down',
    description: 'Decreases the macOS audio output volume by 10%.',
    aliases: [
      'volume down',
      'decrease volume',
      'turn volume down',
      'turn the volume down',
      'turn down volume',
      'turn down the volume',
      'turn it down',
      'lower volume',
      'lower the volume',
      'softer',
      'make it softer',
      'reduce volume',
    ],
  },
  mute: {
    id: 'mute',
    name: 'Mute Audio',
    description: 'Mutes macOS audio output.',
    aliases: [
      'mute',
      'mute my mac',
      'mute the mac',
      'mute audio',
      'mute volume',
      'mute sound',
      'silence',
      'silence audio',
      'turn off sound',
    ],
  },
  unmute: {
    id: 'unmute',
    name: 'Unmute Audio',
    description: 'Unmutes macOS audio output.',
    aliases: [
      'unmute',
      'unmute my mac',
      'unmute the mac',
      'unmute audio',
      'unmute volume',
      'unmute sound',
      'restore sound',
      'turn on sound',
    ],
  },
};

/**
 * Resolves a natural-language input to an allowlisted system setting ID
 */
export function resolveSystemSetting(rawInput: string): AllowedSystemSetting | null {
  if (!rawInput) return null;
  const clean = rawInput.trim().toLowerCase().replace(/^(please|hey aura|aura|hey novair|novair|can you|could you)\s+/i, '').trim();

  // 1. Check exact IDs or definition names
  for (const [id, def] of Object.entries(SYSTEM_SETTINGS_REGISTRY)) {
    if (clean === id || clean === def.name.toLowerCase()) {
      return id as AllowedSystemSetting;
    }
  }

  // 2. Check exact alias match
  for (const [id, def] of Object.entries(SYSTEM_SETTINGS_REGISTRY)) {
    for (const alias of def.aliases) {
      if (clean === alias) {
        return id as AllowedSystemSetting;
      }
    }
  }

  // 3. Check word-boundary match (checking unmute before mute to prevent substring overlap)
  const priorityOrder: AllowedSystemSetting[] = ['unmute', 'mute', 'volume_up', 'volume_down'];
  for (const id of priorityOrder) {
    const def = SYSTEM_SETTINGS_REGISTRY[id];
    for (const alias of def.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(clean)) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Standard confirmation messages required for High-Risk system operations
 */
export const SYSTEM_CONFIRMATION_PROMPTS: Record<'SLEEP' | 'RESTART' | 'SHUTDOWN', string> = {
  SLEEP: 'Put your Mac to sleep? The display and system will enter sleep mode.',
  RESTART: 'Restart your Mac? This will close running applications and restart the system.',
  SHUTDOWN: 'Shut down your Mac? This will close all applications and power off the system.',
};
