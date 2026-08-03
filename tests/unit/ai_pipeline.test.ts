import { describe, it, expect, vi, beforeEach } from 'vitest';

// The orchestrator is a module singleton reached directly by the pipeline, so it is
// mocked here rather than injected. These suites cover the AI pipeline's control
// flow -- failure handling and prompt assembly -- without spending a real API call.
vi.mock('../../src/lib/ai/orchestrator', () => ({
  aiOrchestrator: {
    generateStructured: vi.fn(),
    generateText: vi.fn(),
    generateImage: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

import { aiOrchestrator } from '../../src/lib/ai/orchestrator';
import { runHierarchicalEditorialReview } from '../../src/lib/ai/review/hierarchicalReviewer';
import { buildWriterSectionBlockPrompt } from '../../src/lib/ai/prompts/promptBuilder';
import { createInitialBookBibleMemory } from '../../src/lib/ai/memory/bookBibleMemory';
import { BookProject } from '../../src/types';

const mockedStructured = aiOrchestrator.generateStructured as unknown as ReturnType<typeof vi.fn>;

function buildProject(chapterCount: number): BookProject {
  return {
    id: 'proj_review_test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStage: 'review',
    editorialReport: null,
    metadata: {
      titulo: 'Livro de Teste',
      subtitulo: '',
      autor: 'Autor',
      idioma: 'pt-BR',
      publicoAlvo: 'Geral',
      resumo: 'Resumo',
      estilo: 'nao_ficcao',
      promptEstilo: '',
      tom: 'conversacional',
      qtdCapitulos: chapterCount,
      minPalavras: 500,
      maxPalavras: 1500,
      materiais: '',
      informacoesObrigatorias: '',
      restricoes: '',
    },
    plan: null,
    chapters: Array.from({ length: chapterCount }, (_, i) => ({
      numero: i + 1,
      titulo: `Capítulo ${i + 1}`,
      content: `Conteúdo substancial do capítulo ${i + 1}.`,
      wordCount: 100,
      status: 'completed' as const,
    })),
    frontMatter: {},
    endMatter: {},
  };
}

describe('Hierarchical review failure handling', () => {
  beforeEach(() => {
    mockedStructured.mockReset();
  });

  it('AIP-001: Throws instead of inventing a score when every unit fails', async () => {
    // Previously each failure was swallowed with console.warn and the reduce step's
    // fallback returned notaGeral: 80 with no findings -- a totally failed audit
    // looked like a clean pass and cleared preflightGate's ">= 70" gate.
    mockedStructured.mockRejectedValue(new Error('Provedor indisponível'));

    await expect(runHierarchicalEditorialReview({ project: buildProject(3) })).rejects.toThrow(
      /não pôde ser realizada/i
    );
  });

  it('AIP-002: Flags a partial audit and does not report full coverage', async () => {
    const project = buildProject(3);

    // Unit 1 fails; units 2 and 3 succeed; then the reduce step succeeds.
    mockedStructured
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { resumoUnidade: 'ok', achados: [] }, result: {} })
      .mockResolvedValueOnce({ data: { resumoUnidade: 'ok', achados: [] }, result: {} })
      .mockResolvedValueOnce({
        data: { notaGeral: 90, resumoAvaliatorio: 'Boa obra.' },
        result: {},
      });

    const report = await runHierarchicalEditorialReview({ project });

    expect(report.unidadesComFalha).toHaveLength(1);
    expect(report.unidadesComFalha?.[0]).toContain('Capítulo 1');
    // The score must announce that it is partial rather than reading as a verdict.
    expect(report.resumoAvaliatorio).toMatch(/AUDITORIA PARCIAL/);
    // 2 of 3 units analysed -- reporting 100% here was the old behaviour.
    expect(report.coberturaTotalUnidadesPercent).toBeLessThan(100);
  });

  it('AIP-003: Reports full coverage when nothing failed', async () => {
    mockedStructured.mockResolvedValue({
      data: { resumoUnidade: 'ok', achados: [], notaGeral: 88, resumoAvaliatorio: 'Sólido.' },
      result: {},
    });

    const report = await runHierarchicalEditorialReview({ project: buildProject(2) });

    expect(report.unidadesComFalha).toHaveLength(0);
    expect(report.resumoAvaliatorio).not.toMatch(/AUDITORIA PARCIAL/);
    expect(report.coberturaTotalUnidadesPercent).toBe(100);
  });
});

describe('Writer prompt continuity context', () => {
  const baseArgs = {
    metadata: buildProject(1).metadata,
    chapterPlan: {
      numero: 2,
      titulo: 'O Segundo Capítulo',
      objetivo: 'Aprofundar',
      topicos: ['T1'],
      estimativaPalavras: 1200,
    },
    sectionBlock: {
      numeroBloco: 2,
      tituloBloco: 'Aprofundamento',
      proposito: 'Detalhar',
      topicos: ['T1'],
      fatosObrigatorios: [],
      transicaoProximoBloco: 'seguir',
      estimativaPalavras: 600,
    },
    memory: createInitialBookBibleMemory(),
  };

  it('AIP-004: Includes the preceding block so blocks are not written blind', () => {
    const withoutContext = buildWriterSectionBlockPrompt(baseArgs);
    expect(withoutContext.userPrompt).not.toMatch(/BLOCO IMEDIATAMENTE ANTERIOR/);

    const withContext = buildWriterSectionBlockPrompt({
      ...baseArgs,
      precedingBlockText: 'O bloco anterior terminou discutindo a ancoragem mental.',
    });
    expect(withContext.userPrompt).toMatch(/BLOCO IMEDIATAMENTE ANTERIOR/);
    expect(withContext.userPrompt).toContain('ancoragem mental');
  });

  it('AIP-005: Falls back to client summaries only while the memory is still empty', () => {
    const emptyMemory = buildWriterSectionBlockPrompt({
      ...baseArgs,
      previousSummaries: ['Capítulo 1 (Fundamentos): tratou das bases.'],
    });
    expect(emptyMemory.userPrompt).toMatch(/RESUMO DOS CAPÍTULOS ANTERIORES/);
    expect(emptyMemory.userPrompt).toContain('tratou das bases');

    // Once the BookBible has real entries it is authoritative, so the cruder
    // client-side digest is not duplicated into the prompt.
    const populated = buildWriterSectionBlockPrompt({
      ...baseArgs,
      memory: {
        ...createInitialBookBibleMemory(),
        resumosCapitulos: [
          {
            chapterNumber: 1,
            title: 'Fundamentos',
            summary: 'Resumo vindo da memória.',
            keyTheses: [],
            termsDefined: [],
            analogiesUsed: [],
          },
        ],
      },
      previousSummaries: ['Capítulo 1 (Fundamentos): tratou das bases.'],
    });
    expect(populated.userPrompt).not.toMatch(/RESUMO DOS CAPÍTULOS ANTERIORES/);
    expect(populated.userPrompt).toContain('Resumo vindo da memória.');
  });
});
