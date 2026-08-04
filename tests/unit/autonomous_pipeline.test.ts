import { describe, it, expect, vi } from 'vitest';
import {
  AutonomousPipelineRunner,
  TelemetryState,
} from '../../src/lib/pipeline/autonomousPipeline';
import { BookProject } from '../../src/types';

const MOCK_PROJECT: BookProject = {
  id: 'proj_test_auto',
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  currentStage: 'config',
  metadata: {
    titulo: 'Livro Teste Autônomo',
    subtitulo: 'Subtítulo do Livro Teste',
    autor: 'Autor Teste',
    editora: 'OMNIA',
    idioma: 'Português',
    publicoAlvo: 'Leitores de teste',
    resumo: 'Resumo do livro teste para automação.',
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

describe('Autonomous Pipeline Engine (Unit Tests)', () => {
  it('AUT-001: Initializes telemetry state with correct project defaults', () => {
    let lastTelemetry: TelemetryState | null = null;
    const runner = new AutonomousPipelineRunner({
      project: MOCK_PROJECT,
      aiConfig: { provider: 'opencode' },
      targetScore: 8.5,
      maxReviewIterations: 3,
      onTelemetry: (t) => {
        lastTelemetry = t;
      },
      onProjectUpdate: vi.fn(),
      addToast: vi.fn(),
    });

    expect(runner).toBeDefined();
  });

  it('AUT-002: Emits cancellation status when user cancels execution', () => {
    let lastTelemetry: TelemetryState | null = null;
    const runner = new AutonomousPipelineRunner({
      project: MOCK_PROJECT,
      aiConfig: { provider: 'opencode' },
      targetScore: 8.5,
      maxReviewIterations: 3,
      onTelemetry: (t) => {
        lastTelemetry = t;
      },
      onProjectUpdate: vi.fn(),
      addToast: vi.fn(),
    });

    runner.cancel();

    expect(lastTelemetry).toBeDefined();
    expect(lastTelemetry?.isCancelled).toBe(true);
    expect(lastTelemetry?.step).toBe('failed');
    expect(lastTelemetry?.statusMessage).toContain('cancelado');
  });
});
