import { PdfPaperSize } from './types';

export interface PdfPageMetrics {
  paperSize: PdfPaperSize;
  widthMm: number;
  heightMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
  innerMarginMm: number;
  outerMarginMm: number;
  contentHeightMm: number;
  displaySizeCm: string;
}

export const PDF_PAGE_METRICS: Record<PdfPaperSize, PdfPageMetrics> = {
  A5: {
    paperSize: 'A5',
    widthMm: 148,
    heightMm: 210,
    topMarginMm: 18,
    bottomMarginMm: 18,
    innerMarginMm: 18,
    outerMarginMm: 15,
    contentHeightMm: 174,
    displaySizeCm: '14,8 × 21 cm',
  },
  A4: {
    paperSize: 'A4',
    widthMm: 210,
    heightMm: 297,
    topMarginMm: 22,
    bottomMarginMm: 22,
    innerMarginMm: 20,
    outerMarginMm: 18,
    contentHeightMm: 253,
    displaySizeCm: '21 × 29,7 cm',
  },
};

export function getPageMetrics(size: PdfPaperSize): PdfPageMetrics {
  return PDF_PAGE_METRICS[size] || PDF_PAGE_METRICS.A5;
}
