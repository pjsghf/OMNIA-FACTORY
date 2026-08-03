import React, { useState, useRef } from 'react';
import { BookProject } from '../types';
import { generateEpubBlob } from '../lib/epubExporter';
import {
  buildPrintableBookHtml,
  PdfPaperSize,
  PdfTypographyMode,
  CoverOverlayMode,
  PdfExportSettings,
} from '../lib/pdf';
import {
  Sparkles,
  Download,
  Image,
  BookOpen,
  Printer,
  FileText,
  Code2,
  Wand2,
  Maximize2,
  X,
  Palette,
  Upload,
  UploadCloud,
  CheckCircle2,
  Sliders,
  AlertCircle,
  ShieldCheck,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { checkProjectPreflight } from '../lib/validation/preflightGate';
import { getLanguageInfo } from '../lib/utils/languageHelper';
import { cleanChapterProse } from '../lib/rendering/cleanChapterProse';
import { downloadBlobWithCleanup, sanitizeFilename } from '../lib/utils/downloadHelper';
import { validateUploadedImageBuffer } from '../lib/cover/coverBrief';

interface DesignExportStageProps {
  project: BookProject;
  onUpdateCoverUrl: (url: string) => void;
  onOpenReader: () => void;
  onGenerateCover: (prompt?: string) => Promise<void>;
  isGeneratingCover: boolean;
  onOpenTranslation?: () => void;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatInlineHTML(str: string): string {
  let escaped = escapeHtml(str);
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_(.*?)_/g, '<em>$1</em>');
  return escaped;
}

function convertMarkdownToHTML(markdown: string): string {
  if (!markdown) return '';
  const text = markdown.replace(/\r\n/g, '\n').trim();
  const blocks = text.split(/\n\s*\n/);
  let html = '';
  let isFirstP = true;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      html += `<h2 class="print-h2">${formatInlineHTML(trimmed.substring(2))}</h2>\n`;
      isFirstP = true;
    } else if (trimmed.startsWith('## ')) {
      html += `<h3 class="print-h3">${formatInlineHTML(trimmed.substring(3))}</h3>\n`;
      isFirstP = true;
    } else if (trimmed.startsWith('### ')) {
      html += `<h4 class="print-h4">${formatInlineHTML(trimmed.substring(4))}</h4>\n`;
      isFirstP = true;
    } else if (trimmed.startsWith('> ')) {
      const quoteText = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s*/, ''))
        .join(' ');
      html += `<blockquote class="print-quote"><p>${formatInlineHTML(quoteText)}</p></blockquote>\n`;
      isFirstP = true;
    } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const listItems = trimmed
        .split('\n')
        .map((l) => `<li>${formatInlineHTML(l.replace(/^[\*\-]\s*/, ''))}</li>`);
      html += `<ul class="print-ul">\n${listItems.join('\n')}\n</ul>\n`;
      isFirstP = true;
    } else if (trimmed.match(/^\d+\.\s/)) {
      const listItems = trimmed
        .split('\n')
        .map((l) => `<li>${formatInlineHTML(l.replace(/^\d+\.\s*/, ''))}</li>`);
      html += `<ol class="print-ol">\n${listItems.join('\n')}\n</ol>\n`;
      isFirstP = true;
    } else {
      const pText = trimmed.split('\n').join(' ');
      const pClass = isFirstP ? 'p-first' : 'p-subsequent';
      html += `<p class="${pClass}">${formatInlineHTML(pText)}</p>\n`;
      isFirstP = false;
    }
  }

  return html;
}

