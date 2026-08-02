import { createBackupPackage, validateAndRestoreBackup, calculateChecksum } from '../src/lib/backupService';
import { BookProject } from '../src/types';

function runBackupServiceTests() {
  console.log('=== STARTING BACKUP & RESTORE SERVICE AUDIT TESTS ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
    }
  }

  const mockProject: BookProject = {
    id: 'proj_test_100',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStage: 'writing',
    editorialReport: null,
    metadata: {
      titulo: 'Livro de Teste de Backup',
      subtitulo: 'Subtítulo do Backup',
      autor: 'Autor Teste',
      editora: 'Editora OMNIA',
      idioma: 'pt-BR',
      publicoAlvo: 'Leitores',
      resumo: 'Resumo',
      estilo: 'ficcao',
      promptEstilo: '',
      tom: 'conversacional',
      qtdCapitulos: 1,
      minPalavras: 100,
      maxPalavras: 500,
      materiais: '',
      informacoesObrigatorias: '',
      restricoes: '',
      coverImageUrl: 'https://example.com/cover.png',
    },
    plan: {
      conceitoCentral: 'Conceito',
      promessaPrincipal: 'Promessa',
      perfilLeitor: { descricao: '', doresEAnseios: [], oQueBuscaraNoLivro: [] },
      sumario: [{ numero: 1, titulo: 'Cap 1', objetivo: 'Obj', topicos: ['T1'], estimativaPalavras: 300 }],
    },
    chapters: [
      {
        numero: 1,
        titulo: 'Cap 1',
        content: 'Conteúdo do capítulo 1.',
        wordCount: 150,
        status: 'completed',
      },
    ],
    frontMatter: {},
    endMatter: {},
  };

  // 1. Checksum calculation
  const cs1 = calculateChecksum(JSON.stringify([mockProject]));
  const cs2 = calculateChecksum(JSON.stringify([mockProject]));
  assert(cs1 === cs2 && typeof cs1 === 'string' && cs1.length > 0, 'Checksum calculation is deterministic');

  // 2. Package Creation
  const backupPkg = createBackupPackage([mockProject]);
  assert(backupPkg.format === 'omnia-backup-v2', 'Backup package specifies omnia-backup-v2 format');
  assert(backupPkg.manifest.projectCount === 1, 'Manifest correctly counts 1 project');
  assert(backupPkg.manifest.totalChapters === 1, 'Manifest correctly counts 1 chapter');
  assert(backupPkg.manifest.totalWords === 150, 'Manifest correctly counts 150 words');
  assert(backupPkg.manifest.checksum === cs1, 'Manifest checksum matches calculated checksum');

  // 3. Package Validation & Restore
  const restoreRes = validateAndRestoreBackup(backupPkg);
  assert(restoreRes.success === true, 'Valid backup package restores successfully');
  assert(restoreRes.projects?.length === 1, 'Restored project count matches original');
  assert(restoreRes.projects?.[0]?.metadata.titulo === 'Livro de Teste de Backup', 'Restored project content matches');

  // 4. Invalid Backup Package
  const invalidRes = validateAndRestoreBackup({ format: 'omnia-backup-v2', projects: 'not-an-array' });
  assert(invalidRes.success === false, 'Invalid backup package format is rejected');

  // 5. Legacy Array Backup
  const legacyRes = validateAndRestoreBackup([mockProject]);
  assert(legacyRes.success === true && legacyRes.projects?.length === 1, 'Legacy array of projects is supported for backwards compatibility');

  console.log(`\n=== BACKUP SERVICE AUDIT RESULTS: ${passed}/${total} PASSED ===`);
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runBackupServiceTests();
