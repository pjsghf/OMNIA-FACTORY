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

// Simple deterministic hash calculation for checksum verification
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

export function validateAndRestoreBackup(backupPkg: any): {
  success: boolean;
  projects?: BookProject[];
  error?: string;
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

  // Validate checksum if manifest exists
  if (backupPkg.manifest?.checksum) {
    const rawProjectsString = JSON.stringify(projects);
    const calculated = calculateChecksum(rawProjectsString);
    if (calculated !== backupPkg.manifest.checksum) {
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
  };
}