export const DesignExportStage: React.FC<DesignExportStageProps> = ({
  project,
  onUpdateCoverUrl,
  onOpenReader,
  onGenerateCover,
  isGeneratingCover,
  onOpenTranslation,
}) => {
  const [customCoverPrompt, setCustomCoverPrompt] = useState('');
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const [pdfPaperSize, setPdfPaperSize] = useState<PdfPaperSize>('A5');
  const [pdfTypographyMode, setPdfTypographyMode] = useState<PdfTypographyMode>('nonfiction');
  const [pdfUseDropCap, setPdfUseDropCap] = useState(true);
  const [includeCatalogPage, setIncludeCatalogPage] = useState(true);
  const [overlayMode, setOverlayMode] = useState<CoverOverlayMode>('none');
  const [isGeneratingServerPdf, setIsGeneratingServerPdf] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<{
    title: string;
    fileName: string;
    url: string;
    type: string;
  } | null>(null);

  const totalWords = project.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);

  // Handle local image file upload with signature & size validation (8.3)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        const val = validateUploadedImageBuffer(buffer, file.name, file.type);
        if (!val.valid) {
          alert(`Upload Rejeitado: ${val.error}`);
          return;
        }

        const dataUrlReader = new FileReader();
        dataUrlReader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) {
            onUpdateCoverUrl(dataUrl);
            setUploadSuccess(true);
            setTimeout(() => setUploadSuccess(false), 4000);
          }
        };
        dataUrlReader.readAsDataURL(file);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Quick cover prompt presets for Book Covers
  const coverPresets = [
    {
      name: '🏆 Dourado & Carvão',
      prompt: `Capa de livro de alto luxo. Fundo preto carvão textura fosca, elementos geométricos minimalistas gravados em folha de ouro 24k reluzente. Título "${project.metadata.titulo}" em destaque com letras 3D douradas. Autor "${project.metadata.autor}" e editora "${project.metadata.editora || 'OMNIA'}" dispostos elegantemente com acabamento editorial de alta classe.`,
    },
    {
      name: '💎 Luxo Minimalista',
      prompt: `Arte de capa de livro minimalista para museus de arte. Paleta de cores mármore branco e marfim com relevo dourado refinado. Tipografia central imponente para "${project.metadata.titulo}", autor "${project.metadata.autor}" e selo da editora "${project.metadata.editora || 'OMNIA'}". Design limpo, sofisticado e atemporal.`,
    },
    {
      name: '🌌 Místico & Ficção',
      prompt: `Ilustração editorial de livro místico e poético. Fundo azul cobalto e esmeralda com constelações douradas e elementos surreais. Título de grande impacto "${project.metadata.titulo}", nome do autor "${project.metadata.autor}" e selo editorial "${project.metadata.editora || 'OMNIA'}".Iluminação cinematográfica.`,
    },
    {
      name: '📈 Negócios Executivo',
      prompt: `Capa executiva de negócios e finanças. Grafismo vetorial moderno em azul marinho e cinza platina com detalhes reflexivos. Tipografia audaciosa e marcante para o título "${project.metadata.titulo}", autor "${project.metadata.autor}" e editora "${project.metadata.editora || 'OMNIA'}" na base.`,
    },
    {
      name: '🧠 Mente & Psicologia',
      prompt: `Capa de desenvolvimento pessoal e psicologia. Silhueta artística conceitual, luz volumétrica calorosa em tom âmbar e terracota. Relevo 3D na tipografia de "${project.metadata.titulo}", autor "${project.metadata.autor}" e selo da editora "${project.metadata.editora || 'OMNIA'}".`,
    },
    {
      name: '🔥 Thriller & Mistério',
      prompt: `Capa de thriller dramático. Estilo cinematográfico noir com forte contraste entre sombras profundas e fachos de luz intensa. Título "${project.metadata.titulo}" em caixa alta marcante, autor "${project.metadata.autor}" e logotipo da editora "${project.metadata.editora || 'OMNIA'}".`,
    },
  ];

  // Handle EPUB Export with safe blob cleanup and direct download link
  const handleDownloadEpub = async () => {
    try {
      setIsExportingEpub(true);
      setDownloadNotice(null);
      const blob = await generateEpubBlob(project);
      const fileName = `${sanitizeFilename(project.metadata.titulo)}.epub`;
      const url = downloadBlobWithCleanup(blob, fileName);

      setDownloadNotice({
        title: 'E-book EPUB 3.0 Gerado com Sucesso!',
        fileName,
        url,
        type: 'epub',
      });
    } catch (error) {
      console.error('Erro ao exportar EPUB:', error);
      alert('Houve um erro ao gerar o arquivo EPUB.');
    } finally {
      setIsExportingEpub(false);
    }
  };

  // Handle Markdown Download with safe blob cleanup & unicode filename sanitizer
  const handleDownloadMarkdown = () => {
    setDownloadNotice(null);
    let md = `# ${project.metadata.titulo}\n\n`;
    if (project.metadata.subtitulo) md += `## ${project.metadata.subtitulo}\n\n`;
    md += `**Autor:** ${project.metadata.autor}\n\n`;
    md += `---\n\n`;

    if (project.frontMatter.apresentacao) {
      md += `# Apresentação\n\n${project.frontMatter.apresentacao}\n\n---\n\n`;
    }
    if (project.frontMatter.introducao) {
      md += `# Introdução\n\n${project.frontMatter.introducao}\n\n---\n\n`;
    }

    project.chapters.forEach((cap) => {
      md += `# Capítulo ${cap.numero}: ${cap.titulo}\n\n${cleanChapterProse(cap.content, cap.numero, cap.titulo)}\n\n---\n\n`;
    });

    if (project.endMatter.conclusao) {
      md += `# Conclusão\n\n${project.endMatter.conclusao}\n\n---\n\n`;
    }
    if (project.endMatter.exercicios) {
      md += `# Exercícios e Materiais\n\n${project.endMatter.exercicios}\n\n---\n\n`;
    }
    if (project.endMatter.agradecimentos) {
      md += `# Agradecimentos\n\n${project.endMatter.agradecimentos}\n\n---\n\n`;
    }
    if (project.endMatter.sobreAutor) {
      md += `# Sobre o Autor\n\n${project.endMatter.sobreAutor}\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const fileName = `${sanitizeFilename(project.metadata.titulo)}.md`;
    const url = downloadBlobWithCleanup(blob, fileName);
    setDownloadNotice({
      title: 'Arquivo Markdown (.md) Gerado com Sucesso!',
      fileName,
      url,
      type: 'md',
    });
  };

  // Handle HTML Download with Full Interactive E-Reader (Leitor Imersivo)
  const handleDownloadHtml = () => {
    // Generate sections list
    const sections: Array<{
      id: string;
      type: string;
      title: string;
      content: string;
      wordCount?: number;
      isCover?: boolean;
    }> = [];

    // 1. Cover Section
    sections.push({
      id: 'cover',
      type: 'Capa',
      title: project.metadata.titulo,
      content: '',
      isCover: true,
    });

    // 2. Front matter
    if (project.frontMatter.apresentacao) {
      sections.push({
        id: 'apresentacao',
        type: 'Apresentação',
        title: 'Apresentação',
        content: convertMarkdownToHTML(project.frontMatter.apresentacao),
        wordCount: project.frontMatter.apresentacao.split(/\s+/).length,
      });
    }
    if (project.frontMatter.introducao) {
      sections.push({
        id: 'introducao',
        type: 'Introdução',
        title: 'Introdução',
        content: convertMarkdownToHTML(project.frontMatter.introducao),
        wordCount: project.frontMatter.introducao.split(/\s+/).length,
      });
    }

    // 3. Chapters
    project.chapters.forEach((cap) => {
      const cleaned = cleanChapterProse(cap.content, cap.numero, cap.titulo);
      sections.push({
        id: `cap-${cap.numero}`,
        type: `Capítulo ${cap.numero}`,
        title: cap.titulo,
        content: convertMarkdownToHTML(cleaned),
        wordCount: cap.wordCount || cleaned.split(/\s+/).length,
      });
    });

    // 4. End matter
    if (project.endMatter.conclusao) {
      sections.push({
        id: 'conclusao',
        type: 'Conclusão',
        title: 'Conclusão',
        content: convertMarkdownToHTML(project.endMatter.conclusao),
        wordCount: project.endMatter.conclusao.split(/\s+/).length,
      });
    }
    if (project.endMatter.exercicios) {
      sections.push({
        id: 'exercicios',
        type: 'Exercícios e Materiais',
        title: 'Exercícios e Materiais',
        content: convertMarkdownToHTML(project.endMatter.exercicios),
        wordCount: project.endMatter.exercicios.split(/\s+/).length,
      });
    }
    if (project.endMatter.agradecimentos) {
      sections.push({
        id: 'agradecimentos',
        type: 'Agradecimentos',
        title: 'Agradecimentos',
        content: convertMarkdownToHTML(project.endMatter.agradecimentos),
        wordCount: project.endMatter.agradecimentos.split(/\s+/).length,
      });
    }
    if (project.endMatter.sobreAutor) {
      sections.push({
        id: 'sobre-autor',
        type: 'Sobre o Autor',
        title: 'Sobre o Autor',
        content: convertMarkdownToHTML(project.endMatter.sobreAutor),
        wordCount: project.endMatter.sobreAutor.split(/\s+/).length,
      });
    }

    const jsonSections = JSON.stringify(sections).replace(/</g, '\\u003c');
    const langInfo = getLanguageInfo(project.metadata.idioma);
    const bookMetaData = JSON.stringify({
      titulo: project.metadata.titulo,
      subtitulo: project.metadata.subtitulo || '',
      autor: project.metadata.autor,
      coverImageUrl: project.metadata.coverImageUrl || '',
      editora: project.metadata.editora || 'OMNIA Factory',
      ano: (project.metadata as any).anoPublicacao || new Date().getFullYear().toString(),
      idioma: langInfo.code,
    }).replace(/</g, '\\u003c');

    const htmlContent = `<!DOCTYPE html>
<html lang="${escapeHtml(langInfo.code)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(project.metadata.titulo)} — Leitor Imersivo OMNIA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0c0a09;
      color: #e7e5e4;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Top Navigation Header */
    header {
      background-color: #1c1917;
      border-bottom: 1px solid #292524;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 30;
      flex-shrink: 0;
    }
    .header-title-box {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .book-tag {
      background: #d97706;
      color: #000;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .header-book-name {
      font-size: 14px;
      font-weight: 600;
      color: #f5f5f4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Toolbar Controls */
    .controls-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: #3f3f46;
      color: #fff;
    }
    .btn-icon {
      padding: 6px 10px;
    }
    .btn-primary {
      background: #d97706;
      color: #000;
      border-color: #f59e0b;
      font-weight: 700;
    }
    .btn-primary:hover {
      background: #b45309;
      color: #fff;
    }

    select.select-ctrl {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 12px;
      cursor: pointer;
    }

    /* Reading Progress Bar */
    .progress-container {
      width: 100%;
      height: 3px;
      background: #292524;
      position: relative;
    }
    .progress-fill {
      height: 100%;
      background: #d97706;
      width: 0%;
      transition: width 0.3s ease;
    }

    /* Main Container */
    main {
      flex: 1;
      overflow-y: auto;
      padding: 24px 16px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background-color: rgba(12, 10, 9, 0.95);
    }

    /* Paper themes */
    .paper-canvas {
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
      padding: 40px 48px;
      border-radius: 2px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      min-height: calc(100vh - 160px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: background-color 0.2s, color 0.2s;
    }

    .theme-white { background-color: #ffffff; color: #1c1917; border: 1px solid #e7e5e4; }
    .theme-sepia { background-color: #fdfcfb; color: #1c1917; border: 1px solid #e7e5e4; }
    .theme-slate { background-color: #1e293b; color: #f1f5f9; border: 1px solid #334155; }
    .theme-dark { background-color: #141210; color: #e7e5e4; border: 1px solid #27272a; }

    /* Font Families */
    .font-serif { font-family: 'Georgia', 'Garamond', 'Palatino Linotype', serif; }
    .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .font-mono { font-family: 'Courier New', Courier, monospace; }

    /* Typography inside canvas */
    .chapter-header {
      text-align: center;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(120, 113, 108, 0.25);
      margin-bottom: 28px;
    }
    .chapter-badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: 0.6;
      font-family: monospace;
      margin-bottom: 8px;
    }
    .chapter-title {
      font-size: 1.8em;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 8px;
    }
    .reading-time {
      font-size: 11px;
      opacity: 0.5;
      font-style: italic;
    }

    .chapter-body {
      text-align: justify;
      line-height: 1.75;
    }

    /* Paragraph formatting */
    .chapter-body p {
      margin-bottom: 14px;
    }
    .chapter-body p.p-first {
      text-indent: 0;
    }
    .chapter-body p.p-first::first-letter {
      font-size: 3.2em;
      float: left;
      line-height: 0.8;
      margin-right: 8px;
      margin-top: 4px;
      font-weight: bold;
      color: #b45309;
    }
    .chapter-body p.p-subsequent {
      text-indent: 1.8em;
      margin-bottom: 0;
    }
    .chapter-body h2 {
      font-size: 1.4em;
      margin: 24px 0 12px 0;
      text-align: center;
      font-style: italic;
      border-bottom: 1px solid rgba(120, 113, 108, 0.2);
      padding-bottom: 6px;
    }
    .chapter-body h3 {
      font-size: 1.2em;
      margin: 18px 0 8px 0;
    }
    .chapter-body blockquote {
      margin: 16px 0;
      padding-left: 16px;
      border-left: 3px solid #d97706;
      font-style: italic;
      opacity: 0.9;
    }

    /* Cover Page Styling */
    .cover-view {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px 0;
    }
    .cover-img-wrapper {
      position: relative;
      width: 100%;
      max-width: 260px;
      aspect-ratio: 148 / 210;
      margin-bottom: 24px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.5);
      border: 2px solid #27272a;
      overflow: hidden;
      background: #000;
    }
    .cover-img-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .cover-title {
      font-size: 2em;
      font-weight: 800;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    .cover-subtitle {
      font-size: 1.1em;
      opacity: 0.7;
      margin-bottom: 16px;
    }
    .cover-author {
      font-size: 1.2em;
      font-style: italic;
      margin-bottom: 24px;
      opacity: 0.9;
    }

    /* TOC Sidebar / Drawer */
    .toc-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: none;
    }
    .toc-drawer {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 320px;
      max-width: 85vw;
      background: #1c1917;
      border-right: 1px solid #292524;
      z-index: 51;
      display: flex;
      flex-direction: column;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
    }
    .toc-drawer.open {
      transform: translateX(0);
    }
    .toc-header {
      padding: 16px;
      border-bottom: 1px solid #292524;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #f5f5f4;
    }
    .toc-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .toc-item {
      padding: 10px 12px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: background 0.15s;
    }
    .toc-item:hover {
      background: #27272a;
    }
    .toc-item.active {
      background: #d97706;
      color: #000;
    }
    .toc-type {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
    }
    .toc-name {
      font-size: 13px;
      font-weight: 600;
    }

    /* Bottom Navigation Bar */
    footer {
      background: #1c1917;
      border-top: 1px solid #292524;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 30;
      flex-shrink: 0;
    }
    .footer-status {
      font-size: 12px;
      color: #a8a29e;
      font-family: monospace;
    }

    @media (max-width: 640px) {
      .paper-canvas { padding: 24px 20px; }
      .hide-mobile { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Top Navigation Header -->
  <header>
    <div class="header-title-box">
      <button id="btn-toc" class="btn btn-primary" title="Abrir Sumário">
        ☰ <span class="hide-mobile">Sumário</span>
      </button>
      <div>
        <span class="book-tag">LEITOR IMERSIVO • ${escapeHtml(langInfo.code)}</span>
        <span class="header-book-name" id="hdr-book-title"></span>
      </div>
    </div>

    <div class="controls-group">
      <!-- Font Family -->
      <select id="sel-font" class="select-ctrl hide-mobile">
        <option value="serif">Serifada (Georgia)</option>
        <option value="sans">Sans (Moderna)</option>
        <option value="mono">Monospace</option>
      </select>

      <!-- Font Size -->
      <button id="btn-font-dec" class="btn btn-icon" title="Diminuir Fonte">A-</button>
      <span id="lbl-font-size" style="font-size:11px; font-family:monospace;">18px</span>
      <button id="btn-font-inc" class="btn btn-icon" title="Aumentar Fonte">A+</button>

      <!-- Theme Switcher -->
      <select id="sel-theme" class="select-ctrl">
        <option value="sepia">📜 Sépia</option>
        <option value="white">⚪ Claro</option>
        <option value="slate">🐘 Slate</option>
        <option value="dark">🌙 Escuro</option>
      </select>
    </div>
  </header>

  <!-- Progress Bar -->
  <div class="progress-container">
    <div id="progress-bar" class="progress-fill"></div>
  </div>

  <!-- TOC Overlay and Drawer -->
  <div id="toc-overlay" class="toc-overlay"></div>
  <div id="toc-drawer" class="toc-drawer">
    <div class="toc-header">
      <strong style="font-size:14px;">Índice do Livro</strong>
      <button id="btn-close-toc" class="btn btn-icon">✕</button>
    </div>
    <div id="toc-list" class="toc-list"></div>
  </div>

  <!-- Reading Canvas -->
  <main id="main-scroll">
    <div id="paper-canvas" class="paper-canvas theme-sepia font-serif">
      <div id="content-container">
        <!-- Rendered dynamically -->
      </div>

      <div id="paper-footer" style="margin-top: 36px; padding-top: 14px; border-top: 1px solid rgba(120, 113, 108, 0.25); display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-family: 'Georgia', serif; opacity: 0.6; word-break: break-word;">
        <span style="font-style: italic;">${escapeHtml(project.metadata.titulo)}</span>
        <span id="paper-page-corner" style="font-weight: 600; font-family: monospace;">Pág. 1</span>
      </div>
    </div>
  </main>

  <!-- Footer Navigation Bar -->
  <footer>
    <button id="btn-prev" class="btn">◀ <span class="hide-mobile">Anterior</span></button>
    <div class="footer-status" id="footer-status">1 / 1</div>
    <button id="btn-next" class="btn btn-primary"><span class="hide-mobile">Próximo</span> ▶</button>
  </footer>

  <script>
    const bookData = ${bookMetaData};
    const sections = ${jsonSections};

    let currentIndex = 0;
    let currentTheme = localStorage.getItem('omnia_theme') || 'sepia';
    let currentFont = localStorage.getItem('omnia_font') || 'serif';
    let currentFontSize = parseInt(localStorage.getItem('omnia_size') || '18', 10);

    // DOM Elements
    const hdrBookTitle = document.getElementById('hdr-book-title');
    const paperCanvas = document.getElementById('paper-canvas');
    const contentContainer = document.getElementById('content-container');
    const progressBar = document.getElementById('progress-bar');
    const footerStatus = document.getElementById('footer-status');
    const selTheme = document.getElementById('sel-theme');
    const selFont = document.getElementById('sel-font');
    const lblFontSize = document.getElementById('lbl-font-size');

    const tocOverlay = document.getElementById('toc-overlay');
    const tocDrawer = document.getElementById('toc-drawer');
    const tocList = document.getElementById('toc-list');
    const mainScroll = document.getElementById('main-scroll');

    // Init Header
    hdrBookTitle.textContent = bookData.titulo;

    // Build TOC items
    sections.forEach((sec, idx) => {
      const item = document.createElement('div');
      item.className = 'toc-item';
      item.onclick = () => {
        goToSection(idx);
        closeToc();
      };

      const typeSpan = document.createElement('span');
      typeSpan.className = 'toc-type';
      typeSpan.textContent = sec.type;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'toc-name';
      nameSpan.textContent = sec.title;

      item.appendChild(typeSpan);
      item.appendChild(nameSpan);
      tocList.appendChild(item);
    });

    function applyStyles() {
      paperCanvas.className = 'paper-canvas theme-' + currentTheme + ' font-' + currentFont;
      paperCanvas.style.fontSize = currentFontSize + 'px';
      lblFontSize.textContent = currentFontSize + 'px';
      if (selTheme) selTheme.value = currentTheme;
      if (selFont) selFont.value = currentFont;

      localStorage.setItem('omnia_theme', currentTheme);
      localStorage.setItem('omnia_font', currentFont);
      localStorage.setItem('omnia_size', currentFontSize);
    }

    function renderCurrentSection() {
      const sec = sections[currentIndex];
      contentContainer.innerHTML = '';

      if (sec.isCover) {
        // Render Cover Page
        const coverDiv = document.createElement('div');
        coverDiv.className = 'cover-view';

        let coverImgHtml = '';
        // Only data:/http(s) images, and always escaped: coverImageUrl can carry a
        // quote and break out of the src attribute when it arrives from an imported
        // backup file rather than from our own generator.
        if (bookData.coverImageUrl && isSafeImageUrl(bookData.coverImageUrl)) {
          coverImgHtml = '<div class="cover-img-wrapper"><img src="' + escapeHtml(bookData.coverImageUrl) + '" alt="Capa" /></div>';
        }

        coverDiv.innerHTML =
          coverImgHtml +
          '<h1 class="cover-title">' + escapeHtml(bookData.titulo) + '</h1>' +
          (bookData.subtitulo ? '<h2 class="cover-subtitle">' + escapeHtml(bookData.subtitulo) + '</h2>' : '') +
          '<p class="cover-author">por ' + escapeHtml(bookData.autor) + '</p>' +
          '<button class="btn btn-primary" style="padding:12px 28px; font-size:15px; margin-top:14px; min-height:44px;" onclick="goToSection(1)">🚀 Iniciar Leitura</button>';

        contentContainer.appendChild(coverDiv);
      } else {
        // Render Reading Section
        const headerDiv = document.createElement('div');
        headerDiv.className = 'chapter-header';

        const badge = document.createElement('div');
        badge.className = 'chapter-badge';
        badge.textContent = sec.type;

        const title = document.createElement('h1');
        title.className = 'chapter-title';
        title.textContent = sec.title;

        headerDiv.appendChild(badge);
        headerDiv.appendChild(title);

        if (sec.wordCount) {
          const time = Math.ceil(sec.wordCount / 200);
          const timeDiv = document.createElement('div');
          timeDiv.className = 'reading-time';
          timeDiv.textContent = '⏱ ~' + time + ' min de leitura (' + sec.wordCount + ' palavras)';
          headerDiv.appendChild(timeDiv);
        }

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'chapter-body';
        bodyDiv.innerHTML = sec.content;

        contentContainer.appendChild(headerDiv);
        contentContainer.appendChild(bodyDiv);
      }

      // Update progress & status
      const pct = Math.round(((currentIndex + 1) / sections.length) * 100);
      progressBar.style.width = pct + '%';
      footerStatus.textContent = (currentIndex + 1) + ' / ' + sections.length + ' (' + pct + '%)';
      const pageCornerEl = document.getElementById('paper-page-corner');
      if (pageCornerEl) {
        pageCornerEl.textContent = 'Pág. ' + (currentIndex + 1);
      }

      // Update active TOC item highlight
      Array.from(tocList.children).forEach((child, i) => {
        if (i === currentIndex) {
          child.classList.add('active');
        } else {
          child.classList.remove('active');
        }
      });

      mainScroll.scrollTop = 0;
    }

    function goToSection(index) {
      if (index >= 0 && index < sections.length) {
        currentIndex = index;
        renderCurrentSection();
      }
    }

    function openToc() {
      tocOverlay.style.display = 'block';
      setTimeout(() => tocDrawer.classList.add('open'), 10);
    }

    function closeToc() {
      tocDrawer.classList.remove('open');
      setTimeout(() => { tocOverlay.style.display = 'none'; }, 250);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isSafeImageUrl(url) {
      return typeof url === 'string' && /^(data:image\\/|https?:\\/\\/)/i.test(url);
    }

    // Event Listeners
    document.getElementById('btn-prev').onclick = () => goToSection(currentIndex - 1);
    document.getElementById('btn-next').onclick = () => goToSection(currentIndex + 1);
    document.getElementById('btn-toc').onclick = openToc;
    document.getElementById('btn-close-toc').onclick = closeToc;
    tocOverlay.onclick = closeToc;

    if (selTheme) selTheme.onchange = (e) => { currentTheme = e.target.value; applyStyles(); };
    if (selFont) selFont.onchange = (e) => { currentFont = e.target.value; applyStyles(); };
    document.getElementById('btn-font-dec').onclick = () => { if (currentFontSize > 12) { currentFontSize--; applyStyles(); } };
    document.getElementById('btn-font-inc').onclick = () => { if (currentFontSize < 28) { currentFontSize++; applyStyles(); } };

    // Mobile Touch Swipe Navigation (Deslizar o dedo)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    mainScroll.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    mainScroll.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      if (Math.abs(diffX) > 55 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
        if (diffX < 0) {
          goToSection(currentIndex + 1); // Swipe left -> Next
        } else {
          goToSection(currentIndex - 1); // Swipe right -> Prev
        }
      }
    }

    // Keyboard navigation
    window.onkeydown = (e) => {
      if (e.key === 'ArrowLeft') goToSection(currentIndex - 1);
      if (e.key === 'ArrowRight') goToSection(currentIndex + 1);
      if (e.key === 'Escape') closeToc();
    };

    // Init App
    applyStyles();
    renderCurrentSection();
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const fileName = `${sanitizeFilename(project.metadata.titulo)}.html`;
    const url = downloadBlobWithCleanup(blob, fileName);
    setDownloadNotice({
      title: 'Livro HTML Standalone Gerado!',
      fileName,
      url,
      type: 'html',
    });
  };

  // Handle Direct In-Page Printing (Triggers Browser Native "Save as PDF" Dialog directly over current page)
  const handleDirectIframePrint = () => {
    try {
      const settings: PdfExportSettings = {
        paperSize: pdfPaperSize,
        typographyMode: pdfTypographyMode,
        coverOverlayMode: overlayMode,
        useDropCap: pdfUseDropCap,
        includeCatalogPage: includeCatalogPage,
      };

      const htmlContent = buildPrintableBookHtml({
        project,
        settings,
      });

      // Remove any previous print iframe
      const oldIframe = document.getElementById('omnia-direct-print-iframe');
      if (oldIframe) {
        oldIframe.remove();
      }

      // Create hidden iframe in main document body
      const iframe = document.createElement('iframe');
      iframe.id = 'omnia-direct-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        alert('Não foi possível inicializar a impressão no navegador.');
        return;
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Erro ao disparar janela de impressão no iframe:', err);
          alert('Erro ao abrir a janela de impressão do navegador.');
        }
        setTimeout(() => {
          iframe.remove();
        }, 5000);
      }, 600);
    } catch (err: any) {
      console.error('Erro ao gerar documento de impressão:', err);
      alert(`Erro ao preparar documento para impressão: ${err?.message || err}`);
    }
  };

  // Handle Printable PDF Preview in New Window (Same-Origin Document)
  const handlePrintPDF = () => {
    try {
      const settings: PdfExportSettings = {
        paperSize: pdfPaperSize,
        typographyMode: pdfTypographyMode,
        coverOverlayMode: overlayMode,
        useDropCap: pdfUseDropCap,
        includeCatalogPage: includeCatalogPage,
      };

      const htmlContent = buildPrintableBookHtml({
        project,
        settings,
      });

      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.focus();
      } else {
        // Fall back directly to in-page print dialog
        handleDirectIframePrint();
      }
    } catch (err: any) {
      console.error('Erro ao abrir leitor de impressão:', err);
      handleDirectIframePrint();
    }
  };

  // Handle Server-Side PDF Download (Puppeteer Rendering)
  const handleDownloadServerPDF = async () => {
    try {
      setIsGeneratingServerPdf(true);
      setDownloadNotice(null);

      const settings: PdfExportSettings = {
        paperSize: pdfPaperSize,
        typographyMode: pdfTypographyMode,
        coverOverlayMode: overlayMode,
        useDropCap: pdfUseDropCap,
        includeCatalogPage: includeCatalogPage,
      };

      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, settings }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error?.message || errData.error || `Erro no servidor (código ${response.status}).`
        );
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('O arquivo PDF gerado pelo servidor está vazio.');
      }

      const fileName = `${sanitizeFilename(project.metadata.titulo)}_${pdfPaperSize.toLowerCase()}.pdf`;
      const url = downloadBlobWithCleanup(blob, fileName);

      setDownloadNotice({
        title: 'Arquivo PDF Gerado com Sucesso!',
        fileName,
        url,
        type: 'pdf',
      });
    } catch (err: any) {
      console.error('Geração no servidor falhou:', err);
      alert(
        `Erro ao gerar PDF via Puppeteer: ${err.message || err}\n\nVocê também pode utilizar a opção "Imprimir / Salvar PDF (Navegador)" para salvar o PDF diretamente.`
      );
    } finally {
      setIsGeneratingServerPdf(false);
    }
  };

  // Handle Export Full Project JSON
  const handleExportProjectJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${project.metadata.titulo.toLowerCase().replace(/\s+/g, '_')}_scriptor_project.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Top Banner */}
      <div className="bg-[#F5F5F4] border border-[#E7E5E4] p-6 sm:p-8 text-[#1C1917] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="border-l-2 border-[#1C1917] pl-6 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A8A29E] font-semibold italic">
            Etapa 5 • Diagramação, Capa & Exportação
          </p>
          <h1 className="text-2xl sm:text-3xl font-serif italic font-bold text-[#1C1917]">
            Publicação e Exportação da Obra
          </h1>
          <p className="text-xs text-[#57534E] font-serif">
            Diagramação profissional com capa embutida para EPUB, PDF (com ficha catalográfica) e
            HTML.
          </p>
        </div>

        <button
          onClick={onOpenReader}
          className="flex items-center space-x-2 px-6 py-3 bg-[#1C1917] hover:bg-[#44403C] text-white font-bold text-xs uppercase tracking-widest transition shadow-xs shrink-0"
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>Abrir Leitor Imersivo</span>
        </button>
      </div>

      {/* Preflight Readiness Gate Card */}
      {(() => {
        const preflight = checkProjectPreflight(project);
        return (
          <div className="bg-white border border-[#E7E5E4] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F5F5F4] pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#1C1917]" />
                <h3 className="font-serif italic font-bold text-base text-[#1C1917]">
                  Checklist de Validação Pré-Publicação (Preflight Gate)
                </h3>
              </div>
              <span
                className={`px-3 py-1 font-mono font-bold text-xs uppercase border ${
                  preflight.readyToPublish
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {preflight.readyToPublish
                  ? '✓ Pronto para Publicar'
                  : `Conclusão: ${preflight.score}%`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {preflight.items.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 border flex items-start space-x-2.5 ${
                    item.passed
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  {item.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-bold text-[#1C1917] block">{item.label}</span>
                    <p className="text-[11px] text-[#57534E] font-serif leading-snug">
                      {item.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Cover Generator & Interactive Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E7E5E4] p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5F5F4]">
              <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E] flex items-center space-x-1.5">
                <Palette className="w-4 h-4 text-[#78716C]" />
                <span>Design da Capa do Livro</span>
              </h2>
              {project.metadata.coverImageUrl && (
                <button
                  onClick={() => setShowCoverModal(true)}
                  className="text-[10px] uppercase tracking-wider font-bold text-amber-800 hover:text-amber-950 flex items-center space-x-1 bg-amber-50 hover:bg-amber-100 px-2 py-1 border border-amber-200 transition"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expandir</span>
                </button>
              )}
            </div>

            {/* Book Cover Interactive Preview Box */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative w-full max-w-[240px] aspect-[148/210] bg-stone-900 shadow-2xl overflow-hidden border-2 border-stone-800 group transition">
                {project.metadata.coverImageUrl ? (
                  <>
                    <img
                      src={project.metadata.coverImageUrl}
                      alt="Capa do Livro"
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    {/* Typography Overlays */}
                    {overlayMode === 'overlay' && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/70 p-6 flex flex-col justify-between text-center text-white pointer-events-none z-10">
                        <div className="pt-2 space-y-1">
                          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/30 inline-block shadow-xs">
                            ★ EDITORA OMNIA ★
                          </span>
                          <h3 className="text-lg sm:text-xl font-serif italic font-bold text-amber-50 drop-shadow-lg leading-tight pt-1">
                            {project.metadata.titulo}
                          </h3>
                          {project.metadata.subtitulo && (
                            <p className="text-[10px] font-serif text-stone-200 line-clamp-2 italic opacity-90 pt-0.5">
                              {project.metadata.subtitulo}
                            </p>
                          )}
                        </div>

                        <div className="pb-2 space-y-0.5">
                          <div className="w-8 h-0.5 bg-amber-400 mx-auto my-1.5 opacity-80" />
                          <p className="text-xs font-serif font-bold tracking-widest text-white uppercase drop-shadow-md">
                            {project.metadata.autor}
                          </p>
                          <p className="text-[8px] font-mono tracking-widest text-amber-300/90 uppercase pt-1">
                            ✦ {project.metadata.editora || 'OMNIA'} ✦
                          </p>
                        </div>
                      </div>
                    )}

                    {overlayMode === 'card' && (
                      <div className="absolute inset-0 p-6 flex flex-col justify-end pointer-events-none z-10">
                        <div className="bg-black/85 backdrop-blur-md border border-amber-500/40 p-3.5 text-center text-white space-y-1 shadow-2xl">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-amber-400">
                            ★ EDITORA OMNIA ★
                          </span>
                          <h3 className="text-base font-serif italic font-bold text-amber-100">
                            {project.metadata.titulo}
                          </h3>
                          <p className="text-[10px] font-serif text-stone-300 uppercase tracking-widest">
                            {project.metadata.autor}
                          </p>
                          <p className="text-[8px] font-mono text-amber-400/80 uppercase tracking-widest">
                            ✦ {project.metadata.editora || 'OMNIA'} ✦
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-3 bg-gradient-to-b from-stone-900 to-stone-950">
                    <BookOpen className="w-12 h-12 text-stone-600" />
                    <div>
                      <p className="text-xs font-bold text-stone-300">Nenhuma capa configurada</p>
                      <p className="text-[10px] text-stone-500 mt-1">
                        Envie uma capa própria (Padrão A5 14,8×21 cm) ou gere com IA
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Overlay Toggle Controls */}
              {project.metadata.coverImageUrl && (
                <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded border border-stone-200 text-[10px]">
                  <span className="text-[#78716C] px-2 font-semibold uppercase tracking-wider text-[9px]">
                    Textos na Capa:
                  </span>
                  <button
                    onClick={() => setOverlayMode('overlay')}
                    className={`px-2.5 py-1 font-bold transition ${
                      overlayMode === 'overlay'
                        ? 'bg-[#1C1917] text-white shadow-xs'
                        : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    Editorial 3D
                  </button>
                  <button
                    onClick={() => setOverlayMode('card')}
                    className={`px-2.5 py-1 font-bold transition ${
                      overlayMode === 'card'
                        ? 'bg-[#1C1917] text-white shadow-xs'
                        : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    Selo Vidro
                  </button>
                  <button
                    onClick={() => setOverlayMode('none')}
                    className={`px-2.5 py-1 font-bold transition ${
                      overlayMode === 'none'
                        ? 'bg-[#1C1917] text-white shadow-xs'
                        : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    Apenas Arte
                  </button>
                </div>
              )}
            </div>

            {/* Custom Image File Upload Section */}
            <div className="space-y-3 pt-3 border-t border-[#F5F5F4]">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#1C1917] flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  <span>Enviar Minha Própria Capa (Upload)</span>
                </label>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200">
                  Formato Padrão A5 (14,8×21 cm)
                </span>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-[#D6D3D1] hover:border-[#1C1917] bg-[#FDFCFB] hover:bg-[#F5F5F4] transition cursor-pointer text-center space-y-2 group"
              >
                <div className="w-8 h-8 rounded-full bg-stone-100 group-hover:bg-amber-100 text-[#78716C] group-hover:text-amber-800 flex items-center justify-center mx-auto transition">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1C1917]">
                    Clique aqui para selecionar uma imagem do seu dispositivo
                  </p>
                  <p className="text-[11px] text-[#78716C] mt-0.5">
                    Formatos aceitos: <strong>JPG, PNG, WEBP</strong>
                  </p>
                  <p className="text-[10px] text-amber-800 font-medium mt-1.5 bg-amber-50 inline-block px-2.5 py-1 border border-amber-200">
                    💡 <strong>Proporção ideal A5 recomendada: 14,8×21 cm</strong> (ex: 1480×2100px
                    ou 1184×1680px)
                  </p>
                </div>
              </div>

              {uploadSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Capa personalizada enviada e aplicada com sucesso!</span>
                </div>
              )}
            </div>

            {/* Quick Prompt Presets */}
            <div className="space-y-2 pt-2 border-t border-[#F5F5F4]">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#A8A29E] flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Estilos Editoriais Pré-Configurados:</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {coverPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCustomCoverPrompt(preset.prompt)}
                    className="p-2 text-left bg-[#FDFCFB] hover:bg-[#F5F5F4] border border-[#E7E5E4] hover:border-[#1C1917] transition text-[11px] font-medium text-[#1C1917] truncate"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom AI Prompt Input */}
            <div className="space-y-2 pt-2 border-t border-[#F5F5F4]">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#1C1917]">
                Diretriz Customizada para Gerar Capa por IA:
              </label>
              <textarea
                value={customCoverPrompt}
                onChange={(e) => setCustomCoverPrompt(e.target.value)}
                placeholder="Ex: Capa de livro com ilustração surrealista em aquarela esmeralda e dourada..."
                rows={3}
                className="w-full p-3 bg-[#FDFCFB] border border-[#E7E5E4] focus:border-[#1C1917] text-xs font-serif outline-hidden resize-none"
              />

              <button
                onClick={() => onGenerateCover(customCoverPrompt)}
                disabled={isGeneratingCover}
                className="w-full py-3 bg-[#1C1917] hover:bg-[#44403C] text-white font-bold text-xs uppercase tracking-widest transition flex items-center justify-center space-x-2 shadow-xs disabled:opacity-50"
              >
                {isGeneratingCover ? (
                  <>
                    <Wand2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Gerando Arte da Capa...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>
                      {project.metadata.coverImageUrl
                        ? 'Gerar Nova Versão com IA'
                        : 'Gerar Arte da Capa com IA'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Curated Fine Art Gallery */}
            <div className="space-y-2 pt-3 border-t border-[#F5F5F4]">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#A8A29E] flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Image className="w-3 h-3 text-[#78716C]" />
                  <span>Galeria de Telas & Obras HD:</span>
                </span>
                <span className="text-[9px] text-[#78716C] font-normal italic">
                  Aplicação Instantânea
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    name: 'Ouro & Mármore',
                    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    name: 'Tinta Dourada',
                    url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    name: 'Aquarela Esmeralda',
                    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    name: 'Cosmos & Galáxia',
                    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    name: 'Papel Editorial',
                    url: 'https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=800&q=80',
                  },
                  {
                    name: 'Geometria Dark',
                    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
                  },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onUpdateCoverUrl(item.url);
                      setOverlayMode('overlay');
                    }}
                    className="relative aspect-[3/4] rounded-none overflow-hidden border border-[#E7E5E4] hover:border-[#1C1917] group transition text-left"
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                      <span className="text-[9px] font-bold text-white leading-tight line-clamp-1 drop-shadow-xs">
                        {item.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Format Export Options */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E7E5E4] p-6 sm:p-8 space-y-6">
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E] flex items-center space-x-2 pb-3 border-b border-[#F5F5F4]">
              <Download className="w-4 h-4 text-[#78716C]" />
              <span>Opções de Exportação & Diagramação Profissional</span>
            </h2>

            {/* PDF Diagramming Options Panel */}
            <div className="p-4 bg-stone-50 border border-stone-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <span className="text-[11px] uppercase tracking-wider font-bold text-stone-800 flex items-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-amber-700" />
                  <span>Configurações de Diagramação do PDF:</span>
                </span>
                <span className="text-[10px] text-stone-500 italic">
                  Padrão Editorial ABNT / A5
                </span>
              </div>

              {/* Grid of Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Paper Size Selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-stone-600">
                    Formato da Página:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPdfPaperSize('A5')}
                      className={`p-2 text-left transition border text-xs ${
                        pdfPaperSize === 'A5'
                          ? 'bg-[#1C1917] text-white border-[#1C1917] font-bold shadow-xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <p className="font-bold text-[11px]">A5 (148 × 210 mm)</p>
                      <p className="text-[9px] opacity-80">Livro de bolso e livrarias</p>
                    </button>

                    <button
                      onClick={() => setPdfPaperSize('A4')}
                      className={`p-2 text-left transition border text-xs ${
                        pdfPaperSize === 'A4'
                          ? 'bg-[#1C1917] text-white border-[#1C1917] font-bold shadow-xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <p className="font-bold text-[11px]">A4 (210 × 297 mm)</p>
                      <p className="text-[9px] opacity-80">Relatórios e apostilas</p>
                    </button>
                  </div>
                </div>

                {/* 2. Typography Mode Selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-stone-600">
                    Estilo Tipográfico:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPdfTypographyMode('nonfiction')}
                      className={`p-2 text-left transition border text-xs ${
                        pdfTypographyMode === 'nonfiction'
                          ? 'bg-[#1C1917] text-white border-[#1C1917] font-bold shadow-xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <p className="font-bold text-[11px]">Didático / Negócios</p>
                      <p className="text-[9px] opacity-80">Espaçado entre parágrafos</p>
                    </button>

                    <button
                      onClick={() => setPdfTypographyMode('literary')}
                      className={`p-2 text-left transition border text-xs ${
                        pdfTypographyMode === 'literary'
                          ? 'bg-[#1C1917] text-white border-[#1C1917] font-bold shadow-xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <p className="font-bold text-[11px]">Ficção / Literário</p>
                      <p className="text-[9px] opacity-80">Recuo tradicional na 1ª linha</p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-200">
                <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={pdfUseDropCap}
                    onChange={(e) => setPdfUseDropCap(e.target.checked)}
                    className="accent-amber-800 w-4 h-4 rounded-none"
                  />
                  <span>Capitular na Abertura de Capítulos</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={includeCatalogPage}
                    onChange={(e) => setIncludeCatalogPage(e.target.checked)}
                    className="accent-amber-800 w-4 h-4 rounded-none"
                  />
                  <span>Incluir Ficha Catalográfica CIP / ISBN</span>
                </label>
              </div>

              {/* Notice for Commercial Printing / Gráfica */}
              <div className="bg-amber-50/80 border border-amber-200 p-2.5 text-[10px] text-amber-900 leading-normal flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Aviso para Impressão em Gráfica / Editora:</strong> O PDF é gerado com
                  geometrias exatas de página, fontes incorporadas e folhas de estilo isoladas. Para
                  impressão gráfica offset/digital com sangria de 3mm e marcas de corte de gráfica,
                  selecione o formato A5 e salve em alta resolução.
                </div>
              </div>
            </div>

            {/* Direct Download Active Banner */}
            {downloadNotice && (
              <div className="bg-emerald-950 border border-emerald-500 p-4 shadow-xl text-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-emerald-100">{downloadNotice.title}</h4>
                    <p className="text-xs text-emerald-300/90 mt-0.5">
                      Arquivo:{' '}
                      <code className="font-mono bg-emerald-900/80 px-1.5 py-0.5 text-emerald-200 font-bold">
                        {downloadNotice.fileName}
                      </code>
                    </p>
                    <p className="text-[11px] text-stone-300 mt-1">
                      Se o seu navegador bloqueou o download automático, clique no botão ao lado
                      para baixar seu arquivo diretamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <a
                    href={downloadNotice.url}
                    download={downloadNotice.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-bold text-xs uppercase tracking-wider transition flex items-center space-x-2 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Clique Aqui Para Baixar</span>
                  </a>
                  <button
                    onClick={() => setDownloadNotice(null)}
                    className="p-2 text-stone-400 hover:text-white transition"
                    title="Fechar aviso"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Translation & Cultural Localization Card */}
              {onOpenTranslation && (
                <button
                  type="button"
                  onClick={onOpenTranslation}
                  className="sm:col-span-2 p-5 bg-gradient-to-r from-amber-950 via-[#1C1917] to-[#292524] text-white hover:opacity-95 border border-amber-800/60 text-left transition space-y-2 group shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1">
                      <Globe className="w-3 h-3 text-amber-400" />
                      <span>Tradutor e Localizador Cultural de E-books</span>
                    </span>
                    <Globe className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
                  </div>
                  <h3 className="font-bold font-serif italic text-base text-amber-100">
                    Traduzir e Localizar E-book para Outros Idiomas
                  </h3>
                  <p className="text-[12px] text-amber-200/80 leading-relaxed">
                    Adaptação literária inteligente de expressões, tom narrativo e gírias com
                    geração automática de uma nova capa no idioma selecionado (Inglês, Espanhol,
                    Francês, Alemão, Japonês, etc.).
                  </p>
                </button>
              )}

              {/* EPUB Export Button */}
              <button
                onClick={handleDownloadEpub}
                disabled={isExportingEpub}
                className="p-5 bg-[#FDFCFB] hover:bg-[#F5F5F4] border border-[#E7E5E4] text-left transition space-y-2 group hover:border-[#1C1917]"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#1C1917] text-white font-mono font-bold text-[10px] uppercase tracking-wider">
                    EPUB 3.0 (Digital)
                  </span>
                  <Download className="w-4 h-4 text-[#78716C] group-hover:text-[#1C1917] transition" />
                </div>
                <h3 className="font-bold font-serif italic text-sm text-[#1C1917]">
                  Baixar Livro em EPUB
                </h3>
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  Inclui capa gráfica embutida, capítulos, capitulares e sumário. Compatível com
                  Kindle, Apple Books e Kobo.
                </p>
              </button>

              {/* Download PDF Direct (Server-side Puppeteer) */}
              <button
                onClick={handleDownloadServerPDF}
                disabled={isGeneratingServerPdf}
                className="p-5 bg-amber-950 text-white hover:bg-amber-900 border border-amber-900 text-left transition space-y-2 group shadow-sm disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-amber-500 text-black font-mono font-bold text-[10px] uppercase tracking-wider">
                    PDF DIRETO ({pdfPaperSize})
                  </span>
                  {isGeneratingServerPdf ? (
                    <Wand2 className="w-4 h-4 text-amber-300 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-amber-300 group-hover:scale-110 transition" />
                  )}
                </div>
                <h3 className="font-bold font-serif italic text-sm text-amber-100">
                  {isGeneratingServerPdf
                    ? 'Gerando PDF no Servidor...'
                    : 'Baixar PDF no Servidor (Puppeteer)'}
                </h3>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Gera o arquivo PDF final diretamente com renderização Puppeteer de alta resolução.
                </p>
              </button>

              {/* Instant Browser Print / Save PDF (In-App) */}
              <button
                onClick={handleDirectIframePrint}
                className="p-5 bg-[#1C1917] text-white hover:bg-[#292524] border border-[#44403C] text-left transition space-y-2 group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-emerald-500 text-black font-mono font-bold text-[10px] uppercase tracking-wider">
                    IMPRIMIR / SALVAR PDF ({pdfPaperSize})
                  </span>
                  <Printer className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                </div>
                <h3 className="font-bold font-serif italic text-sm text-emerald-100">
                  Imprimir / Salvar PDF (Navegador)
                </h3>
                <p className="text-[11px] text-stone-300 leading-relaxed">
                  Abre instantaneamente a janela de impressão nativa do navegador para salvar em PDF
                  sem bloqueio de pop-up.
                </p>
              </button>

              {/* Printable PDF Preview (Open in New Tab) */}
              <button
                onClick={handlePrintPDF}
                className="p-5 bg-[#FDFCFB] hover:bg-[#F5F5F4] border border-[#E7E5E4] text-left transition space-y-2 group hover:border-[#1C1917]"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-stone-800 text-stone-100 font-mono font-bold text-[10px] uppercase tracking-wider">
                    LEITOR / NOVA ABA ({pdfPaperSize})
                  </span>
                  <ExternalLink className="w-4 h-4 text-stone-700 group-hover:text-[#1C1917] transition" />
                </div>
                <h3 className="font-bold font-serif italic text-sm text-[#1C1917]">
                  Abrir Diagramação em Nova Aba
                </h3>
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  Visualiza o layout completo diagramado página a página em uma guia dedicada do seu
                  navegador.
                </p>
              </button>

              {/* Markdown Download */}
              <button
                onClick={handleDownloadMarkdown}
                className="p-5 bg-[#FDFCFB] hover:bg-[#F5F5F4] border border-[#E7E5E4] text-left transition space-y-2 group hover:border-[#1C1917]"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#1C1917] text-white font-mono font-bold text-[10px] uppercase tracking-wider">
                    MARKDOWN
                  </span>
                  <FileText className="w-4 h-4 text-[#78716C] group-hover:text-[#1C1917] transition" />
                </div>
                <h3 className="font-bold font-serif italic text-sm text-[#1C1917]">
                  Baixar Arquivo Markdown (.md)
                </h3>
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  Texto consolidado da obra com marcações limpas para editores de texto.
                </p>
              </button>

              {/* HTML Download */}
              <button
                onClick={handleDownloadHtml}
                className="p-5 bg-[#FDFCFB] hover:bg-[#F5F5F4] border border-[#E7E5E4] text-left transition space-y-2 group hover:border-[#1C1917]"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#1C1917] text-white font-mono font-bold text-[10px] uppercase tracking-wider">
                    HTML WEB
                  </span>
                  <Code2 className="w-4 h-4 text-[#78716C] group-hover:text-[#1C1917] transition" />
                </div>
                <h3 className="font-bold font-serif italic text-sm text-[#1C1917]">
                  Baixar Pacote HTML (.html)
                </h3>
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  Página web autônoma e formatada com capa e capítulos estruturados.
                </p>
              </button>
            </div>

            {/* Project Backup Download */}
            <div className="pt-4 border-t border-[#E7E5E4] flex items-center justify-between">
              <span className="text-xs text-[#57534E]">
                Total de Conteúdo:{' '}
                <strong className="text-[#1C1917] font-mono">
                  {totalWords.toLocaleString('pt-BR')} palavras
                </strong>
              </span>
              <button
                onClick={handleExportProjectJson}
                className="px-4 py-2 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#1C1917] text-xs font-semibold border border-[#E7E5E4] transition uppercase tracking-wider text-[10px]"
              >
                Exportar Backup (JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Cover Zoom Modal */}
      {showCoverModal && project.metadata.coverImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-xl w-full flex flex-col items-center">
            <button
              onClick={() => setShowCoverModal(false)}
              className="absolute -top-10 right-0 p-2 text-stone-300 hover:text-white transition"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="relative w-full max-w-[380px] aspect-[148/210] bg-stone-900 shadow-2xl overflow-hidden border border-stone-800">
              <img
                src={project.metadata.coverImageUrl}
                alt="Capa Expandida"
                className="w-full h-full object-cover"
              />

              {overlayMode === 'overlay' && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/70 p-8 flex flex-col justify-between text-center text-white pointer-events-none">
                  <div className="pt-4 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300 bg-black/60 px-3 py-1 rounded border border-amber-500/30 inline-block">
                      ★ EDITORA OMNIA ★
                    </span>
                    <h3 className="text-2xl font-serif italic font-bold text-amber-50 drop-shadow-lg pt-2">
                      {project.metadata.titulo}
                    </h3>
                    {project.metadata.subtitulo && (
                      <p className="text-sm font-serif text-stone-200 opacity-90 italic pt-1">
                        {project.metadata.subtitulo}
                      </p>
                    )}
                  </div>

                  <div className="pb-4 space-y-1">
                    <div className="w-12 h-0.5 bg-amber-400 mx-auto my-2 opacity-80" />
                    <p className="text-sm font-serif font-bold tracking-widest text-white uppercase drop-shadow-md">
                      {project.metadata.autor}
                    </p>
                    <p className="text-xs font-mono tracking-widest text-amber-300/90 uppercase pt-1">
                      ✦ {project.metadata.editora || 'OMNIA'} ✦
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
