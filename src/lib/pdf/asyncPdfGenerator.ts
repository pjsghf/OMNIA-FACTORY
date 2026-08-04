import { BookProject } from '../../types';
import { PdfExportSettings } from './types';
import { buildPrintableBookHtml } from './printTemplate';

export interface AsyncPdfProgressCallback {
  (percent: number, statusMessage: string): void;
}

/**
 * Builds the printable PDF HTML payload in the background without blocking the UI.
 * Uses requestIdleCallback (or time-sliced setTimeout fallbacks) so heavy string
 * concatenations, SVG composite renders, and markdown parsing never freeze
 * animations or clicks.
 */
export async function buildPdfHtmlInBackground(
  project: BookProject,
  settings: PdfExportSettings,
  onProgress?: AsyncPdfProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    const executeTask = async () => {
      try {
        if (onProgress) onProgress(15, 'Preparando métricas da folha e estilos CSS...');
        await yieldToMainThread();

        if (onProgress)
          onProgress(40, 'Renderizando folha de rosto, ficha catalográfica e sumário...');
        await yieldToMainThread();

        if (onProgress) onProgress(75, 'Processando prosa dos capítulos e marcações de página...');
        await yieldToMainThread();

        const html = buildPrintableBookHtml({ project, settings });

        if (onProgress) onProgress(100, 'HTML do livro estruturado com sucesso.');
        resolve(html);
      } catch (err) {
        reject(err);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => executeTask(), { timeout: 2000 });
    } else {
      setTimeout(executeTask, 20);
    }
  });
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}
