import { BookProject } from '../../types';
import { PdfExportSettings } from './types';
import { escapeHtml } from './coverRenderer';
import { getLanguageInfo } from '../utils/languageHelper';

export function renderCatalogPageHtml(project: BookProject, settings: PdfExportSettings): string {
  const currentYear = new Date().getFullYear();
  const author = escapeHtml(project.metadata.autor);
  const title = escapeHtml(project.metadata.titulo);
  const subtitle = project.metadata.subtitulo ? escapeHtml(project.metadata.subtitulo) : '';
  const publisher = escapeHtml(project.metadata.editora || 'Editora OMNIA');
  const meta = settings.catalogMetadata;
  const langInfo = getLanguageInfo(project.metadata.idioma);

  const editionStr = meta?.edition ? escapeHtml(meta.edition) : '1ª Edição';
  const cityStr = meta?.city ? escapeHtml(meta.city) : '';

  let catalogCardContent = '';

  if (meta?.catalogText) {
    catalogCardContent = `<div class="catalog-custom-text">${escapeHtml(meta.catalogText).replace(/\n/g, '<br/>')}</div>`;
  } else if (meta?.isOfficial && (meta.isbn || meta.cdd)) {
    catalogCardContent = `
      <p><strong>${author}</strong></p>
      <p>&nbsp;&nbsp;${title}${subtitle ? `: ${subtitle}` : ''} / ${author}. — ${editionStr} — ${cityStr ? `${cityStr}: ` : ''}${publisher}, ${meta.year || currentYear}.</p>
      <p>&nbsp;&nbsp;${project.chapters.length} cap. ; ${settings.paperSize === 'A5' ? '14,8x21 cm' : '21x29,7 cm'}.</p>
      <p>&nbsp;&nbsp;Código do Idioma (País): <strong>${escapeHtml(langInfo.code)}</strong> [${escapeHtml(langInfo.name)}].</p>
      ${meta.subjects && meta.subjects.length > 0 ? `<p>&nbsp;&nbsp;1. ${meta.subjects.map(escapeHtml).join('. 2. ')}.</p>` : ''}
      <div class="catalog-footer">
        ${meta.cdd ? `<span>CDD: ${escapeHtml(meta.cdd)}</span>` : ''}
        ${meta.isbn ? `<span>ISBN: ${escapeHtml(meta.isbn)}</span>` : ''}
      </div>
    `;
  }

  return `
    <div class="page-sheet">
      <div class="pdf-copyright-page">
        <div class="copyright-top">
          <p>© ${currentYear} <strong>${author}</strong>. Todos os direitos reservados.</p>
          <p class="copyright-publisher-line">Diagramação e Edição Digital: <strong>${publisher} (OMNIA Factory)</strong></p>
          <p class="copyright-publisher-line">Código do Idioma / País: <strong style="font-family: monospace; font-size: 9pt; background: #f4f4f5; padding: 2px 6px; border-radius: 3px; border: 1px solid #e4e4e7;">${escapeHtml(langInfo.code)}</strong> (${escapeHtml(langInfo.name)})</p>
        </div>

        ${
          catalogCardContent
            ? `
          <div class="catalog-card">
            <div class="catalog-title">Dados Internacionais de Catalogação na Publicação (CIP)</div>
            <div class="catalog-body">
              ${catalogCardContent}
            </div>
          </div>
        `
            : `
          <div class="copyright-notice-box">
            <p><strong>Aviso de Direitos e Publicação</strong></p>
            <p>Esta obra foi editada e diagramada através da plataforma Omnia Ebook Studio. Os direitos autorais morais e patrimoniais pertencem exclusivamente ao autor.</p>
            <p style="margin-top: 6px;">Código do Idioma (País): <strong style="font-family: monospace;">${escapeHtml(langInfo.code)}</strong> — ${escapeHtml(langInfo.name)}</p>
            <p class="copyright-disclaimer-small">Dados editoriais fornecidos pelo responsável pela obra. Este conteúdo não substitui uma ficha catalográfica elaborada por profissional bibliotecário habilitado.</p>
          </div>
        `
        }

        <div class="copyright-bottom">
          <p class="copyright-edition">${editionStr} — Publicação Editora OMNIA [${escapeHtml(langInfo.code)}]</p>
          <p class="copyright-legal">Nenhuma parte desta publicação pode ser reproduzida, armazenada ou transmitida de qualquer forma sem a prévia autorização por escrito do detentor dos direitos autorais.</p>
        </div>
      </div>
    </div>
  `;
}
