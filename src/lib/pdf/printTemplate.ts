import { BookProject } from '../../types';
import { PdfExportSettings, PrintableBookOptions } from './types';
import { escapeHtml, buildPrintableCoverHtml } from './coverRenderer';
import { renderMarkdownForPrint } from './markdownRenderer';
import { renderCatalogPageHtml } from './catalogRenderer';
import { buildPrintStyles } from './printStyles';
import { buildPrintAssetsScript } from './printAssets';

export function buildPrintableBookHtml(options: PrintableBookOptions): string {
  const { project, settings } = options;
  const currentYear = new Date().getFullYear();

  // TOC items generator
  const tocItems: { id: string; type: string; title: string }[] = [];

  if (project.frontMatter.apresentacao) {
    tocItems.push({ id: 'front-apresentacao', type: 'SEÇÃO', title: 'Apresentação' });
  }
  if (project.frontMatter.introducao) {
    tocItems.push({ id: 'front-introducao', type: 'SEÇÃO', title: 'Introdução' });
  }

  project.chapters.forEach((cap) => {
    tocItems.push({
      id: `capitulo-${cap.numero}`,
      type: `CAPÍTULO ${cap.numero}`,
      title: cap.titulo,
    });
  });

  if (project.endMatter.conclusao) {
    tocItems.push({ id: 'end-conclusao', type: 'SEÇÃO', title: 'Conclusão' });
  }
  if (project.endMatter.exercicios) {
    tocItems.push({ id: 'end-exercicios', type: 'SEÇÃO', title: 'Exercícios e Materiais' });
  }
  if (project.endMatter.agradecimentos) {
    tocItems.push({ id: 'end-agradecimentos', type: 'SEÇÃO', title: 'Agradecimentos' });
  }
  if (project.endMatter.sobreAutor) {
    tocItems.push({ id: 'end-sobre-autor', type: 'SEÇÃO', title: 'Sobre o Autor' });
  }

  const tocHtml = tocItems
    .map(
      (item) => `
      <div class="toc-row" data-target="${item.id}">
        <a href="#${item.id}" class="toc-link">
          <span class="toc-label"><strong class="toc-badge">${item.type}</strong> ${escapeHtml(
            item.title
          )}</span>
          <span class="toc-dots"></span>
          <span class="toc-page-number"></span>
        </a>
      </div>`
    )
    .join('\n');

  // Cover HTML
  const coverHtml = buildPrintableCoverHtml({
    imageUrl: project.metadata.coverImageUrl,
    title: project.metadata.titulo,
    subtitle: project.metadata.subtitulo,
    author: project.metadata.autor,
    publisher: project.metadata.editora || 'Editora OMNIA',
    year: currentYear,
    overlayMode: settings.coverOverlayMode,
  });

  // Body classes
  const typographyClass =
    settings.typographyMode === 'literary' ? 'pdf-mode-literary' : 'pdf-mode-nonfiction';
  const dropCapClass = settings.useDropCap ? 'pdf-use-drop-cap' : 'pdf-no-drop-cap';

  return `<!DOCTYPE html>
<html lang="${project.metadata.idioma || 'pt-BR'}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(project.metadata.titulo)} — Diagramação Editorial PDF (${settings.paperSize})</title>
  <style>
    ${buildPrintStyles(settings)}
  </style>
</head>
<body class="${typographyClass} ${dropCapClass}">
  <!-- Sticky Toolbar -->
  <div class="no-print-toolbar">
    <div class="toolbar-info">
      <span class="toolbar-badge">${settings.paperSize} • ${
        settings.typographyMode === 'literary' ? 'Ficção' : 'Não-Ficção'
      }</span>
      <span><strong>Diagramação Editorial PDF</strong> — ${escapeHtml(project.metadata.titulo)}</span>
      <span class="toolbar-status" id="print-status-text">Carregando recursos...</span>
    </div>
    <div class="toolbar-actions">
      <button id="print-button" class="btn-action" onclick="window.print()">🖨️ Imprimir / Salvar em PDF</button>
      <button class="btn-close" onclick="window.close()">✕ Fechar</button>
    </div>
  </div>

  <div class="print-pages-wrapper">
    <!-- Cover Page Sheet -->
    <div class="page-sheet cover-sheet">
      ${coverHtml}
    </div>

    <!-- Title Page (Folha de Rosto) -->
    <div class="page-sheet">
      <div class="pdf-title-page">
        <div class="pub-header">${escapeHtml(project.metadata.editora || 'EDITORA OMNIA')}</div>
        <div>
          <h1 class="main-title">${escapeHtml(project.metadata.titulo)}</h1>
          ${
            project.metadata.subtitulo
              ? `<h2 class="sub-title">${escapeHtml(project.metadata.subtitulo)}</h2>`
              : ''
          }
          <p class="author-name">${escapeHtml(project.metadata.autor)}</p>
        </div>
        <div class="pub-footer">
          <p class="pub-brand">OMNIA FACTORY</p>
          <p class="pub-loc">São Paulo — ${currentYear}</p>
        </div>
      </div>
    </div>

    <!-- Copyright & Cataloging CIP -->
    ${renderCatalogPageHtml(project, settings)}

    <!-- Table of Contents (Sumário) -->
    <div class="page-sheet">
      <div class="pdf-toc-page">
        <h1 class="toc-heading">SUMÁRIO</h1>
        <div class="toc-items">
          ${tocHtml}
        </div>
      </div>
    </div>

    <!-- Front Matter -->
    ${
      project.frontMatter.apresentacao
        ? `
      <div class="page-sheet" id="front-apresentacao">
        <div class="section-container">
          <h1 class="section-title">Apresentação</h1>
          <div class="section-content">${renderMarkdownForPrint(project.frontMatter.apresentacao)}</div>
        </div>
      </div>
    `
        : ''
    }

    ${
      project.frontMatter.introducao
        ? `
      <div class="page-sheet" id="front-introducao">
        <div class="section-container">
          <h1 class="section-title">Introdução</h1>
          <div class="section-content">${renderMarkdownForPrint(project.frontMatter.introducao)}</div>
        </div>
      </div>
    `
        : ''
    }

    <!-- Chapters -->
    ${project.chapters
      .map(
        (cap) => `
      <div class="page-sheet" id="capitulo-${cap.numero}">
        <div class="chapter-container">
          <div class="chapter-opening">
            <div class="chapter-badge">CAPÍTULO ${cap.numero}</div>
            <h1 class="chapter-title">${escapeHtml(cap.titulo)}</h1>
          </div>
          <div class="chapter-content">${renderMarkdownForPrint(cap.content)}</div>
        </div>
      </div>
    `
      )
      .join('')}

    <!-- End Matter -->
    ${
      project.endMatter.conclusao
        ? `
      <div class="page-sheet" id="end-conclusao">
        <div class="section-container">
          <h1 class="section-title">Conclusão</h1>
          <div class="section-content">${renderMarkdownForPrint(project.endMatter.conclusao)}</div>
        </div>
      </div>
    `
        : ''
    }

    ${
      project.endMatter.exercicios
        ? `
      <div class="page-sheet" id="end-exercicios">
        <div class="section-container">
          <h1 class="section-title">Exercícios e Materiais</h1>
          <div class="section-content">${renderMarkdownForPrint(project.endMatter.exercicios)}</div>
        </div>
      </div>
    `
        : ''
    }

    ${
      project.endMatter.agradecimentos
        ? `
      <div class="page-sheet" id="end-agradecimentos">
        <div class="section-container">
          <h1 class="section-title">Agradecimentos</h1>
          <div class="section-content">${renderMarkdownForPrint(project.endMatter.agradecimentos)}</div>
        </div>
      </div>
    `
        : ''
    }

    ${
      project.endMatter.sobreAutor
        ? `
      <div class="page-sheet" id="end-sobre-autor">
        <div class="section-container">
          <h1 class="section-title">Sobre o Autor</h1>
          <div class="section-content">${renderMarkdownForPrint(project.endMatter.sobreAutor)}</div>
        </div>
      </div>
    `
        : ''
    }
  </div>

  <script>
    ${buildPrintAssetsScript()}
  </script>
</body>
</html>`;
}
