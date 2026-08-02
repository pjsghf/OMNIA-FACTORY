import { CoverOverlayMode } from './types';

export interface PrintableCoverOptions {
  imageUrl?: string;
  title: string;
  subtitle?: string;
  author: string;
  publisher?: string;
  year: string | number;
  overlayMode: CoverOverlayMode;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildPrintableCoverHtml(options: PrintableCoverOptions): string {
  const { imageUrl, title, subtitle, author, publisher, year, overlayMode } = options;

  const safeTitle = escapeHtml(title);
  const safeSubtitle = subtitle ? escapeHtml(subtitle) : '';
  const safeAuthor = escapeHtml(author);
  const safePublisher = escapeHtml(publisher || 'EDITORA OMNIA');
  const safeYear = escapeHtml(String(year));

  if (!imageUrl) {
    return `
      <div class="print-cover print-cover--fallback">
        <div class="print-cover-fallback-frame">
          <div class="print-cover-publisher">${safePublisher}</div>

          <div class="print-cover-fallback-center">
            <h1 class="print-cover-title">${safeTitle}</h1>
            ${safeSubtitle ? `<h2 class="print-cover-subtitle">${safeSubtitle}</h2>` : ''}
          </div>

          <div class="print-cover-bottom">
            <div class="print-cover-author">${safeAuthor}</div>
            <div class="print-cover-year">OMNIA FACTORY • ${safeYear}</div>
          </div>
        </div>
      </div>
    `;
  }

  const baseImage = `
    <img
      src="${escapeHtml(imageUrl)}"
      class="print-cover-image"
      alt="Capa do livro"
    />
  `;

  if (overlayMode === 'none') {
    return `
      <div class="print-cover">
        ${baseImage}
      </div>
    `;
  }

  if (overlayMode === 'card') {
    return `
      <div class="print-cover">
        ${baseImage}
        <div class="print-cover-card">
          <div class="print-cover-card-publisher">${safePublisher}</div>
          <h1 class="print-cover-card-title">${safeTitle}</h1>
          ${safeSubtitle ? `<h2 class="print-cover-card-subtitle">${safeSubtitle}</h2>` : ''}
          <div class="print-cover-card-author">${safeAuthor}</div>
        </div>
      </div>
    `;
  }

  // overlay mode (editorial overlay)
  return `
    <div class="print-cover">
      ${baseImage}
      <div class="print-cover-editorial-overlay">
        <div class="print-cover-editorial-top">
          <div class="print-cover-editorial-publisher">${safePublisher}</div>
          <h1 class="print-cover-editorial-title">${safeTitle}</h1>
          ${safeSubtitle ? `<h2 class="print-cover-editorial-subtitle">${safeSubtitle}</h2>` : ''}
        </div>

        <div class="print-cover-editorial-bottom">
          <div class="print-cover-editorial-line"></div>
          <div class="print-cover-editorial-author">${safeAuthor}</div>
          <div class="print-cover-editorial-brand">OMNIA FACTORY • ${safeYear}</div>
        </div>
      </div>
    </div>
  `;
}
