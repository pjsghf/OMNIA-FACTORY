import { PdfExportSettings } from './types';
import { getPageMetrics } from './pageMetrics';

export function buildPrintStyles(settings: PdfExportSettings): string {
  const metrics = getPageMetrics(settings.paperSize);
  const isA5 = settings.paperSize === 'A5';

  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      font-family: 'Georgia', 'Garamond', 'Palatino Linotype', 'Times New Roman', serif;
      font-size: ${isA5 ? '10pt' : '11pt'};
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #1c1917;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      counter-reset: page 0;
    }

    /* Floating On-Screen Toolbar */
    .no-print-toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: #09090b;
      border-bottom: 1px solid #27272a;
      color: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    }

    .toolbar-info {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .toolbar-badge {
      background: #d97706;
      color: #000;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .toolbar-status {
      font-size: 12px;
      color: #a1a1aa;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn-action {
      background: #d97706;
      color: #000;
      border: none;
      padding: 8px 18px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .btn-action:hover:not(:disabled) {
      background: #f59e0b;
    }

    .btn-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-close {
      background: #27272a;
      color: #a1a1aa;
      border: 1px solid #3f3f46;
      padding: 8px 14px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-close:hover {
      background: #3f3f46;
      color: #fff;
    }

    /* On-screen page sheet preview wrapper */
    .print-pages-wrapper {
      padding-top: 76px;
      padding-bottom: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }

    .page-sheet {
      width: ${metrics.widthMm}mm;
      min-height: ${metrics.heightMm}mm;
      background: #ffffff;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6);
      position: relative;
      box-sizing: border-box;
      padding: ${metrics.topMarginMm}mm ${metrics.outerMarginMm}mm ${metrics.bottomMarginMm}mm ${metrics.innerMarginMm}mm;
      page-break-after: always;
      break-after: page;
      counter-increment: page;
    }

    /* Cover Page Sheet suppresses page counter */
    .page-sheet.cover-sheet {
      counter-increment: none;
      counter-reset: page 0;
    }

    /* Page number indicator in bottom right corner (canto inferior direito) */
    .page-sheet:not(.cover-sheet)::after {
      content: "Pág. " counter(page);
      position: absolute;
      bottom: 8mm;
      right: 12mm;
      font-family: 'Georgia', 'Garamond', 'Palatino Linotype', 'Times New Roman', serif;
      font-size: 8.5pt;
      font-weight: 600;
      color: #52525b;
      letter-spacing: 0.5px;
      pointer-events: none;
      z-index: 100;
    }

    .page-sheet:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    /* Cover Page Sheet */
    .page-sheet.cover-sheet {
      padding: 0 !important;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: #0d0d0d;
    }

    .print-cover {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: ${metrics.heightMm}mm;
      overflow: hidden;
      background: #0d0d0d;
    }

    .print-cover-image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .print-cover-editorial-overlay {
      position: absolute;
      inset: 0;
      padding: 18mm 14mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      color: #ffffff;
      background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.92) 0%,
        rgba(0, 0, 0, 0.15) 50%,
        rgba(0, 0, 0, 0.75) 100%
      );
    }

    .print-cover-editorial-publisher {
      font-family: sans-serif;
      font-size: 8.5pt;
      letter-spacing: 4px;
      font-weight: 700;
      color: #e7e5e4;
      text-transform: uppercase;
      margin-bottom: 8mm;
    }

    .print-cover-editorial-title {
      font-size: 26pt;
      font-style: italic;
      color: #ffffff;
      line-height: 1.2;
      margin-bottom: 4mm;
    }

    .print-cover-editorial-subtitle {
      font-size: 13pt;
      font-weight: 400;
      color: #d6d3d1;
    }

    .print-cover-editorial-line {
      width: 60mm;
      height: 1px;
      background: rgba(217, 119, 6, 0.75);
      margin: 0 auto 6mm auto;
    }

    .print-cover-editorial-author {
      font-size: 16pt;
      font-style: italic;
      color: #ffffff;
      margin-bottom: 3mm;
    }

    .print-cover-editorial-brand {
      font-family: sans-serif;
      font-size: 8pt;
      letter-spacing: 2px;
      color: #a8a29e;
      text-transform: uppercase;
    }

    /* Cover Card Overlay Mode */
    .print-cover-card {
      position: absolute;
      left: 10mm;
      right: 10mm;
      bottom: 14mm;
      padding: 8mm 6mm;
      text-align: center;
      color: #ffffff;
      background: rgba(12, 10, 9, 0.88);
      border: 1px solid rgba(217, 119, 6, 0.6);
      backdrop-filter: blur(4px);
    }

    .print-cover-card-publisher {
      font-family: sans-serif;
      font-size: 7.5pt;
      letter-spacing: 3px;
      color: #d97706;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 4mm;
    }

    .print-cover-card-title {
      font-size: 20pt;
      font-style: italic;
      line-height: 1.25;
      margin-bottom: 2mm;
    }

    .print-cover-card-subtitle {
      font-size: 11pt;
      font-weight: 400;
      color: #a8a29e;
      margin-bottom: 4mm;
    }

    .print-cover-card-author {
      font-size: 13pt;
      font-style: italic;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 3mm;
      display: inline-block;
      min-width: 50%;
    }

    /* Cover Fallback Mode (No image) */
    .print-cover--fallback {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 10mm;
      background: #fafaf9;
    }

    .print-cover-fallback-frame {
      border: 3px double #1c1917;
      padding: 16mm 10mm;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
    }

    .print-cover-publisher {
      font-family: sans-serif;
      font-size: 8.5pt;
      letter-spacing: 4px;
      font-weight: 700;
      color: #78716c;
      text-transform: uppercase;
    }

    .print-cover-title {
      font-size: 26pt;
      font-style: italic;
      color: #1c1917;
      margin-bottom: 4mm;
      line-height: 1.2;
    }

    .print-cover-subtitle {
      font-size: 13pt;
      font-weight: 400;
      color: #57534e;
    }

    .print-cover-author {
      font-size: 16pt;
      font-style: italic;
      color: #1c1917;
      border-top: 1px solid #d6d3d1;
      padding-top: 4mm;
      width: 60%;
      margin: 0 auto 3mm auto;
    }

    .print-cover-year {
      font-family: sans-serif;
      font-size: 8pt;
      letter-spacing: 2px;
      color: #78716c;
      text-transform: uppercase;
    }

    /* Title Page (Folha de Rosto) */
    .pdf-title-page {
      min-height: ${metrics.contentHeightMm}mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      padding: 10mm 0;
      box-sizing: border-box;
    }

    .pub-header {
      font-family: sans-serif;
      font-size: 8pt;
      letter-spacing: 4px;
      font-weight: 700;
      color: #78716c;
      text-transform: uppercase;
    }

    .main-title {
      font-size: 24pt;
      font-style: italic;
      color: #0f0e0d;
      margin-bottom: 4mm;
      line-height: 1.25;
    }

    .sub-title {
      font-size: 12pt;
      font-weight: 400;
      color: #57534e;
      margin-bottom: 8mm;
    }

    .author-name {
      font-size: 15pt;
      font-style: italic;
      color: #1c1917;
      border-top: 1px solid #e7e5e4;
      display: inline-block;
      padding-top: 4mm;
      min-width: 180px;
    }

    .pub-footer {
      font-family: sans-serif;
    }

    .pub-brand {
      font-size: 9pt;
      letter-spacing: 2px;
      font-weight: 700;
      color: #1c1917;
    }

    .pub-loc {
      font-size: 8pt;
      color: #78716c;
      margin-top: 2mm;
    }

    /* Copyright & Cataloging CIP Page */
    .pdf-copyright-page {
      min-height: ${metrics.contentHeightMm}mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #44403c;
      line-height: 1.6;
      padding: 6mm 0;
      box-sizing: border-box;
    }

    .copyright-publisher-line {
      margin-top: 2mm;
      color: #57534e;
    }

    .catalog-card {
      border: 1px solid #a8a29e;
      padding: 14px 18px;
      margin: 12mm 0;
      font-family: monospace;
      font-size: 8pt;
      background: #fafaf9;
      break-inside: avoid;
    }

    .catalog-title {
      font-family: sans-serif;
      font-weight: 700;
      text-align: center;
      border-bottom: 1px solid #d6d3d1;
      padding-bottom: 6px;
      margin-bottom: 10px;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .catalog-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      border-top: 1px dashed #d6d3d1;
      padding-top: 6px;
      font-weight: 700;
    }

    .copyright-notice-box {
      border-left: 3px solid #d97706;
      background: #fafaf9;
      padding: 14px 18px;
      margin: 12mm 0;
      font-size: 8.5pt;
      line-height: 1.6;
    }

    .copyright-disclaimer-small {
      margin-top: 8px;
      font-size: 7.5pt;
      color: #78716c;
      font-style: italic;
    }

    .copyright-bottom {
      text-align: center;
    }

    .copyright-edition {
      font-weight: 700;
      color: #1c1917;
      margin-bottom: 4px;
    }

    .copyright-legal {
      font-size: 7.5pt;
      color: #78716c;
      line-height: 1.4;
    }

    /* Table of Contents (Sumário) */
    .pdf-toc-page {
      padding-top: 4mm;
    }

    .toc-heading {
      text-align: center;
      font-family: sans-serif;
      font-size: 13pt;
      letter-spacing: 3px;
      margin-bottom: 24px;
      border-bottom: 2px solid #1c1917;
      padding-bottom: 8px;
    }

    .toc-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 10pt;
      break-inside: avoid;
    }

    .toc-link {
      text-decoration: none;
      color: inherit;
      display: flex;
      align-items: baseline;
      width: 100%;
    }

    .toc-badge {
      font-family: sans-serif;
      font-size: 7.5pt;
      background: #1c1917;
      color: #ffffff;
      padding: 2px 6px;
      margin-right: 8px;
      letter-spacing: 1px;
      font-weight: 700;
    }

    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #a8a29e;
      margin: 0 10px;
    }

    .toc-page-number {
      font-family: sans-serif;
      font-size: 9pt;
      font-weight: 700;
      color: #1c1917;
    }

    /* Chapters & Sections */
    .chapter-opening {
      padding-top: 8mm;
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .chapter-badge {
      font-family: sans-serif;
      font-size: 8.5pt;
      letter-spacing: 3px;
      color: #78716c;
      font-weight: 700;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 6px;
    }

    .chapter-title, .section-title {
      font-size: 20pt;
      font-style: italic;
      text-align: center;
      margin-bottom: 24px;
      border-bottom: 1px solid #d6d3d1;
      padding-bottom: 12px;
      color: #0f0e0d;
      page-break-after: avoid;
      break-after: avoid;
    }

    .chapter-content, .section-content {
      text-align: justify;
      text-justify: inter-word;
      hyphens: auto;
      -webkit-hyphens: auto;
      overflow-wrap: break-word;
    }

    /* TYPOGRAPHY MODE: Literary (Ficção) */
    .pdf-mode-literary p.p-subsequent {
      text-indent: 1.5em;
      margin-top: 0;
      margin-bottom: 0;
      line-height: 1.6;
    }

    .pdf-mode-literary p.p-first {
      text-indent: 0;
      margin-top: 0;
      margin-bottom: 0;
    }

    /* TYPOGRAPHY MODE: Nonfiction (Não-Ficção) */
    .pdf-mode-nonfiction p {
      text-indent: 0;
      margin-top: 0;
      margin-bottom: 8pt;
      line-height: 1.55;
    }

    .pdf-mode-nonfiction p.p-first {
      margin-top: 0;
    }

    /* DROP CAP STYLING */
    .pdf-use-drop-cap p.p-first::first-letter {
      font-size: 3.2em;
      float: left;
      line-height: 0.8;
      margin-right: 8px;
      margin-top: 2px;
      font-family: 'Georgia', serif;
      font-weight: 700;
      color: #1c1917;
    }

    .pdf-no-drop-cap p.p-first::first-letter {
      font-size: inherit !important;
      float: none !important;
      line-height: inherit !important;
      margin: 0 !important;
      font-weight: inherit !important;
      color: inherit !important;
    }

    /* Headings inside markdown content */
    h2.print-h2 {
      font-family: sans-serif;
      font-size: 13pt;
      margin-top: 22px;
      margin-bottom: 10px;
      color: #1c1917;
      page-break-after: avoid;
      break-after: avoid;
    }

    h3.print-h3 {
      font-family: sans-serif;
      font-size: 11pt;
      margin-top: 18px;
      margin-bottom: 8px;
      color: #44403c;
      page-break-after: avoid;
      break-after: avoid;
    }

    h4.print-h4 {
      font-family: sans-serif;
      font-size: 9.5pt;
      font-weight: 700;
      margin-top: 14px;
      margin-bottom: 6px;
      color: #57534e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Blockquotes & Lists */
    blockquote.print-quote {
      margin: 18px 24px;
      font-style: italic;
      border-left: 2px solid #a8a29e;
      padding-left: 14px;
      color: #44403c;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    ul.print-ul, ol.print-ol {
      margin: 14px 0 14px 28px;
      padding: 0;
    }

    ul.print-ul li, ol.print-ol li {
      margin-bottom: 6px;
      line-height: 1.5;
    }

    ul.print-ul ul, ol.print-ol ol, ul.print-ul ol, ol.print-ol ul {
      margin: 6px 0 6px 20px;
    }

    /* Tables */
    table.print-table {
      width: 100%;
      margin: 16px 0;
      border-collapse: collapse;
      font-size: 8.5pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    table.print-table th, table.print-table td {
      border: 1px solid #d6d3d1;
      padding: 6px 8px;
      text-align: left;
    }

    table.print-table th {
      background-color: #f5f5f4;
      font-family: sans-serif;
      font-weight: 700;
    }

    /* PRINT MEDIA OVERRIDES */
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: ${isA5 ? '10pt' : '11pt'} !important;
      }

      .no-print-toolbar {
        display: none !important;
      }

      @page {
        size: ${metrics.widthMm}mm ${metrics.heightMm}mm;
      }

      @page :right {
        margin: ${metrics.topMarginMm}mm ${metrics.outerMarginMm}mm ${metrics.bottomMarginMm}mm ${metrics.innerMarginMm}mm;
      }

      @page :left {
        margin: ${metrics.topMarginMm}mm ${metrics.innerMarginMm}mm ${metrics.bottomMarginMm}mm ${metrics.outerMarginMm}mm;
      }

      @page :first {
        margin: 0 !important;
      }

      .print-pages-wrapper {
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
        width: 100% !important;
      }

      .page-sheet {
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
        height: auto !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
        page-break-after: always !important;
        break-after: page !important;
      }

      .page-sheet:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      .page-sheet.cover-sheet {
        width: ${metrics.widthMm}mm !important;
        height: ${metrics.heightMm}mm !important;
        max-width: 100% !important;
        max-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .pdf-title-page, .pdf-copyright-page {
        min-height: ${metrics.contentHeightMm}mm !important;
        height: ${metrics.contentHeightMm}mm !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        box-sizing: border-box !important;
      }

      .chapter-title, .section-title, .chapter-badge, .chapter-opening, h1, h2, h3, h4, .toc-heading {
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      blockquote, .catalog-card, .toc-row, table.print-table {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      p {
        orphans: 2;
        widows: 2;
      }
    }
  `;
}
