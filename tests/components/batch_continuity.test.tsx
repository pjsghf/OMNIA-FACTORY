/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

/**
 * Regression cover for the stale-closure bug in the batch chapter generator.
 *
 * handleGenerateBatchChapters awaits once per chapter, but every iteration used to
 * read the `activeProject` captured at render time. The consequence was invisible in
 * the UI -- chapters were still produced -- but each request carried an empty
 * previousSummaries and the same pre-batch bookBibleMemory, so the continuity engine
 * was effectively disconnected for the whole book.
 *
 * The assertions therefore look at what was *sent to the server* across iterations,
 * which is the only place the defect is observable.
 */

interface CapturedRequest {
  url: string;
  body: any;
}

let requests: CapturedRequest[] = [];

function mockFetchSequence() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ url: String(url), body });

    if (String(url).includes('/api/editorial/plan')) {
      return jsonResponse({
        success: true,
        plan: {
          conceitoCentral: 'Conceito',
          promessaPrincipal: 'Promessa',
          perfilLeitor: { descricao: '', doresEAnseios: [], oQueBuscaraNoLivro: [] },
          sumario: [
            { numero: 1, titulo: 'Cap 1', objetivo: 'o1', topicos: ['t'], estimativaPalavras: 800 },
            { numero: 2, titulo: 'Cap 2', objetivo: 'o2', topicos: ['t'], estimativaPalavras: 800 },
            { numero: 3, titulo: 'Cap 3', objetivo: 'o3', topicos: ['t'], estimativaPalavras: 800 },
          ],
        },
      });
    }

    if (String(url).includes('/api/editorial/generate-chapter')) {
      const index = body.chapterIndex as number;
      // Each response advances the BookBible, exactly as the real endpoint does.
      return jsonResponse({
        success: true,
        chapterIndex: index,
        content: `Texto gerado do capítulo ${index + 1}.`,
        wordCount: 100,
        updatedMemory: {
          version: index + 2,
          updatedAt: new Date().toISOString(),
          resumosCapitulos: Array.from({ length: index + 1 }, (_, i) => ({
            chapterNumber: i + 1,
            title: `Cap ${i + 1}`,
            summary: `Resumo ${i + 1}`,
            keyTheses: [],
            termsDefined: [],
            analogiesUsed: [],
          })),
          afirmacoesChave: [],
          personagensOuPessoas: [],
          datasETermos: [],
          exemplosEAnalogiasUtilizados: [],
          promessasEPendencias: [],
          riscosDeRepeticao: [],
        },
      });
    }

    return jsonResponse({ success: true });
  });
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe('Batch chapter generation continuity', () => {
  beforeEach(() => {
    requests = [];
    localStorage.clear();
    vi.stubGlobal('fetch', mockFetchSequence());
    // Real timers on purpose: the batch loop sleeps 2.5s between chapters and
    // testing-library's waitFor needs a working setTimeout, so the run simply
    // takes those few seconds rather than faking them.
  });

  it('CMP-001: Each chapter request carries the memory produced by the previous one', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Stage 1 -> generate the editorial plan.
    await user.click(screen.getByRole('button', { name: /Gerar Planejamento & Sumário/i }));
    await waitFor(() => expect(requests.some((r) => r.url.includes('/plan'))).toBe(true));

    // Stage 2 -> advance to the writing stage.
    const toWriting = await screen.findByRole(
      'button',
      { name: /Redação dos Capítulos/i },
      { timeout: 10000 }
    );
    await user.click(toWriting);

    // Stage 3 -> run the batch over all three chapters.
    const runBatch = await screen.findByRole(
      'button',
      { name: /Escrever Todos os Capítulos/i },
      { timeout: 10000 }
    );
    await user.click(runBatch);

    await waitFor(
      () => {
        const chapterCalls = requests.filter((r) => r.url.includes('/generate-chapter'));
        expect(chapterCalls.length).toBe(3);
      },
      { timeout: 25000 }
    );

    const chapterCalls = requests.filter((r) => r.url.includes('/generate-chapter'));

    // Chapter 1 legitimately has no history.
    expect(chapterCalls[0]!.body.previousSummaries).toEqual([]);

    // Chapters 2 and 3 must see what came before. Under the stale closure these
    // were both [] and the memory stayed at the pre-batch value.
    expect(chapterCalls[1]!.body.previousSummaries.length).toBe(1);
    expect(chapterCalls[2]!.body.previousSummaries.length).toBe(2);

    expect(chapterCalls[1]!.body.memory?.resumosCapitulos?.length).toBe(1);
    expect(chapterCalls[2]!.body.memory?.resumosCapitulos?.length).toBe(2);

    // And the memory must actually advance rather than repeat the initial value.
    expect(chapterCalls[2]!.body.memory.version).toBeGreaterThan(
      chapterCalls[1]!.body.memory.version
    );
  });
});
