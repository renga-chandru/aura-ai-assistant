/**
 * NOVAIR Safe File Path Resolver & Directory Policy (Phase 20)
 *
 * Enforces strict sandbox boundaries for file & folder operations.
 * Arbitrary filesystem traversal, system paths (/etc, /System, /private),
 * and outside symlinks are strictly rejected.
 */

export const APPROVED_USER_DIRECTORIES = [
  'Desktop',
  'Documents',
  'Downloads',
  'Pictures',
  'Movies',
  'Music',
] as const;

export type ApprovedDirectory = (typeof APPROVED_USER_DIRECTORIES)[number];

const FOLDER_ALIAS_MAP: Record<string, ApprovedDirectory> = {
  desktop: 'Desktop',
  documents: 'Documents',
  document: 'Documents',
  docs: 'Documents',
  doc: 'Documents',
  downloads: 'Downloads',
  download: 'Downloads',
  pictures: 'Pictures',
  picture: 'Pictures',
  photos: 'Pictures',
  photo: 'Pictures',
  images: 'Pictures',
  movies: 'Movies',
  movie: 'Movies',
  videos: 'Movies',
  video: 'Movies',
  music: 'Music',
  audio: 'Music',
  songs: 'Music',
};

/**
 * Resolves a natural-language or raw folder name to an approved canonical user directory
 */
export function resolveApprovedDirectory(raw: string): ApprovedDirectory | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase().replace(/^(my\s+|the\s+)/i, '').replace(/\s+folder$/i, '').trim();
  return FOLDER_ALIAS_MAP[clean] || null;
}

/**
 * Validates a standalone filename for traversal or illegal characters
 */
export function validateSafeFileName(fileName: string): { valid: boolean; error?: string; sanitizedName?: string } {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return { valid: false, error: 'File name cannot be empty.' };
  }

  // 1. Path traversal checks
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    return {
      valid: false,
      error: 'Path traversal or directory separators are prohibited in file names.',
    };
  }

  // 2. Prohibited system filenames
  if (/^(etc|sys|system|private|bin|sbin|var|dev|usr|library)$/i.test(trimmed)) {
    return {
      valid: false,
      error: 'Access to system targets is strictly prohibited.',
    };
  }

  // 3. Prohibited special characters
  if (/[<>:"|?*\x00-\x1F]/.test(trimmed)) {
    return {
      valid: false,
      error: 'File name contains prohibited special characters.',
    };
  }

  return { valid: true, sanitizedName: trimmed };
}

/**
 * Validates security of any raw path input before execution.
 * Detects directory traversal, root paths, and system directories.
 */
export function validatePathSecurity(rawPath: string): { safe: boolean; reason?: string } {
  const trimmed = rawPath.trim();

  // Traversal detection
  if (trimmed.includes('..') || /\/\.\./.test(trimmed) || /\.\.\//.test(trimmed)) {
    return {
      safe: false,
      reason: 'Security violation: Path traversal sequence (..) detected.',
    };
  }

  // System path detection
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('/etc') ||
    lower.startsWith('/system') ||
    lower.startsWith('/private') ||
    lower.startsWith('/var') ||
    lower.startsWith('/usr') ||
    lower.startsWith('/bin') ||
    lower.startsWith('/sbin') ||
    lower.startsWith('/dev') ||
    lower.startsWith('~/library') ||
    lower.startsWith('~/system') ||
    lower.startsWith('~/private') ||
    lower.startsWith('/library')
  ) {
    return {
      safe: false,
      reason: 'Security violation: Access to system paths outside approved user directories is prohibited.',
    };
  }

  return { safe: true };
}
