import { describe, it, expect } from 'vitest';
import { calculateChecksum, createBackupPackage } from '../../src/lib/backupService';
import { BookProject } from '../../src/types';

const MOCK_PROJECT: BookProject = {
  id: 'proj_unit_test',
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  currentStage: 'config',
  metadata: {
    titulo: 'Livro de Teste IndexedDB',
    subtitulo: 'Subtítulo',
    autor: 'Autor Teste',
    editora: 'OMNIA',
    idioma: 'Português',
    publicoAlvo: 'Testadores',
    resumo: 'Resumo de teste.',
    estilo: 'desenvolvimento_pessoal',
    promptEstilo: 'Tom didático',
    tom: 'didatico_inspirador',
    qtdCapitulos: 3,
    minPalavras: 500,
    maxPalavras: 1500,
    materiais: '',
    informacoesObrigatorias: '',
    restricoes: '',
  },
  plan: null,
  chapters: [],
  frontMatter: {},
  endMatter: {},
};

describe('IndexedDB & Backup Storage Unit Tests', () => {
  it('STORE-001: Calculates deterministic checksum for backup payloads', () => {
    const raw = JSON.stringify([MOCK_PROJECT]);
    const hash1 = calculateChecksum(raw);
    const hash2 = calculateChecksum(raw);

    expect(hash1).toBeDefined();
    expect(hash1).toBe(hash2);
  });

  it('STORE-002: Creates versioned backup package with asset IDs', () => {
    const pkg = createBackupPackage([MOCK_PROJECT]);
    expect(pkg.format).toBe('omnia-backup-v2');
    expect(pkg.manifest.projectCount).toBe(1);
    expect(pkg.projects[0]?.id).toBe('proj_unit_test');
  });
});
