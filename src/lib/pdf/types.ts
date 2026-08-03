import { BookProject } from '../../types';

export type PdfPaperSize = 'A5' | 'A4';
export type PdfTypographyMode = 'literary' | 'nonfiction';
export type CoverOverlayMode = 'overlay' | 'card' | 'none';

export interface BookCatalogMetadata {
  enabled?: boolean;
  isbn?: string;
  cdd?: string;
  edition?: string;
  city?: string;
  publisher?: string;
  year?: string | number;
  subjects?: string[];
  catalogText?: string;
  isOfficial?: boolean;
}

export interface PdfExportSettings {
  paperSize: PdfPaperSize;
  typographyMode: PdfTypographyMode;
  coverOverlayMode: CoverOverlayMode;
  useDropCap: boolean;
  includeCatalogPage?: boolean;
  catalogMetadata?: BookCatalogMetadata;
}

export interface PrintableBookOptions {
  project: BookProject;
  settings: PdfExportSettings;
}
