import JSZip from 'jszip';
import { BookProject } from '../types';
import { parseMarkdownToAST, renderASTToXHTML, escapeXML } from './rendering/editorialAST';

/**
 * Ensures a valid RFC4122 UUID string format for EPUB dc:identifier
 */
function getValidUuid(projectId: string): string {
  // If id is already a UUID format like '78b0051b-691f-44de-8a94-ac2846ce939c'
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(projectId)) {
    return projectId;
  }
  // Construct deterministic pseudo-UUID from timestamp/id
  const clean = projectId.replace(/[^a-f0-9]/gi, '').padEnd(32, '0').slice(0, 32);
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-4${clean.slice(13, 16)}-8${clean.slice(17, 20)}-${clean.slice(20, 32)}`;
}

/**
 * Normalizes language to BCP 47 (e.g. 'pt-BR', 'en-US', 'es-ES')
 */
function getBcp47Language(langString?: string): string {
  if (!langString) return 'pt-BR';
  const lower = langString.toLowerCase();
  if (lower.includes('portug') || lower.includes('pt')) return 'pt-BR';
  if (lower.includes('ingl') || lower.includes('en')) return 'en-US';
  if (lower.includes('espanh') || lower.includes('es')) return 'es-ES';
  return 'pt-BR';
}

export async function generateEpubBlob(project: BookProject): Promise<Blob> {
  const zip = new JSZip();
  const lang = getBcp47Language(project.metadata.idioma);
  const uuid = getValidUuid(project.id);
  const publisherName = project.metadata.editora || 'Editora OMNIA';

  // 1. mimetype (must be STORED uncompressed per EPUB 3 specification)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. OEBPS/styles.css - High Quality Typography
  const styles = `
@namespace epub "http://www.idpf.org/2007/ops";

body {
  font-family: 'Georgia', 'Garamond', 'Palatino Linotype', 'Times New Roman', serif;
  line-height: 1.75;
  margin: 5%;
  color: #1c1917;
  font-size: 1em;
}

h1, h2, h3, h4 {
  font-family: 'Georgia', serif;
  color: #0f0e0d;
  font-weight: bold;
  letter-spacing: -0.01em;
}

h1.chapter-title {
  font-size: 2.1em;
  font-style: italic;
  text-align: center;
  margin-top: 1.5em;
  margin-bottom: 1.2em;
  border-bottom: 1px solid #d6d3d1;
  padding-bottom: 0.5em;
}

.chapter-badge {
  text-align: center;
  font-family: sans-serif;
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  color: #78716c;
  margin-top: 2em;
  font-weight: bold;
}

p {
  margin-top: 0;
  margin-bottom: 0;
  text-align: justify;
  line-height: 1.8;
}

p.p-body {
  text-indent: 1.8em;
}

p.first-p {
  text-indent: 0;
  margin-top: 1em;
}

p.first-p::first-letter {
  font-size: 2.8em;
  float: left;
  line-height: 0.8;
  margin-right: 0.12em;
  margin-top: 0.05em;
  font-family: 'Georgia', serif;
  color: #1c1917;
  font-weight: bold;
}

blockquote {
  margin: 1.5em 2em;
  font-style: italic;
  color: #44403c;
  border-left: 3px solid #a8a29e;
  padding-left: 1.2em;
}

ul, ol {
  margin: 1em 0;
  padding-left: 2em;
}

li {
  margin-bottom: 0.5em;
  text-align: justify;
}

.cover-body {
  margin: 0;
  padding: 0;
  text-align: center;
  background-color: #0d0d0d;
}

.cover-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-img {
  max-width: 100%;
  max-height: 100vh;
  object-fit: contain;
  margin: 0 auto;
  display: block;
}

.title-page {
  text-align: center;
  padding-top: 15%;
}

.copyright-page {
  font-size: 0.85em;
  color: #57534e;
  text-align: center;
  margin-top: 15%;
  line-height: 1.8;
}

