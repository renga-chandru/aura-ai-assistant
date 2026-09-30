import { AppRegistryEntry } from './types';

/**
 * Central Allowlist Application Registry (Phase 18)
 * Strict mapping between user-facing application names, aliases, and official macOS bundle identifiers.
 * Only applications listed here can be launched or closed. Arbitrary processes are strictly rejected.
 */
export const APP_REGISTRY: AppRegistryEntry[] = [
  {
    canonicalName: 'Google Chrome',
    aliases: ['Chrome', 'Google Chrome'],
    bundleId: 'com.google.Chrome',
    allowedActions: ['OPEN_APP', 'CLOSE_APP'],
    description: 'Google Chrome Web Browser',
  },
  {
    canonicalName: 'Safari',
    aliases: ['Safari', 'Apple Safari'],
    bundleId: 'com.apple.Safari',
    allowedActions: ['OPEN_APP', 'CLOSE_APP'],
    description: 'Apple Safari Web Browser',
  },
  {
    canonicalName: 'Finder',
    aliases: ['Finder', 'macOS Finder'],
    bundleId: 'com.apple.finder',
    allowedActions: ['OPEN_APP'],
    description: 'macOS File Manager',
  },
  {
    canonicalName: 'Notes',
    aliases: ['Notes', 'Apple Notes'],
    bundleId: 'com.apple.Notes',
    allowedActions: ['OPEN_APP', 'CLOSE_APP'],
    description: 'Apple Notes Application',
  },
  {
    canonicalName: 'Calculator',
    aliases: ['Calculator', 'Apple Calculator'],
    bundleId: 'com.apple.calculator',
    allowedActions: ['OPEN_APP', 'CLOSE_APP'],
    description: 'macOS Calculator Utility',
  },
  {
    canonicalName: 'Terminal',
    aliases: ['Terminal', 'Apple Terminal'],
    bundleId: 'com.apple.Terminal',
    allowedActions: ['OPEN_APP', 'CLOSE_APP'],
    description: 'macOS Terminal Emulator',
  },
  {
    canonicalName: 'System Settings',
    aliases: ['System Settings', 'System Preferences', 'Settings', 'Preferences'],
    bundleId: 'com.apple.systempreferences',
    allowedActions: ['OPEN_APP', 'CLOSE_APP'],
    description: 'macOS System Settings',
  },
  {
    canonicalName: 'Visual Studio Code',
    aliases: ['Visual Studio Code', 'VS Code', 'VSCode', 'Code'],
    bundleId: 'com.microsoft.VSCode',
    allowedActions: ['OPEN_APP', 'CLOSE_APP'],
    description: 'Microsoft Visual Studio Code Editor',
  },
];

/**
 * Resolves a natural-language target name or alias against the trusted application registry.
 */
export function resolveApp(target: string): AppRegistryEntry | undefined {
  if (!target) return undefined;
  const normalized = target.trim().toLowerCase();

  return APP_REGISTRY.find((entry) => {
    if (entry.canonicalName.toLowerCase() === normalized) return true;
    return entry.aliases.some((alias) => alias.toLowerCase() === normalized);
  });
}

/**
 * Checks whether an application is officially supported in the registry.
 */
export function isAppSupported(target: string): boolean {
  return resolveApp(target) !== undefined;
}

/**
 * Returns all allowlisted application canonical names.
 */
export function getAllSupportedAppNames(): string[] {
  return APP_REGISTRY.map((e) => e.canonicalName);
}
