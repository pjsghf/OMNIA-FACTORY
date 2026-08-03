import { getPageMetrics } from '../src/lib/pdf/pageMetrics';
import { renderMarkdownForPrint, ensureNodeJsdom } from '../src/lib/pdf/markdownRenderer';
import { buildPrintableCoverHtml } from '../src/lib/pdf/coverRenderer';
import { renderCatalogPageHtml } from '../src/lib/pdf/catalogRenderer';
import { buildPrintableBookHtml } from '../src/lib/pdf/printTemplate';
import { BookProject } from '../src/types';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function runAuditTests() {
  await ensureNodeJsdom();
  console.log('=== STARTING AUDIT TESTS FOR PDF EXPORT ENGINE ===\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // 1. Page Metrics Test
  const a5Metrics = getPageMetrics('A5');
  assert(a5Metrics.widthMm === 148 && a5Metrics.heightMm === 210, 'A5 Metrics exact 148x210 mm');
  assert(a5Metrics.contentHeightMm === 174, 'A5 Content Height calculation = 174 mm');

  const a4Metrics = getPageMetrics('A4');
  assert(a4Metrics.widthMm === 210 && a4Metrics.heightMm === 297, 'A4 Metrics exact 210x297 mm');
  assert(a4Metrics.contentHeightMm === 253, 'A4 Content Height calculation = 253 mm');

  // 2. Markdown Parsing & Single Drop Cap Test
  const testMd = `
Primeiro parágrafo do capítulo. Ele deve receber apenas uma capitular p-first.

## Primeiro subtítulo

Este parágrafo não deve receber uma nova capitular p-first.

- Item 1
- Item 2
  - Subitem A

> Esta é uma citação importante.
>
> Segundo parágrafo da citação.

| Coluna A | Coluna B |
|---|---|
| Dado 1 | Dado 2 |

<script>alert('xss-test')</script>
<img src="x" onerror="alert('xss-img')">
`;

  const renderedHtml = renderMarkdownForPrint(testMd);
  const pFirstMatches = (renderedHtml.match(/class="[^"]*p-first[^"]*"/g) || []).length;
  assert(pFirstMatches === 1, 'Markdown parsing applies p-first to EXACTLY 1 top-level paragraph');
  assert(!renderedHtml.includes('<script>') && !renderedHtml.includes('onerror='), 'DOMPurify & markdown-it strip out executable <script> tags and onerror XSS attributes');
  assert(renderedHtml.includes('print-table'), 'Markdown parsing adds print-table class to tables');
  assert(renderedHtml.includes('print-quote'), 'Markdown parsing adds print-quote class to blockquotes');

  // 3. Cover Renderer Modes
  const coverOverlay = buildPrintableCoverHtml({
    title: 'Livro Teste',
    author: 'Autor Teste',
    year: 2026,
    overlayMode: 'overlay',
    imageUrl: 'https://example.com/cover.jpg',
  });
  assert(coverOverlay.includes('print-cover-editorial-overlay'), 'Cover overlay mode generates editorial overlay container');

  const coverCard = buildPrintableCoverHtml({
    title: 'Livro Teste',
    author: 'Autor Teste',
    year: 2026,
    overlayMode: 'card',
    imageUrl: 'https://example.com/cover.jpg',
  });
  assert(coverCard.includes('print-cover-card'), 'Cover card mode generates floating card container');

  const coverNone = buildPrintableCoverHtml({
    title: 'Livro Teste',
    author: 'Autor Teste',
    year: 2026,
    overlayMode: 'none',
    imageUrl: 'https://example.com/cover.jpg',
  });
  assert(!coverNone.includes('print-cover-card') && !coverNone.includes('print-cover-editorial-overlay'), 'Cover none mode generates plain image with no text overlay');

  const coverFallback = buildPrintableCoverHtml({
    title: 'Livro Teste',
    author: 'Autor Teste',
    year: 2026,
    overlayMode: 'overlay',
    imageUrl: '',
  });
  assert(coverFallback.includes('print-cover--fallback'), 'Cover fallback generates typographic frame when no image is present');

  // 4. Cataloging / CIP Audit (No fake ISBNs)
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

  const catalogHtmlUnfilled = renderCatalogPageHtml(mockProject, {
    paperSize: 'A5',
    typographyMode: 'nonfiction',
    coverOverlayMode: 'none',
    useDropCap: true,
  });

  assert(!catalogHtmlUnfilled.includes('978-65-80000-00-0'), 'Catalog renderer contains ZERO fake 978-65 ISBN default placeholders');
  assert(!catalogHtmlUnfilled.includes('CDD 800.8'), 'Catalog renderer contains ZERO fake default CDDs');

  // 5. Full HTML Print Package
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

  assert(fullHtml.includes('<!DOCTYPE html>'), 'Full printable HTML package builds valid DOCTYPE');
  assert(fullHtml.includes('capitulo-1'), 'Full printable HTML contains chapter anchor IDs');

  // 6. Real Puppeteer PDF Generation Test
  console.log('\n--- Launching Puppeteer to generate actual test PDF ---');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      width: '148mm',
      height: '210mm',
    });

    const isPdfHeader = Buffer.from(pdfBuffer).subarray(0, 4).toString('utf-8') === '%PDF';
    assert(isPdfHeader, 'Puppeteer successfully rendered a valid binary %PDF document');

    const outputDir = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const pdfPath = path.join(outputDir, 'test_audit_book_a5.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`Saved PDF artifact to: ${pdfPath} (${pdfBuffer.length} bytes)`);

  } catch (err: any) {
    console.error('Puppeteer rendering error:', err);
    assert(false, 'Puppeteer PDF generation passed without runtime errors');
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\n=== AUDIT TEST RESULTS: ${passedCount}/${totalCount} PASSED ===`);
  if (passedCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAuditTests();
