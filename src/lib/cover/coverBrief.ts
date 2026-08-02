/**
 * Cover Brief & Asset Specification
 * Strict schema, format profiles, spine calculation, upload validation and license tracking.
 */

export type CoverFormatProfile = 'ebook' | 'print_a5' | 'print_trade_6x9' | 'square_catalog';

export interface CoverFormatSpec {
  id: CoverFormatProfile;
  name: string;
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
  bleedMm: number;
  isPrint: boolean;
  widthMm?: number;
  heightMm?: number;
}

export const COVER_FORMAT_SPECS: Record<CoverFormatProfile, CoverFormatSpec> = {
  ebook: {
    id: 'ebook',
    name: 'Ebook Digital (1:1.6)',
    widthPx: 1000,
    heightPx: 1600,
    aspectRatio: 1.6,
    bleedMm: 0,
    isPrint: false,
  },
  print_a5: {
    id: 'print_a5',
    name: 'Impressão A5 (148 x 210 mm)',
    widthPx: 1748, // 300 DPI + 3mm bleed
    heightPx: 2480,
    aspectRatio: 1.418,
    bleedMm: 3,
    isPrint: true,
    widthMm: 148,
    heightMm: 210,
  },
  print_trade_6x9: {
    id: 'print_trade_6x9',
    name: 'Impressão Trade (6 x 9 polegadas)',
    widthPx: 1800, // 300 DPI + 3mm bleed
    heightPx: 2700,
    aspectRatio: 1.5,
    bleedMm: 3,
    isPrint: true,
    widthMm: 152.4,
    heightMm: 228.6,
  },
  square_catalog: {
    id: 'square_catalog',
    name: 'Catálogo / Vitrine Quadrada (1:1)',
    widthPx: 1200,
    heightPx: 1200,
    aspectRatio: 1.0,
    bleedMm: 0,
    isPrint: false,
  },
};

export interface CoverBrief {
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  genreStyle: string;
  targetAudience: string;
  tone: string;
  promise: string;
  desiredSymbols: string[];
  forbiddenSymbols: string[];
  colorPalette: string;
  briefVersion: number;
  formatProfile: CoverFormatProfile;
}

export interface CoverAssetMetadata {
  id: string;
  url: string;
  origin: 'ai' | 'fallback_svg' | 'upload';
  license: 'unrestricted_ai' | 'user_owned' | 'fallback_template';
  briefVersion: number;
  providerUsed: string;
  formatProfile: CoverFormatProfile;
  createdAt: string;
  dimensionsPx: { width: number; height: number };
  hasEmbeddedTypography: boolean;
  activeOverlays: string[];
}

/**
 * Calculates spine width in mm based on total page count and paper weight (GSM)
 */
export function calculateSpineWidthMm(pageCount: number, paperGsm: number = 80): number {
  if (!pageCount || pageCount <= 0) return 3;
  // Standard 80g offset paper thickness = ~0.052mm per sheet (2 pages = 1 sheet)
  const sheets = Math.ceil(pageCount / 2);
  const sheetThicknessMm = paperGsm === 90 ? 0.058 : paperGsm === 120 ? 0.075 : 0.052;
  const spineMm = sheets * sheetThicknessMm;
  // Minimum binding width 3mm, maximum 60mm
  return Math.min(60, Math.max(3, Math.round(spineMm * 10) / 10));
}

export interface UploadValidationResult {
  valid: boolean;
  mimeType?: string;
  error?: string;
  dimensions?: { width: number; height: number };
}

/**
 * Validates uploaded user images against magic bytes signatures, file size limit (10MB), and disallowed SVG/script formats
 */
export function validateUploadedImageBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  claimedMime: string
): UploadValidationResult {
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.length === 0) {
    return { valid: false, error: 'O arquivo está vazio (0 bytes).' };
  }

  if (bytes.length > MAX_SIZE_BYTES) {
    return { valid: false, error: 'O arquivo excede o limite máximo permitido de 10 MB.' };
  }

  // Reject SVG uploads directly to prevent XSS / script injection via SVG
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'svg' || claimedMime.includes('svg')) {
    return {
      valid: false,
      error: 'Arquivos SVG não são aceitos no upload do usuário por motivos de segurança. Por favor utilize PNG, JPEG ou WebP.',
    };
  }

  // Magic bytes check
  // PNG: 89 50 4E 47
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  // JPEG: FF D8 FF
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  // WebP: RIFF ... WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  const isWebP =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (!isPng && !isJpeg && !isWebP) {
    return {
      valid: false,
      error: 'Formato de imagem inválido ou assinatura corrompida. Formatos aceitos: PNG, JPEG, WebP.',
    };
  }

  const detectedMime = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'image/webp';

  return {
    valid: true,
    mimeType: detectedMime,
  };
}
