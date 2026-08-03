import { BookProject } from '../../types';

export interface PreflightGateItem {
  id: string;
  category: 'chapters' | 'metadata' | 'review' | 'assets' | 'placeholders';
  severity: 'error' | 'warning' | 'info';
  label: string;
  passed: boolean;
  message: string;
  waiverAllowed?: boolean;
}

export interface ExportPreflightReport {
  score: number; // 0 - 100
  readyToPublish: boolean;
  hasBlockingErrors: boolean;
  items: PreflightGateItem[];
  checkedAt: string;
}

const PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum/i,
  /\[insira\s+aqui\]/i,
  /\[preencher\]/i,
  /\[texto\s+aqui\]/i,
  /todo:/i,
  /draft\s+inicial/i,
  /texto\s+fictício/i,
];

/**
 * Validates project readiness before generating production EPUB, PDF, HTML, or Markdown exports.
 */
export function validateExportPreflight(project: BookProject): ExportPreflightReport {
  const items: PreflightGateItem[] = [];

  // 1. Chapters Check
  const chapters = project.chapters || [];
  const totalChapters = chapters.length;
  const emptyChapters = chapters.filter((c) => !c.content || c.content.trim().length < 100);

  if (totalChapters === 0) {
    items.push({
      id: 'chap-count',
      category: 'chapters',
      severity: 'error',
      label: 'Sumário de Capítulos',
      passed: false,
      message: 'O projeto não possui nenhum capítulo configurado no sumário.',
    });
  } else if (emptyChapters.length > 0) {
    items.push({
      id: 'chap-empty',
      category: 'chapters',
      severity: 'error',
      label: 'Capítulos sem Conteúdo',
      passed: false,
      message: `${emptyChapters.length} de ${totalChapters} capítulo(s) estão vazios ou possuem menos de 100 palavras.`,
    });
  } else {
    items.push({
      id: 'chap-ok',
      category: 'chapters',
      severity: 'info',
      label: 'Integridade de Capítulos',
      passed: true,
      message: `Todos os ${totalChapters} capítulos contêm texto completo redigido.`,
    });
  }

  // 2. Metadata Check
  const meta = project.metadata;
  const hasTitle = Boolean(meta?.titulo?.trim());
  const hasAuthor = Boolean(meta?.autor?.trim());
  const bcp47Lang = meta?.idioma?.toLowerCase() || '';
  const validLang =
    bcp47Lang.includes('pt') || bcp47Lang.includes('en') || bcp47Lang.includes('es');

  if (!hasTitle || !hasAuthor) {
    items.push({
      id: 'meta-required',
      category: 'metadata',
      severity: 'error',
      label: 'Metadados Principais',
      passed: false,
      message: 'Título e Autor são campos obrigatórios para a publicação.',
    });
  } else {
    items.push({
      id: 'meta-ok',
      category: 'metadata',
      severity: 'info',
      label: 'Metadados Editoriais',
      passed: true,
      message: `Obra "${meta.titulo}" por ${meta.autor} (${meta.editora || 'Omnia Publish AI'}).`,
    });
  }

  if (!validLang) {
    items.push({
      id: 'meta-lang',
      category: 'metadata',
      severity: 'warning',
      label: 'Código de Idioma BCP-47',
      passed: false,
      message: `O idioma informado ("${meta?.idioma}") deve seguir o padrão BCP-47 (ex: "pt-BR", "en-US", "es-ES").`,
      waiverAllowed: true,
    });
  }

  // 3. Editorial Review Freshness
  if (!project.editorialReport) {
    items.push({
      id: 'review-missing',
      category: 'review',
      severity: 'warning',
      label: 'Auditoria Editorial',
      passed: false,
      message: 'A obra ainda não foi submetida à auditoria de qualidade editorial.',
      waiverAllowed: true,
    });
  } else if (project.editorialReport.obsoleto) {
    items.push({
      id: 'review-stale',
      category: 'review',
      severity: 'warning',
      label: 'Relatório de Auditoria Obsoleto',
      passed: false,
      message:
        'O conteúdo dos capítulos foi editado após a última auditoria. Execute nova revisão.',
      waiverAllowed: true,
    });
  } else {
    items.push({
      id: 'review-ok',
      category: 'review',
      severity: 'info',
      label: 'Qualidade Editorial Auditada',
      passed: true,
      message: `Auditoria válida com Nota ${project.editorialReport.notaGeral}/100.`,
    });
  }

  // 4. Placeholders Detection
  let foundPlaceholdersCount = 0;
  for (const cap of chapters) {
    if (!cap.content) continue;
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(cap.content)) {
        foundPlaceholdersCount++;
        break;
      }
    }
  }

  if (foundPlaceholdersCount > 0) {
    items.push({
      id: 'placeholder-found',
      category: 'placeholders',
      severity: 'error',
      label: 'Textos Temporários / Rascunhos',
      passed: false,
      message: `Detectados marcadores temporários (ex: "Lorem Ipsum", "[INSIRA AQUI]") em ${foundPlaceholdersCount} capítulo(s).`,
    });
  } else {
    items.push({
      id: 'placeholder-clean',
      category: 'placeholders',
      severity: 'info',
      label: 'Ausência de Rascunhos',
      passed: true,
      message: 'Nenhum texto genérico ou rascunho temporário foi localizado.',
    });
  }

  // 5. Offline Assets Resolution
  const coverUrl = project.metadata?.coverImageUrl || '';
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    items.push({
      id: 'asset-remote',
      category: 'assets',
      severity: 'warning',
      label: 'Capa remota via HTTP',
      passed: false,
      message:
        'A imagem de capa é uma URL remota. Para exportação offline 100% garantida, incorpore ou gere arte vetorial.',
      waiverAllowed: true,
    });
  } else {
    items.push({
      id: 'asset-ok',
      category: 'assets',
      severity: 'info',
      label: 'Recursos de Imagem Offline',
      passed: true,
      message: coverUrl
        ? 'Capa embutida como recurso offline autônomo (Base64/SVG).'
        : 'Nenhuma imagem externa pendente.',
    });
  }

  // Compute metrics
  const errorCount = items.filter((i) => i.severity === 'error' && !i.passed).length;

  const passedCount = items.filter((i) => i.passed).length;
  const score = Math.round((passedCount / items.length) * 100);

  return {
    score,
    readyToPublish: errorCount === 0,
    hasBlockingErrors: errorCount > 0,
    items,
    checkedAt: new Date().toISOString(),
  };
}