.catalog-box {
  border: 1px solid #a8a29e;
  padding: 1.5em;
  margin: 2em auto;
  max-width: 90%;
  text-align: left;
  font-size: 0.8em;
  font-family: monospace;
  line-height: 1.6;
  background-color: #fafaf9;
}
`;
  zip.file('OEBPS/styles.css', styles);

  // 4. Handle Cover Image Embedding
  let hasCoverImage = false;
  let coverImageMime = 'image/jpeg';
  let coverImageExt = 'jpg';

  if (project.metadata.coverImageUrl) {
    const rawUrl = project.metadata.coverImageUrl;
    if (rawUrl.startsWith('data:image/')) {
      const match = rawUrl.match(/^data:(image\/[a-zA-Z0-9+\-]+);base64,(.+)$/);
      if (match) {
        coverImageMime = match[1];
        coverImageExt = coverImageMime.includes('png')
          ? 'png'
          : coverImageMime.includes('svg')
          ? 'svg'
          : coverImageMime.includes('webp')
          ? 'webp'
          : 'jpg';
        zip.file(`OEBPS/images/cover.${coverImageExt}`, match[2], { base64: true });
        hasCoverImage = true;
      } else if (rawUrl.includes('data:image/svg+xml')) {
        const svgContent = decodeURIComponent(rawUrl.split(',')[1] || '');
        coverImageMime = 'image/svg+xml';
        coverImageExt = 'svg';
        zip.file('OEBPS/images/cover.svg', svgContent);
        hasCoverImage = true;
      }
    } else if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      try {
        const resp = await fetch(rawUrl);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          coverImageMime = resp.headers.get('content-type') || 'image/jpeg';
          coverImageExt = coverImageMime.includes('png') ? 'png' : 'jpg';
          zip.file(`OEBPS/images/cover.${coverImageExt}`, buffer);
          hasCoverImage = true;
        }
      } catch (e) {
        console.warn('Could not fetch remote cover image for EPUB:', e);
      }
    }
  }

  // 5. Build Content Sections using Canonical Editorial AST
  const items: { id: string; href: string; title: string; content: string; epubType?: string }[] = [];

  // Cover Page
  if (hasCoverImage) {
    items.push({
      id: 'cover_page',
      href: 'cover.xhtml',
      title: 'Capa',
      epubType: 'cover',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}">
<head>
  <title>Capa</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body class="cover-body">
  <div class="cover-wrapper" epub:type="cover">
    <img src="images/cover.${coverImageExt}" alt="Capa da obra ${escapeXML(project.metadata.titulo)}" class="cover-img"/>
  </div>
</body>
</html>`,
    });
  }

  // Title Page
  items.push({
    id: 'title_page',
    href: 'title_page.xhtml',
    title: 'Folha de Rosto',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
  <title>${escapeXML(project.metadata.titulo)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="title-page">
    <p class="publisher-logo">${escapeXML(publisherName)}</p>
    <h1>${escapeXML(project.metadata.titulo)}</h1>
    ${project.metadata.subtitulo ? `<h2>${escapeXML(project.metadata.subtitulo)}</h2>` : ''}
    <p class="author">${escapeXML(project.metadata.autor)}</p>
    <div class="publisher-bottom">
      <p>OMNIA FACTORY</p>
      <p>São Paulo — ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>`,
  });

  // Copyright Page
  items.push({
    id: 'copyright_page',
    href: 'copyright.xhtml',
    title: 'Direitos Autorais',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
  <title>Direitos Autorais</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="copyright-page">
    <p>© ${new Date().getFullYear()} ${escapeXML(project.metadata.autor)}. Todos os direitos reservados.</p>
    <p>Publicação Digital: <strong>${escapeXML(publisherName)} (OMNIA Publish AI)</strong></p>

    <div class="catalog-box">
      <p><strong>Dados Internacionais de Catalogação na Publicação (CIP)</strong></p>
      <p>${escapeXML(project.metadata.autor)}</p>
      <p>&nbsp;&nbsp;${escapeXML(project.metadata.titulo)}${project.metadata.subtitulo ? `: ${escapeXML(project.metadata.subtitulo)}` : ''} / ${escapeXML(project.metadata.autor)}. — São Paulo: ${escapeXML(publisherName)}, ${new Date().getFullYear()}.</p>
      <p>&nbsp;&nbsp;Idioma: ${escapeXML(project.metadata.idioma || 'Português')}.</p>
      <p>CDD: 800.8 | ISBN: 978-65-80000-00-0</p>
    </div>

    <p>Nenhuma parte desta publicação pode ser reproduzida ou transmitida sem autorização prévia.</p>
  </div>
</body>
</html>`,
  });

  // Front Matter
  if (project.frontMatter.apresentacao) {
    const ast = parseMarkdownToAST(project.frontMatter.apresentacao);
    items.push({
      id: 'apresentacao',
      href: 'apresentacao.xhtml',
      title: 'Apresentação',
      content: wrapXHtmlSection('Apresentação', renderASTToXHTML(ast), lang),
    });
  }
  if (project.frontMatter.introducao) {
    const ast = parseMarkdownToAST(project.frontMatter.introducao);
    items.push({
      id: 'introducao',
      href: 'introducao.xhtml',
      title: 'Introdução',
      content: wrapXHtmlSection('Introdução', renderASTToXHTML(ast), lang),
    });
  }

  // Chapters
  project.chapters.forEach((cap) => {
    const ast = parseMarkdownToAST(cap.content || '*Capítulo pendente*');
    items.push({
      id: `chap_${cap.numero}`,
      href: `chapter_${cap.numero}.xhtml`,
      title: `Capítulo ${cap.numero}: ${cap.titulo}`,
      epubType: 'bodymatter',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}">
<head>
  <title>Capítulo ${cap.numero}: ${escapeXML(cap.titulo)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body epub:type="bodymatter">
  <div class="chapter-badge">Capítulo ${cap.numero}</div>
  <h1 class="chapter-title">${escapeXML(cap.titulo)}</h1>
  ${renderASTToXHTML(ast)}
</body>
</html>`,
    });
  });

  // End Matter
  if (project.endMatter.conclusao) {
    const ast = parseMarkdownToAST(project.endMatter.conclusao);
    items.push({
      id: 'conclusao',
      href: 'conclusao.xhtml',
      title: 'Conclusão',
      content: wrapXHtmlSection('Conclusão', renderASTToXHTML(ast), lang),
    });
  }
  if (project.endMatter.exercicios) {
    const ast = parseMarkdownToAST(project.endMatter.exercicios);
    items.push({
      id: 'exercicios',
      href: 'exercicios.xhtml',
      title: 'Exercícios e Práticas',
      content: wrapXHtmlSection('Exercícios e Práticas', renderASTToXHTML(ast), lang),
    });
  }
  if (project.endMatter.sobreAutor) {
    const ast = parseMarkdownToAST(project.endMatter.sobreAutor);
    items.push({
      id: 'sobre_autor',
      href: 'sobre_autor.xhtml',
      title: 'Sobre o Autor',
      content: wrapXHtmlSection('Sobre o Autor', renderASTToXHTML(ast), lang),
    });
  }

  // Write items to zip
  items.forEach((item) => {
    zip.file(`OEBPS/${item.href}`, item.content);
  });

  // Navigation TOC (nav.xhtml)
  const navXHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}">
<head>
  <title>Sumário</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1 class="chapter-title">Sumário</h1>
    <ol>
      ${items.map((item) => `<li><a href="${item.href}">${escapeXML(item.title)}</a></li>`).join('\n      ')}
    </ol>
  </nav>

  <nav epub:type="landmarks" hidden="hidden">
    <h2>Marcos de Leitura</h2>
    <ol>
      ${hasCoverImage ? '<li><a epub:type="cover" href="cover.xhtml">Capa</a></li>' : ''}
      <li><a epub:type="toc" href="nav.xhtml">Sumário</a></li>
      <li><a epub:type="bodymatter" href="chapter_1.xhtml">Início do Conteúdo</a></li>
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXHTML);

  // Manifest items
  let manifestItems = items
    .map((i) => `<item id="${i.id}" href="${i.href}" media-type="application/xhtml+xml"/>`)
    .join('\n    ');

  if (hasCoverImage) {
    manifestItems += `\n    <item id="cover_img" href="images/cover.${coverImageExt}" media-type="${coverImageMime}" properties="cover-image"/>`;
  }

  const spineRefs = items.map((i) => `<itemref idref="${i.id}"/>`).join('\n    ');

  const contentOPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXML(project.metadata.titulo)}</dc:title>
    <dc:creator>${escapeXML(project.metadata.autor)}</dc:creator>
    <dc:publisher>${escapeXML(publisherName)}</dc:publisher>
    <dc:language>${lang}</dc:language>
    <dc:date>${new Date().toISOString().split('T')[0]}</dc:date>
    ${hasCoverImage ? '<meta name="cover" content="cover_img"/>' : ''}
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
    <meta name="generator" content="OMNIA-Renderer v2.5"/>
  </metadata>
  <manifest>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineRefs}
  </spine>
</package>`;

  zip.file('OEBPS/content.opf', contentOPF);

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

function wrapXHtmlSection(title: string, bodyHtml: string, lang: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
  <title>${escapeXML(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1 class="chapter-title">${escapeXML(title)}</h1>
  ${bodyHtml}
</body>
</html>`;
}
