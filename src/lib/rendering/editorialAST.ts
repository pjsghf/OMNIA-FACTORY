/**
 * Editorial AST (Abstract Syntax Tree)
 * Unified Intermediate Representation for Book Content across Preview, EPUB, PDF, HTML, and Markdown export engines.
 */

export type ASTNodeType =
  'heading' | 'paragraph' | 'blockquote' | 'list' | 'image' | 'hr' | 'callout';

export interface ASTInlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export interface CanonicalASTNode {
  type: ASTNodeType;
  level?: number; // 1-6 for headings
  text?: string;
  spans?: ASTInlineSpan[];
  items?: string[]; // for lists
  ordered?: boolean;
  src?: string;
  alt?: string;
  caption?: string;
  calloutType?: 'note' | 'warning' | 'tip' | 'quote';
}

export type EditorialAST = CanonicalASTNode[];

export function parseInlineSpans(text: string): ASTInlineSpan[] {
  if (!text) return [];
  // Basic inline formatting parser for bold, italic, and code
  const spans: ASTInlineSpan[] = [];

  // Simple token regex matching **bold**, *italic*, _italic_, `code`.
  //
  // The _italic_ alternative is boundary-anchored on purpose. A bare `_(.*?)_`
  // also matches the underscores *inside* an identifier, so "snake_case_x" came
  // out as "snake" + italic "case" + "x" -- the underscores silently deleted from
  // the exported book. Underscore emphasis now only applies when the delimiters
  // are not glued to alphanumerics, which is also how CommonMark treats them.
  const regex = /(\*\*(.*?)\*\*|\*(.*?)\*|(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])|`(.*?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: text.substring(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      spans.push({ text: match[2], bold: true });
    } else if (match[3] !== undefined) {
      spans.push({ text: match[3], italic: true });
    } else if (match[4] !== undefined) {
      spans.push({ text: match[4], italic: true });
    } else if (match[5] !== undefined) {
      spans.push({ text: match[5], code: true });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    spans.push({ text: text.substring(lastIndex) });
  }

  return spans.length > 0 ? spans : [{ text }];
}

export function parseMarkdownToAST(markdown: string): EditorialAST {
  if (!markdown) return [];

  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const ast: EditorialAST = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Headings
    if (trimmed.startsWith('# ')) {
      ast.push({
        type: 'heading',
        level: 1,
        text: trimmed.substring(2).trim(),
        spans: parseInlineSpans(trimmed.substring(2).trim()),
      });
    } else if (trimmed.startsWith('## ')) {
      ast.push({
        type: 'heading',
        level: 2,
        text: trimmed.substring(3).trim(),
        spans: parseInlineSpans(trimmed.substring(3).trim()),
      });
    } else if (trimmed.startsWith('### ')) {
      ast.push({
        type: 'heading',
        level: 3,
        text: trimmed.substring(4).trim(),
        spans: parseInlineSpans(trimmed.substring(4).trim()),
      });
    } else if (trimmed.startsWith('#### ')) {
      ast.push({
        type: 'heading',
        level: 4,
        text: trimmed.substring(5).trim(),
        spans: parseInlineSpans(trimmed.substring(5).trim()),
      });
    }
    // Callouts [!NOTE], [!WARNING], etc.
    // MUST come before the blockquote branch: a callout also starts with "> ", so
    // when blockquote was checked first this branch was unreachable and callouts
    // rendered as ordinary quotes with a literal "[!WARNING]" left in the prose.
    else if (trimmed.match(/^>\s*\[!(NOTE|WARNING|TIP|QUOTE)\]/i)) {
      const lines = trimmed.split('\n');
      const firstLine = lines[0] || '';
      const tagMatch = firstLine.match(/\[!(NOTE|WARNING|TIP|QUOTE)\]/i);
      const calloutType = (tagMatch && tagMatch[1] ? tagMatch[1].toLowerCase() : 'note') as any;
      const body = lines
        .slice(1)
        .map((l) => l.replace(/^>\s*/, ''))
        .join(' ');
      ast.push({
        type: 'callout',
        calloutType,
        text: body,
        spans: parseInlineSpans(body),
      });
    }
    // Blockquote (plain "> " with no callout tag)
    else if (trimmed.startsWith('> ')) {
      const quoteText = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s*/, ''))
        .join(' ');
      ast.push({
        type: 'blockquote',
        text: quoteText,
        spans: parseInlineSpans(quoteText),
      });
    }
    // Horizontal rule
    else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      ast.push({ type: 'hr' });
    }
    // Unordered List
    else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const items = trimmed
        .split('\n')
        .map((l) => l.replace(/^[\*\-]\s*/, '').trim())
        .filter(Boolean);
      ast.push({
        type: 'list',
        ordered: false,
        items,
      });
    }
    // Ordered List
    else if (trimmed.match(/^\d+\.\s/)) {
      const items = trimmed
        .split('\n')
        .map((l) => l.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
      ast.push({
        type: 'list',
        ordered: true,
        items,
      });
    }
    // Image Markdown ![alt](src "caption")
    else if (trimmed.match(/^!\[(.*?)\]\((.*?)\)$/)) {
      const match = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (match) {
        ast.push({
          type: 'image',
          alt: match[1],
          src: match[2],
        });
      }
    }
    // Standard Paragraph
    else {
      const pText = trimmed.split('\n').join(' ');
      ast.push({
        type: 'paragraph',
        text: pText,
        spans: parseInlineSpans(pText),
      });
    }
  }

  return ast;
}

export function escapeXML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderSpansToHTML(spans?: ASTInlineSpan[]): string {
  if (!spans || spans.length === 0) return '';
  return spans
    .map((span) => {
      let html = escapeXML(span.text);
      if (span.code) html = `<code>${html}</code>`;
      if (span.bold) html = `<strong>${html}</strong>`;
      if (span.italic) html = `<em>${html}</em>`;
      return html;
    })
    .join('');
}

export function renderASTToHTML(ast: EditorialAST): string {
  let html = '';
  let isFirstP = true;

  for (const node of ast) {
    switch (node.type) {
      case 'heading': {
        const level = node.level || 2;
        html += `<h${level} class="heading-l${level}">${renderSpansToHTML(node.spans)}</h${level}>\n`;
        isFirstP = true;
        break;
      }
      case 'paragraph': {
        const pClass = isFirstP ? 'first-p' : 'p-body';
        html += `<p class="${pClass}">${renderSpansToHTML(node.spans)}</p>\n`;
        isFirstP = false;
        break;
      }
      case 'blockquote': {
        html += `<blockquote><p>${renderSpansToHTML(node.spans)}</p></blockquote>\n`;
        isFirstP = true;
        break;
      }
      case 'callout': {
        html += `<div class="callout callout-${node.calloutType || 'note'}"><p>${renderSpansToHTML(node.spans)}</p></div>\n`;
        isFirstP = true;
        break;
      }
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul';
        const itemsHtml = (node.items || [])
          .map((item) => `  <li>${escapeXML(item)}</li>`)
          .join('\n');
        html += `<${tag}>\n${itemsHtml}\n</${tag}>\n`;
        isFirstP = true;
        break;
      }
      case 'hr': {
        html += `<hr class="section-divider" />\n`;
        isFirstP = true;
        break;
      }
      case 'image': {
        if (node.src) {
          html += `<figure class="editorial-image"><img src="${escapeXML(node.src)}" alt="${escapeXML(node.alt || '')}" />${node.caption ? `<figcaption>${escapeXML(node.caption)}</figcaption>` : ''}</figure>\n`;
        }
        isFirstP = true;
        break;
      }
    }
  }

  return html;
}

export function renderASTToXHTML(ast: EditorialAST): string {
  // Strict XHTML rendering for EPUB (replace invalid named entity &nbsp; with &#160;)
  return renderASTToHTML(ast).replace(/&nbsp;/g, '&#160;');
}

export function renderASTToMarkdown(ast: EditorialAST): string {
  let md = '';

  for (const node of ast) {
    switch (node.type) {
      case 'heading': {
        const prefix = '#'.repeat(node.level || 2);
        md += `${prefix} ${node.text || ''}\n\n`;
        break;
      }
      case 'paragraph': {
        md += `${node.text || ''}\n\n`;
        break;
      }
      case 'blockquote': {
        md += `> ${node.text || ''}\n\n`;
        break;
      }
      case 'callout': {
        md += `> [!${(node.calloutType || 'NOTE').toUpperCase()}]\n> ${node.text || ''}\n\n`;
        break;
      }
      case 'list': {
        if (node.ordered) {
          (node.items || []).forEach((item, i) => {
            md += `${i + 1}. ${item}\n`;
          });
        } else {
          (node.items || []).forEach((item) => {
            md += `- ${item}\n`;
          });
        }
        md += '\n';
        break;
      }
      case 'hr': {
        md += `---\n\n`;
        break;
      }
      case 'image': {
        md += `![${node.alt || ''}](${node.src || ''})\n\n`;
        break;
      }
    }
  }

  return md.trim();
}
