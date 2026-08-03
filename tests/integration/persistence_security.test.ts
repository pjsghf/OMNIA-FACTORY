import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import {
  createBackupPackage,
  validateAndRestoreBackup,
  calculateChecksum,
} from '../../src/lib/backupService';
import { BookProject } from '../../src/types';

describe('Persistence, Backup & Endpoint Security (Integration Tests)', () => {
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
      sumario: [
        { numero: 1, titulo: 'Cap 1', objetivo: 'Obj', topicos: ['T1'], estimativaPalavras: 300 },
      ],
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

  it('PERSIST-001: Checksum calculation is deterministic', () => {
    const cs1 = calculateChecksum(JSON.stringify([mockProject]));
    const cs2 = calculateChecksum(JSON.stringify([mockProject]));
    expect(cs1).toBe(cs2);
    expect(typeof cs1).toBe('string');
    expect(cs1.length).toBeGreaterThan(0);
  });

  it('PERSIST-002: Create backup package with valid manifest, checksum, and structure', () => {
    const backupPkg = createBackupPackage([mockProject]);
    expect(backupPkg.format).toBe('omnia-backup-v2');
    expect(backupPkg.manifest.projectCount).toBe(1);
    expect(backupPkg.manifest.totalChapters).toBe(1);
    expect(backupPkg.manifest.totalWords).toBe(150);
  });

  it('PERSIST-003: Restores valid backup package successfully', () => {
    const backupPkg = createBackupPackage([mockProject]);
    const restoreRes = validateAndRestoreBackup(backupPkg);
    expect(restoreRes.success).toBe(true);
    expect(restoreRes.projects?.length).toBe(1);
    expect(restoreRes.projects?.[0]?.metadata.titulo).toBe('Livro de Teste de Backup');
  });

  it('PERSIST-004: Rejects corrupted or adulterated backup package format', () => {
    const invalidRes = validateAndRestoreBackup({
      format: 'omnia-backup-v2',
      projects: 'invalid-string',
    });
    expect(invalidRes.success).toBe(false);
  });

  it('PERSIST-005: Supports legacy array of projects for backwards compatibility', () => {
    const legacyRes = validateAndRestoreBackup([mockProject]);
    expect(legacyRes.success).toBe(true);
    expect(legacyRes.projects?.length).toBe(1);
  });

  it('PERSIST-006: GET /api/health returns system diagnostics without revealing API keys', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body).not.toHaveProperty('GEMINI_API_KEY');
  });

  it('PERSIST-007: GET /api/privacy-policy returns active LGPD privacy manifest', async () => {
    const res = await request(app).get('/api/privacy-policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toHaveProperty('version');
  });

  it('PERSIST-008: POST /api/editorial/projects/:id/delete-data processes LGPD data deletion request', async () => {
    const res = await request(app).post('/api/editorial/projects/proj_999/delete-data');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.projectId).toBe('proj_999');
  });

  it('PERSIST-009: Unknown /api routes answer JSON 404, not the SPA HTML shell', async () => {
    // The SPA catch-all used to swallow these and reply 200 text/html, so a
    // mistyped endpoint fed an HTML document to a client calling res.json().
    const res = await request(app).get('/api/endpoint-que-nao-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // Regression guard, not a fixed bug: the global 50mb parser runs before the
  // per-route one, so the early 413 handler already covered this path. Pinned so
  // that reordering the middleware stack cannot silently start returning HTML.
  it('PERSIST-010: Rejects an oversized PDF export body with JSON, not an HTML stack trace', async () => {
    const res = await request(app)
      .post('/api/export/pdf')
      .set('Content-Type', 'application/json')
      .send(`{"project":{"metadata":{"titulo":"${'x'.repeat(60 * 1024 * 1024)}"}}}`);

    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
