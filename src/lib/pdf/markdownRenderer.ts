import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

let nodeJsdom: any = null;
let nodeDOMPurifyFactory: any = null;
let nodeInitPromise: Promise<void> | null = null;

export async function ensureNodeJsdom(): Promise<void> {
  if (typeof window !== 'undefined') return;
  if (nodeJsdom && nodeDOMPurifyFactory) return;
  if (!nodeInitPromise) {
    nodeInitPromise = (async () => {
      try {
        const jsdomMod = 'jsdom';
        const dompurifyMod = 'dompurify';
        const jsdomPkg = await import(/* @vite-ignore */ jsdomMod);
        const dompurifyPkg = await import(/* @vite-ignore */ dompurifyMod);
        const JSDOM = jsdomPkg.JSDOM || jsdomPkg.default?.JSDOM;
        nodeJsdom = { JSDOM };
        nodeDOMPurifyFactory = dompurifyPkg.default || dompurifyPkg;
      } catch (err) {
        console.error('Failed to initialize JSDOM in Node environment:', err);
      }
    })();
  }
  await nodeInitPromise;
}

const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

// Customize link rules
const defaultLinkRule =
  mdParser.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

mdParser.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token) {
    const aIndex = token.attrIndex('target');
    if (aIndex < 0) {
      token.attrPush(['target', '_blank']);
    } else if (token.attrs && token.attrs[aIndex]) {
      token.attrs[aIndex][1] = '_blank';
    }
    token.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkRule(tokens, idx, options, env, self);
};

export function renderMarkdownForPrint(markdown: string): string {
  if (!markdown || !markdown.trim()) {
    return '';
  }

  try {
    // Render raw HTML using markdown-it
    const renderedHtml = mdParser.render(markdown.trim());

    let root: HTMLElement | null = null;
    let sanitizer: any = DOMPurify;

    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      // Browser environment
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div id="md-root">${renderedHtml}</div>`, 'text/html');
      root = doc.getElementById('md-root');
      sanitizer = (DOMPurify as any)?.default?.sanitize ? (DOMPurify as any).default : DOMPurify;
    } else if (nodeJsdom && nodeDOMPurifyFactory) {
      // Node.js environment via JSDOM
      try {
        const dom = new nodeJsdom.JSDOM(`<div id="md-root">${renderedHtml}</div>`);
        root = dom.window.document.getElementById('md-root');
        sanitizer = nodeDOMPurifyFactory(dom.window);
        if (sanitizer && sanitizer.default) {
          sanitizer = sanitizer.default;
        }
      } catch (err) {
        console.error('Node JSDOM execution error:', err);
      }
    }

    if (!root) {
      return renderedHtml;
    }

    // Identify direct children to apply p-first strictly to the FIRST top-level narrative paragraph
    let firstNarrativePFound = false;

    Array.from(root.children).forEach((child) => {
      const tagName = child.tagName.toUpperCase();

      if (tagName === 'P') {
        const p = child as HTMLParagraphElement;
        if (!firstNarrativePFound) {
          p.classList.add('p-first');
          firstNarrativePFound = true;
        } else {
          p.classList.add('p-subsequent');
        }
      } else if (tagName === 'H1') {
        child.classList.add('print-h2');
      } else if (tagName === 'H2') {
        child.classList.add('print-h3');
      } else if (tagName === 'H3' || tagName === 'H4' || tagName === 'H5' || tagName === 'H6') {
        child.classList.add('print-h4');
      } else if (tagName === 'BLOCKQUOTE') {
        child.classList.add('print-quote');
      } else if (tagName === 'UL') {
        child.classList.add('print-ul');
      } else if (tagName === 'OL') {
        child.classList.add('print-ol');
      } else if (tagName === 'TABLE') {
        child.classList.add('print-table');
      }
    });

    // Ensure any sub-nested headings or elements also have styling classes
    root.querySelectorAll('h1').forEach((h) => h.classList.add('print-h2'));
    root.querySelectorAll('h2').forEach((h) => h.classList.add('print-h3'));
    root.querySelectorAll('h3, h4, h5, h6').forEach((h) => h.classList.add('print-h4'));
    root.querySelectorAll('blockquote').forEach((bq) => bq.classList.add('print-quote'));
    root.querySelectorAll('ul').forEach((ul) => ul.classList.add('print-ul'));
    root.querySelectorAll('ol').forEach((ol) => ol.classList.add('print-ol'));
    root.querySelectorAll('table').forEach((tbl) => tbl.classList.add('print-table'));

    if (sanitizer && typeof sanitizer.sanitize === 'function') {
      return sanitizer.sanitize(root.innerHTML, {
        ADD_ATTR: ['target', 'rel'],
      });
    }

    return root.innerHTML;
  } catch (err) {
    console.warn('Erro ao renderizar markdown para impressão, aplicando fallback:', err);
    return mdParser.render(markdown.trim());
  }
}
