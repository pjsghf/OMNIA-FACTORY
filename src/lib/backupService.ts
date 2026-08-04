import { BookProject } from '../types';

export interface BackupManifest {
  version: string;
  createdAt: string;
  projectCount: number;
  totalChapters: number;
  totalWords: number;
  assetIds: string[];
  checksum: string;
}

export interface OmniaBackupPackage {
  format: 'omnia-backup-v2';
  manifest: BackupManifest;
  projects: BookProject[];
}

/**
 * Deterministic (non-cryptographic) hash for backup integrity checking.
 *
 * This is a classic 32-bit rolling hash (same construction as Java's
 * `String.hashCode`), not SHA-256 or similar — it is meant to catch accidental
 * corruption/truncation of a backup file, not to resist deliberate tampering. A
 * motivated attacker could construct a colliding payload; do not use this
 * checksum as a security boundary (e.g. to prove a backup was not maliciously
 * edited), only as a "did this get mangled in transit" sanity check.
 *
 * @param data - Serialized backup payload (the `JSON.stringify(projects)` string).
 * @returns Hex string of `Math.abs(hash)`. Deterministic: identical input always
 *   produces identical output, across runs and processes.
 */
export function calculateChecksum(data: string): string {
  let hash = 0;
  if (data.length === 0) return '0';
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Wraps a project list into a versioned, checksummed backup package for export.
 *
 * @param projects - The full in-memory project list (as held in `App.tsx` state /
 *   `localStorage`), including chapter content and any embedded base64 cover
 *   images — this can be large; callers should expect the returned JSON to be
 *   sized accordingly (the server's `/api/projects/backup` route parses it with
 *   a 50MB body limit for exactly this reason).
 * @returns An {@link OmniaBackupPackage}: `format` tag, a `manifest` (counts +
 *   {@link calculateChecksum} of the serialized `projects`), and the `projects`
 *   themselves, unmodified.
 */
export function createBackupPackage(projects: BookProject[]): OmniaBackupPackage {
  const totalChapters = projects.reduce((sum, p) => sum + (p.chapters?.length || 0), 0);
  const totalWords = projects.reduce(
    (sum, p) => sum + (p.chapters || []).reduce((cSum, c) => cSum + (c.wordCount || 0), 0),
    0
  );

  const assetIds: string[] = [];
  projects.forEach((p) => {
    if (p.metadata?.coverImageUrl) {
      assetIds.push(`cover_${p.id}`);
    }
  });

  const rawProjectsString = JSON.stringify(projects);
  const checksum = calculateChecksum(rawProjectsString);

  const manifest: BackupManifest = {
    version: '2.0.0',
    createdAt: new Date().toISOString(),
    projectCount: projects.length,
    totalChapters,
    totalWords,
    assetIds,
    checksum,
  };

  return {
    format: 'omnia-backup-v2',
    manifest,
    projects,
  };
}

/**
 * Validates and unwraps a backup file for restore, accepting both the current
 * `omnia-backup-v2` format and a legacy bare-array-of-projects format.
 *
 * Never throws — every rejection path (not an object, unrecognized format, no
 * projects array, zero valid projects after filtering) returns
 * `{ success: false, error }` instead, so callers (the restore UI) can always
 * render `error` directly without a try/catch.
 *
 * A checksum mismatch does NOT fail validation by itself — restoring a slightly
 * corrupted backup is still preferable to refusing outright, since the caller
 * (`ProjectListModal.tsx`) prompts the user to confirm before proceeding when
 * `checksumMismatch` is `true`. This function only detects and reports the
 * mismatch; it does not decide whether to proceed.
 *
 * @param backupPkg - Parsed JSON from an uploaded backup file. Typed `any`
 *   because it is, by definition, unvalidated external input at this point.
 * @returns `success`, the filtered list of structurally-valid `projects` (only
 *   entries with an `id`, `metadata`, and string `metadata.titulo` survive —
 *   silently dropping anything else), an `error` message on failure, and
 *   `checksumMismatch` when the manifest checksum does not match the payload.
 */
export function validateAndRestoreBackup(backupPkg: any): {
  success: boolean;
  projects?: BookProject[];
  error?: string;
  /** True when the manifest checksum does not match the payload (file was altered). */
  checksumMismatch?: boolean;
} {
  if (!backupPkg || typeof backupPkg !== 'object') {
    return { success: false, error: 'Pacote de backup inválido (formato não é objeto).' };
  }

  if (backupPkg.format !== 'omnia-backup-v2' && !Array.isArray(backupPkg.projects)) {
    // Check if it's a legacy array of projects
    if (Array.isArray(backupPkg)) {
      return { success: true, projects: backupPkg };
    }
    return { success: false, error: 'Formato de backup não reconhecido.' };
  }

  const projects: BookProject[] = backupPkg.projects;
  if (!Array.isArray(projects)) {
    return { success: false, error: 'Nenhum projeto encontrado no pacote de backup.' };
  }

  // Validate checksum if manifest exists.
  // A mismatch means the file was truncated or edited after export, so it is
  // reported to the caller instead of only reaching the console -- restoring a
  // corrupt backup over a good project is not recoverable.
  let checksumMismatch = false;
  if (backupPkg.manifest?.checksum) {
    const rawProjectsString = JSON.stringify(projects);
    const calculated = calculateChecksum(rawProjectsString);
    if (calculated !== backupPkg.manifest.checksum) {
      checksumMismatch = true;
      console.warn('Backup checksum mismatch, proceed with caution:', {
        expected: backupPkg.manifest.checksum,
        calculated,
      });
    }
  }

  // Basic validation of projects
  const validProjects = projects.filter(
    (p) => p && p.id && p.metadata && typeof p.metadata.titulo === 'string'
  );

  if (validProjects.length === 0) {
    return { success: false, error: 'Nenhum projeto válido encontrado no arquivo de backup.' };
  }

  return {
    success: true,
    projects: validProjects,
    checksumMismatch,
  };
}
