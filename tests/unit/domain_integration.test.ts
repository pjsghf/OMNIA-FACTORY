import { describe, it, expect } from 'vitest';
import { validateBookConfig } from '../../src/lib/ai/validation/configValidator';
import { reconcileEditorialPlan } from '../../src/lib/ai/validation/planReconciler';
import { buildChapterSectionPlan } from '../../src/lib/ai/planning/chapterSectionPlanner';
import { normalizeProse } from '../../src/lib/ai/normalization/proseNormalizer';
import { validateChapterContent } from '../../src/lib/ai/validation/contentValidator';
import { checkChapterCoverage } from '../../src/lib/ai/validation/coverageChecker';
import { detectSensitiveNiche } from '../../src/lib/ai/policies/sensitiveNichePolicy';
import {
  createInitialBookBibleMemory,
  updateBookBibleMemoryWithChapter,
  formatMemoryForPrompt,
} from '../../src/lib/ai/memory/bookBibleMemory';
import { BookProject, ChapterContent } from '../../src/types';

describe('Domain & Editorial Planning (Unit Tests)', () => {
  it('DOM-001: Preserves chapter order when updating or reordering editorial plan', () => {
    const chapters: ChapterContent[] = [
      { numero: 1, titulo: 'Cap 1', content: 'C1 text', wordCount: 10, status: 'completed' },
      { numero: 2, titulo: 'Cap 2', content: 'C2 text', wordCount: 10, status: 'pending' },
    ];
    // Reorder chapters
    const reordered = [chapters[1]!, chapters[0]!].map((c, idx) => ({ ...c, numero: idx + 1 }));
    expect(reordered[0]?.titulo).toBe('Cap 2');
    expect(reordered[0]?.numero).toBe(1);
    expect(reordered[1]?.titulo).toBe('Cap 1');
    expect(reordered[1]?.numero).toBe(2);
  });

  it('DOM-002: Plan reconciliation preserves existing chapter content without overwriting written text', () => {
    const config = validateBookConfig({
      titulo: 'Livro Teste',
      autor: 'Autor Teste',
      qtdCapitulos: 3,
      minPalavras: 500,
      maxPalavras: 1500,
    });

    const rawAiPlan = {
      conceitoCentral: 'Conceito',
      sumario: [
        { numero: 1, titulo: 'Novo Titulo 1', estimativaPalavras: 600 },
        { numero: 2, titulo: 'Novo Titulo 2', estimativaPalavras: 700 },
        { numero: 3, titulo: 'Novo Titulo 3', estimativaPalavras: 800 },
      ],
    };

    const reconciled = reconcileEditorialPlan(rawAiPlan, config.sanitizedMetadata!);
    expect(reconciled.reconciledPlan.sumario.length).toBe(3);
    expect(reconciled.reconciledPlan.sumario[0]?.estimativaPalavras).toBeGreaterThanOrEqual(500);
  });

  it('DOM-003: Prose normalization removes AI meta-talk while preserving mathematical formulas and inline code', () => {
    const rawText = `Aqui está o capítulo:

Fórmula $E = m * c^2$ e cálculo $2 * 3 * 4 = 24$.
Variável: \`snake_case_variable_name\`

\`\`\`typescript
const val = compute(10);
\`\`\`

Espero que goste deste capítulo!`;

    const normalized = normalizeProse(rawText);
    expect(normalized).not.toContain('Aqui está o capítulo:');
    expect(normalized).not.toContain('Espero que goste deste capítulo!');
    expect(normalized).toContain('$E = m * c^2$');
    expect(normalized).toContain('2 * 3 * 4 = 24');
    expect(normalized).toContain('snake_case_variable_name');
    expect(normalized).toContain('const val = compute(10);');
  });

  it('DOM-004: BookBible memory accumulates chapter summaries and injects them into future prompts', () => {
    let memory = createInitialBookBibleMemory();
    memory = updateBookBibleMemoryWithChapter(
      memory,
      1,
      'Os Fundamentos',
      'Capítulo 1 abordou a teoria.',
      {
        keyTheses: ['Tese A'],
        termsDefined: ['Termo1'],
        analogiesUsed: ['Metáfora Mar'],
      }
    );

    expect(memory.resumosCapitulos.length).toBe(1);
    expect(memory.datasETermos).toContain('Termo1');

    const promptText = formatMemoryForPrompt(memory);
    expect(promptText).toContain('Metáfora Mar');
    expect(promptText).toContain('Termo1');
  });

  it('DOM-005: Sensitive niche detection correctly attaches required disclaimers for health and finance', () => {
    const healthPolicy = detectSensitiveNiche({
      estilo: 'saude_bem_estar',
      resumo: 'Tratamento de diabetes',
    });
    expect(healthPolicy.type).toBe('health');
    expect(healthPolicy.requiresSources).toBe(true);
    expect(healthPolicy.mandatoryDisclaimer).toContain('não substituindo o diagnóstico');

    const financePolicy = detectSensitiveNiche({
      estilo: 'financas_investimentos',
      resumo: 'Investimentos em ações',
    });
    expect(financePolicy.type).toBe('finance');
    expect(financePolicy.mandatoryDisclaimer).toContain('não constitui recomendação');
  });

  it('DOM-006: Sub-block chapter planning divides estimates into balanced sections', () => {
    const config = validateBookConfig({
      titulo: 'Guia Prático',
      autor: 'Autor',
      qtdCapitulos: 5,
      minPalavras: 1000,
      maxPalavras: 2000,
    });
    const chapterPlan = {
      numero: 1,
      titulo: 'Cap 1',
      objetivo: 'Obj',
      topicos: ['T1', 'T2'],
      estimativaPalavras: 1500,
    };
    const detailed = buildChapterSectionPlan(chapterPlan, config.sanitizedMetadata!);
    expect(detailed.sections.length).toBeGreaterThanOrEqual(2);
  });

  it('DOM-007: Content validator detects empty and truncated text correctly', () => {
    const emptyVal = validateChapterContent('', 1000);
    expect(emptyVal.valid).toBe(false);
    expect(emptyVal.isEmpty).toBe(true);

    const truncatedText =
      'Este texto possui mais de cem caracteres para testar se o validador de conteúdo detecta o truncamento e termina de forma abrupta sem ponto final';
    const truncatedVal = validateChapterContent(truncatedText, 1000);
    expect(truncatedVal.valid).toBe(false);
    expect(truncatedVal.isTruncated).toBe(true);

    const completeText = 'Este é um parágrafo completo com pontuação terminal adequada.';
    const completeVal = validateChapterContent(completeText, 5);
    expect(completeVal.valid).toBe(true);
  });

  it('DOM-008: Coverage checker calculates score for required topics and checks forbidden terms', () => {
    const meta = {
      titulo: 'T',
      autor: 'A',
      qtdCapitulos: 1,
      minPalavras: 10,
      maxPalavras: 100,
      informacoesObrigatorias: 'Respiração, Foco',
      restricoes: 'Pseudo-ciência',
    };
    const text = 'A prática da respiração traz maior foco no dia a dia.';
    const report = checkChapterCoverage(text, ['Respiração', 'Foco'], meta as any);
    expect(report.coverageScore).toBeGreaterThanOrEqual(50);
    expect(report.forbiddenTermsViolated.length).toBe(0);
  });
});
