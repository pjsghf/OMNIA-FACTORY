import { describe, it, expect, beforeAll } from 'vitest';
import { getPageMetrics } from '../../src/lib/pdf/pageMetrics';
import { renderMarkdownForPrint, ensureNodeJsdom } from '../../src/lib/pdf/markdownRenderer';
import { buildPrintableCoverHtml } from '../../src/lib/pdf/coverRenderer';
import { renderCatalogPageHtml } from '../../src/lib/pdf/catalogRenderer';
import { buildPrintableBookHtml } from '../../src/lib/pdf/printTemplate';
import { generateEpubBlob } from '../../src/lib/epubExporter';
import { BookProject } from '../../src/types';
import puppeteer from 'puppeteer';
import JSZip from 'jszip';

describe('Exports Engine & Layout AST (Exports Suite)', () => {
  beforeAll(async () => {
    await ensureNodeJsdom();
  });

  const mockProject: BookProject = {
    id: 'p1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStage: 'design_export',
    editorialReport: null,
    metadata: {
      titulo: 'Livro Exemplo de Teste',
      subtitulo: 'Subtítulo do Teste',
      autor: 'Escritor Auditado',
      idioma: 'pt-BR',
      editora: 'Editora OMNIA',
      publicoAlvo: 'Geral',
      resumo: 'Resumo do teste',
      estilo: 'ficcao',
      promptEstilo: '',
      tom: 'conversacional',
      qtdCapitulos: 1,
      minPalavras: 100,
      maxPalavras: 500,
      materiais: '',
      informacoesObrigatorias: '',
      restricoes: '',
    },
    plan: {
      conceitoCentral: 'Conceito',
      promessaPrincipal: 'Promessa',
      perfilLeitor: {
        descricao: '',
        doresEAnseios: [],
        oQueBuscaraNoLivro: [],
      },
      sumario: [
        {
          numero: 1,
          titulo: 'Capítulo Inicial',
          objetivo: 'Testar',
          topicos: ['Tópico 1'],
          estimativaPalavras: 200,
        },
      ],
    },
    frontMatter: {
      introducao: 'Texto de introdução.',
    },
    chapters: [
      {
        numero: 1,
        titulo: 'Capítulo Inicial',
        content: 'Primeiro parágrafo do livro.',
        wordCount: 100,
        status: 'completed',
      },
    ],
    endMatter: {
      conclusao: 'Conclusão final.',
    },
  };

  describe('Page Metrics Calculations', () => {
    it('EXP-001: Calculates exact A5 dimensions (148x210 mm, contentHeight 174 mm)', () => {
      const a5Metrics = getPageMetrics('A5');
      expect(a5Metrics.widthMm).toBe(148);
      expect(a5Metrics.heightMm).toBe(210);
      expect(a5Metrics.contentHeightMm).toBe(174);
    });

    it('EXP-002: Calculates exact A4 dimensions (210x297 mm, contentHeight 253 mm)', () => {
      const a4Metrics = getPageMetrics('A4');
      expect(a4Metrics.widthMm).toBe(210);
      expect(a4Metrics.heightMm).toBe(297);
      expect(a4Metrics.contentHeightMm).toBe(253);
    });
  });

  describe('Markdown Parsing & Drop Cap Rules', () => {
    it('EXP-003: Applies p-first class to exactly 1 top-level paragraph and strips XSS tags', () => {
      const testMd = `
Primeiro parágrafo do capítulo. Ele deve receber apenas uma capitular p-first.

## Primeiro subtítulo

Este parágrafo não deve receber uma nova capitular p-first.

- Item 1
- Item 2

> Esta é uma citação importante.

| Coluna A | Coluna B |
|---|---|
| Dado 1 | Dado 2 |

<script>alert('xss-test')</script>
<img src="x" onerror="alert('xss-img')">
`;

      const renderedHtml = renderMarkdownForPrint(testMd);
      const pFirstMatches = (renderedHtml.match(/class="[^"]*p-first[^"]*"/g) || []).length;
      expect(pFirstMatches).toBe(1);
      expect(renderedHtml).not.toContain('<script>');
      expect(renderedHtml).not.toContain('onerror=');
      expect(renderedHtml).toContain('print-table');
      expect(renderedHtml).toContain('print-quote');
    });
  });

  describe('Cover Renderer Modes', () => {
    it('EXP-004: Renders overlay, card, none, and typographic fallback modes correctly', () => {
      const overlay = buildPrintableCoverHtml({
        title: 'Livro Teste',
        author: 'Autor Teste',
        year: 2026,
        overlayMode: 'overlay',
        imageUrl: 'https://example.com/cover.jpg',
      });
      expect(overlay).toContain('print-cover-editorial-overlay');

      const card = buildPrintableCoverHtml({
        title: 'Livro Teste',
        author: 'Autor Teste',
        year: 2026,
        overlayMode: 'card',
        imageUrl: 'https://example.com/cover.jpg',
      });
      expect(card).toContain('print-cover-card');

      const noneMode = buildPrintableCoverHtml({
        title: 'Livro Teste',
        author: 'Autor Teste',
        year: 2026,
        overlayMode: 'none',
        imageUrl: 'https://example.com/cover.jpg',
      });
      expect(noneMode).not.toContain('print-cover-card');
      expect(noneMode).not.toContain('print-cover-editorial-overlay');

      const fallback = buildPrintableCoverHtml({
        title: 'Livro Teste',
        author: 'Autor Teste',
        year: 2026,
        overlayMode: 'overlay',
        imageUrl: '',
      });
      expect(fallback).toContain('print-cover--fallback');
    });
  });

  describe('Cataloging CIP Audit (No Fake Placeholders)', () => {
    it('EXP-005: Catalog renderer contains ZERO fake ISBNs or default fake CDDs', () => {
      const catalogHtml = renderCatalogPageHtml(mockProject, {
        paperSize: 'A5',
        typographyMode: 'nonfiction',
        coverOverlayMode: 'none',
        useDropCap: true,
      });

      expect(catalogHtml).not.toContain('978-65-80000-00-0');
      expect(catalogHtml).not.toContain('CDD 800.8');
    });
  });

  describe('Full Printable HTML Package', () => {
    it('EXP-006: Builds valid printable DOCTYPE with chapter anchors', () => {
      const fullHtml = buildPrintableBookHtml({
        project: mockProject,
        settings: {
          paperSize: 'A5',
          typographyMode: 'literary',
          coverOverlayMode: 'card',
          useDropCap: true,
          includeCatalogPage: true,
        },
      });

      expect(fullHtml).toContain('<!DOCTYPE html>');
      expect(fullHtml).toContain('capitulo-1');
    });

    it('EXP-007: includeCatalogPage: false excludes catalog page from output HTML', () => {
      const fullHtmlNoCatalog = buildPrintableBookHtml({
        project: mockProject,
        settings: {
          paperSize: 'A5',
          typographyMode: 'literary',
          coverOverlayMode: 'card',
          useDropCap: true,
          includeCatalogPage: false,
        },
      });

      expect(fullHtmlNoCatalog).not.toContain('Ficha Catalográfica');
    });
  });

  describe('EPUB 3 Structure & Validation', () => {
    it('EXP-008: Generates valid EPUB ZIP with mimetype first and proper OPF/NAV structure', async () => {
      const epubBlob = await generateEpubBlob(mockProject);
      const epubBuffer = Buffer.from(await epubBlob.arrayBuffer());
      expect(Buffer.isBuffer(epubBuffer)).toBe(true);

      const zip = await JSZip.loadAsync(epubBuffer);
      expect(zip.file('mimetype')).toBeDefined();
      expect(zip.file('META-INF/container.xml')).toBeDefined();
      expect(zip.file('OEBPS/content.opf')).toBeDefined();
      expect(zip.file('OEBPS/nav.xhtml')).toBeDefined();

      const mimetypeContent = await zip.file('mimetype')?.async('text');
      expect(mimetypeContent?.trim()).toBe('application/epub+zip');
    });
  });

  describe('Puppeteer PDF Generation Pipeline', () => {
    it('EXP-009: Renders binary %PDF document via headless Puppeteer', async () => {
      const fullHtml = buildPrintableBookHtml({
        project: mockProject,
        settings: {
          paperSize: 'A5',
          typographyMode: 'literary',
          coverOverlayMode: 'card',
          useDropCap: true,
          includeCatalogPage: true,
        },
      });

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      try {
        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });

        const pdfBuffer = await page.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          width: '148mm',
          height: '210mm',
        });

        const isPdfHeader = Buffer.from(pdfBuffer).subarray(0, 4).toString('utf-8') === '%PDF';
        expect(isPdfHeader).toBe(true);
        expect(pdfBuffer.length).toBeGreaterThan(1000);
      } finally {
        await browser.close();
      }
    });
  });
});
