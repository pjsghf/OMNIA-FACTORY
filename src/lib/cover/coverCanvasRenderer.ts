import {
  CoverBrief,
  COVER_FORMAT_SPECS,
  calculateSpineWidthMm,
} from './coverBrief';

export type CoverOverlayLayer =
  'none' | 'editorial_3d' | 'selo_vidro' | 'textura_papel' | 'ribbon_gold' | 'manga_gloss';

export interface RenderCoverOptions {
  brief: CoverBrief;
  backgroundImageUrl?: string;
  overlay: CoverOverlayLayer;
  totalPageCount?: number;
  renderFullPrintWrap?: boolean;
}

/**
 * Escapes XML strings for SVG generation
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Splits text into lines that fit within maxCharLength
 */
function wrapText(text: string, maxCharPerLine: number = 24): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Renders a complete standalone SVG asset with artwork, overlay effects, and deterministic typography burned in.
 */
export function renderCompositeCoverSvg(options: RenderCoverOptions): string {
  const { brief, backgroundImageUrl, overlay, totalPageCount = 200, renderFullPrintWrap } = options;
  const spec = COVER_FORMAT_SPECS[brief.formatProfile || 'ebook'];

  const width = spec.widthPx;
  const height = spec.heightPx;

  const safeTitle = escapeXml(brief.title || 'Sem Título');
  const safeAuthor = escapeXml(brief.author || 'Autor Exemplo');
  const safePublisher = escapeXml(brief.publisher || 'EDITORA OMNIA');

  const titleLines = wrapText(brief.title, 20);
  const subtitleLines = wrapText(brief.subtitle, 35);

  // Define visual accents based on genre/style
  const styleLower = (brief.genreStyle || '').toLowerCase();
  let theme = {
    bgFrom: '#1C1917',
    bgTo: '#0C0A09',
    accent: '#F59E0B',
    titleColor: '#FFFFFF',
    subColor: '#E7E5E4',
    badgeText: '★ EDIÇÃO DE COLECIONADOR OMNIA ★',
  };

  if (styleLower.includes('ficcao') || styleLower.includes('misterio')) {
    theme = {
      bgFrom: '#022C22',
      bgTo: '#021D17',
      accent: '#10B981',
      titleColor: '#F0FDF4',
      subColor: '#A7F3D0',
      badgeText: '★ LITERATURA EDITORIAL OMNIA ★',
    };
  } else if (styleLower.includes('negocios') || styleLower.includes('tecnico')) {
    theme = {
      bgFrom: '#0F172A',
      bgTo: '#020617',
      accent: '#38BDF8',
      titleColor: '#F0F9FF',
      subColor: '#BAE6FD',
      badgeText: '★ EDIÇÃO EXECUTIVA OMNIA ★',
    };
  } else if (styleLower.includes('desenvolvimento') || styleLower.includes('autoajuda')) {
    theme = {
      bgFrom: '#451A03',
      bgTo: '#1A0801',
      accent: '#FBBF24',
      titleColor: '#FFFBEB',
      subColor: '#FDE68A',
      badgeText: '★ DESENVOLVIMENTO PESSOAL OMNIA ★',
    };
  }

  // Handle Full Print Wrap (Back Cover + Spine + Front Cover)
  if (renderFullPrintWrap && spec.isPrint) {
    const spineMm = calculateSpineWidthMm(totalPageCount);
    // 300 DPI: 1mm = 11.811 px
    const spinePx = Math.round(spineMm * 11.811);
    const coverPx = width; // front cover width
    const totalWrapWidth = coverPx * 2 + spinePx;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWrapWidth} ${height}" width="${totalWrapWidth}" height="${height}">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.bgFrom}"/>
          <stop offset="100%" stop-color="${theme.bgTo}"/>
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${totalWrapWidth}" height="${height}" fill="url(#bgGrad)"/>

      <!-- BACK COVER -->
      <rect x="0" y="0" width="${coverPx}" height="${height}" fill="none" />
      <text x="${coverPx / 2}" y="120" text-anchor="middle" font-family="'Georgia', serif" font-size="28" font-weight="bold" fill="${theme.accent}">
        ${safePublisher}
      </text>
      <text x="${coverPx / 2}" y="180" text-anchor="middle" font-family="'Georgia', serif" font-size="36" font-weight="bold" font-style="italic" fill="${theme.titleColor}">
        ${safeTitle}
      </text>
      <foreignObject x="60" y="240" width="${coverPx - 120}" height="${height - 380}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color: ${theme.subColor}; font-family: Georgia, serif; font-size: 18px; line-height: 1.6; text-align: justify;">
          ${escapeXml(brief.promise || brief.targetAudience || 'Obra extraordinária concebida e publicada com rigor editorial OMNIA.')}
        </div>
      </foreignObject>
      <!-- Barcode Placeholder Box -->
      <rect x="${coverPx - 220}" y="${height - 120}" width="160" height="70" fill="#FFFFFF" stroke="#000" stroke-width="1"/>
      <text x="${coverPx - 140}" y="${height - 75}" text-anchor="middle" font-family="monospace" font-size="12" fill="#000000">ISBN 978-65-80000-00-0</text>

      <!-- SPINE -->
      <rect x="${coverPx}" y="0" width="${spinePx}" height="${height}" fill="${theme.bgTo}" stroke="${theme.accent}" stroke-width="1"/>
      <text x="${coverPx + spinePx / 2}" y="${height / 2}" text-anchor="middle" transform="rotate(-90 ${coverPx + spinePx / 2} ${height / 2})" font-family="'Georgia', serif" font-size="20" font-weight="bold" fill="${theme.titleColor}">
        ${safeTitle} — ${safeAuthor}
      </text>

      <!-- FRONT COVER -->
      <g transform="translate(${coverPx + spinePx}, 0)">
        ${backgroundImageUrl ? `<image href="${escapeXml(backgroundImageUrl)}" width="${coverPx}" height="${height}" preserveAspectRatio="xMidYMid slice" />` : ''}
        <rect width="${coverPx}" height="${height}" fill="rgba(0,0,0,0.35)"/>
        
        <text x="${coverPx / 2}" y="100" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="${theme.accent}" letter-spacing="4">
          ${theme.badgeText}
        </text>

        ${titleLines
          .map(
            (line, i) => `
          <text x="${coverPx / 2}" y="${220 + i * 50}" text-anchor="middle" font-family="'Georgia', serif" font-size="42" font-weight="bold" font-style="italic" fill="${theme.titleColor}">
            ${escapeXml(line)}
          </text>
        `
          )
          .join('')}

        ${subtitleLines
          .map(
            (line, i) => `
          <text x="${coverPx / 2}" y="${220 + titleLines.length * 50 + 40 + i * 28}" text-anchor="middle" font-family="'Georgia', serif" font-size="20" fill="${theme.subColor}">
            ${escapeXml(line)}
          </text>
        `
          )
          .join('')}

        <line x1="100" y1="${height - 150}" x2="${coverPx - 100}" y2="${height - 150}" stroke="${theme.accent}" stroke-width="2"/>

        <text x="${coverPx / 2}" y="${height - 100}" text-anchor="middle" font-family="'Georgia', serif" font-size="26" font-weight="bold" fill="${theme.titleColor}">
          ${safeAuthor}
        </text>

        <text x="${coverPx / 2}" y="${height - 60}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="${theme.accent}" letter-spacing="3">
          ${safePublisher}
        </text>
      </g>
    </svg>`;
  }

  // Single Front Cover (Ebook / Catalog / Preview)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bgFrom}" />
        <stop offset="100%" stop-color="${theme.bgTo}" />
      </linearGradient>

      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.8"/>
      </filter>
    </defs>

    <!-- Background Base -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Optional Art Artwork Image -->
    ${backgroundImageUrl ? `<image href="${escapeXml(backgroundImageUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />` : ''}

    <!-- Contrast Scrim -->
    <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.4)" />

    <!-- Overlay Effects -->
    ${
      overlay === 'selo_vidro'
        ? `
      <rect x="${width * 0.1}" y="${height * 0.15}" width="${width * 0.8}" height="${height * 0.7}" rx="16" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" stroke-width="2" />
    `
        : ''
    }

    ${
      overlay === 'ribbon_gold'
        ? `
      <polygon points="0,0 160,0 0,160" fill="${theme.accent}" opacity="0.95"/>
      <text x="35" y="55" transform="rotate(-45 35 55)" font-family="sans-serif" font-size="14" font-weight="bold" fill="#000">OMNIA GOLD</text>
    `
        : ''
    }

    ${
      overlay === 'manga_gloss'
        ? `
      <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="${theme.accent}" stroke-width="12" />
    `
        : ''
    }

    <!-- Frame Lines -->
    <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="0.7" />

    <!-- Publisher Header -->
    <text x="${width / 2}" y="90" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="${theme.accent}" letter-spacing="4" filter="url(#shadow)">
      ${theme.badgeText}
    </text>

    <!-- Title Block -->
    <g filter="url(#shadow)">
      ${titleLines
        .map(
          (line, i) => `
        <text x="${width / 2}" y="${220 + i * 50}" text-anchor="middle" font-family="'Georgia', 'Times New Roman', serif" font-size="42" font-weight="bold" font-style="italic" fill="${theme.titleColor}">
          ${escapeXml(line)}
        </text>
      `
        )
        .join('')}

      ${subtitleLines
        .map(
          (line, i) => `
        <text x="${width / 2}" y="${220 + titleLines.length * 50 + 35 + i * 26}" text-anchor="middle" font-family="'Georgia', serif" font-size="18" fill="${theme.subColor}">
          ${escapeXml(line)}
        </text>
      `
        )
        .join('')}
    </g>

    <!-- Author & Publisher Footer -->
    <g filter="url(#shadow)">
      <line x1="120" y1="${height - 140}" x2="${width - 120}" y2="${height - 140}" stroke="${theme.accent}" stroke-width="2"/>

      <text x="${width / 2}" y="${height - 95}" text-anchor="middle" font-family="'Georgia', serif" font-size="28" font-weight="bold" fill="${theme.titleColor}">
        ${safeAuthor}
      </text>

      <text x="${width / 2}" y="${height - 55}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="${theme.accent}" letter-spacing="3">
        ${safePublisher}
      </text>
    </g>
  </svg>`;
}

/**
 * Converts an SVG string into a UTF-8 Data URI
 */
export function svgToDataUri(svgString: string): string {
  const encoded = encodeURIComponent(svgString).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
