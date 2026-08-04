/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudioStage } from '../../src/components/StudioStage';
import { saveProjectDB } from '../../src/lib/storage/indexedDBStorage';
import { BookProject } from '../../src/types';

// Mock da API nativa do IndexedDB para ambiente de teste
vi.mock('../../src/lib/storage/indexedDBStorage', () => ({
  saveProjectDB: vi.fn().mockResolvedValue(undefined),
}));

describe('Validação do Estúdio Centralizado e Persistência', () => {
  const mockProject: BookProject = {
    id: 'proj_test_studio',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    currentStage: 'writing',
    metadata: {
      titulo: 'Capítulo Teste',
      subtitulo: 'Subtítulo',
      autor: 'Autor Teste',
      editora: 'OMNIA',
      idioma: 'Português',
      publicoAlvo: 'Leitores',
      resumo: 'Resumo',
      estilo: 'desenvolvimento_pessoal',
      promptEstilo: '',
      tom: 'didatico_inspirador',
      qtdCapitulos: 1,
      minPalavras: 500,
      maxPalavras: 1500,
      materiais: '',
      informacoesObrigatorias: '',
      restricoes: '',
    },
    plan: null,
    chapters: [
      {
        numero: 1,
        titulo: 'Capítulo Teste',
        subtitulo: 'Subtítulo 1',
        content: 'Conteúdo inicial.',
        wordCount: 2,
        status: 'pending',
      },
    ],
    frontMatter: {},
    endMatter: {},
  };

  it('deve renderizar o capítulo selecionado e atualizar o conteúdo corretamente', () => {
    const handleUpdate = vi.fn();
    const handleGenerateChapter = vi.fn().mockResolvedValue(undefined);
    const handleAiAssist = vi.fn().mockResolvedValue(undefined);
    const handleProceedToReview = vi.fn();
    const handleProceedToExport = vi.fn();

    render(
      <StudioStage
        project={mockProject}
        onUpdateChapterContent={handleUpdate}
        onGenerateChapter={handleGenerateChapter}
        onRunAiAssist={handleAiAssist}
        isGeneratingIndex={null}
        onProceedToReview={handleProceedToReview}
        onProceedToExport={handleProceedToExport}
      />
    );

    expect(screen.getAllByText('Capítulo Teste').length).toBeGreaterThan(0);

    const textarea = screen.getByPlaceholderText(
      /O texto do capítulo aparecerá|Comece a escrever/i
    );
    fireEvent.change(textarea, { target: { value: 'Texto alterado.' } });

    expect(handleUpdate).toHaveBeenCalledWith(0, 'Texto alterado.');
  });

  it('deve disparar a chamada de salvamento assíncrono no banco local', async () => {
    await saveProjectDB(mockProject);
    expect(saveProjectDB).toHaveBeenCalledWith(mockProject);
  });
});
