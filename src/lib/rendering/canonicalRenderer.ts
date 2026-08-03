import { BookProject } from '../../types';
import { cleanChapterProse } from './cleanChapterProse';

export interface CanonicalSection {
  id: string;
  type: 'cover' | 'title_page' | 'copyright' | 'front_matter' | 'chapter' | 'end_matter';
  title: string;
  subtitle?: string;
  content: string;
  chapterNumber?: number;
}

export function buildCanonicalBookSequence(project: BookProject): CanonicalSection[] {
  const sequence: CanonicalSection[] = [];

  // 1. Cover Image
  if (project.metadata?.coverImageUrl) {
    sequence.push({
      id: 'sec-cover',
      type: 'cover',
      title: project.metadata.titulo,
      subtitle: project.metadata.subtitulo,
      content: project.metadata.coverImageUrl,
    });
  }

  // 2. Title Page & Credits
  sequence.push({
    id: 'sec-title-page',
    type: 'title_page',
    title: project.metadata.titulo,
    subtitle: project.metadata.subtitulo,
    content: `${project.metadata.titulo}\n${project.metadata.subtitulo || ''}\n\nPor ${project.metadata.autor}\n\n${project.metadata.editora || 'Omnia Publish AI'}`,
  });

  // 3. Copyright Page
  sequence.push({
    id: 'sec-copyright',
    type: 'copyright',
    title: 'Direitos Autorais',
    content: `© ${new Date().getFullYear()} ${project.metadata.autor}.\nTodos os direitos reservados.\nObra gerada e polida via Omnia Publish AI.`,
  });

  // 4. Front Matter
  if (project.frontMatter?.apresentacao?.trim()) {
    sequence.push({
      id: 'sec-front-apresentacao',
      type: 'front_matter',
      title: 'Apresentação',
      content: project.frontMatter.apresentacao,
    });
  }
  if (project.frontMatter?.introducao?.trim()) {
    sequence.push({
      id: 'sec-front-introducao',
      type: 'front_matter',
      title: 'Introdução',
      content: project.frontMatter.introducao,
    });
  }

  // 5. Chapters in Order
  (project.chapters || []).forEach((cap) => {
    sequence.push({
      id: `sec-cap-${cap.numero}`,
      type: 'chapter',
      title: `Capítulo ${cap.numero}: ${cap.titulo}`,
      subtitle: cap.subtitulo,
      chapterNumber: cap.numero,
      content: cleanChapterProse(cap.content || '*Capítulo pendente de redação.*', cap.numero, cap.titulo),
    });
  });

  // 6. End Matter
  if (project.endMatter?.conclusao?.trim()) {
    sequence.push({
      id: 'sec-end-conclusao',
      type: 'end_matter',
      title: 'Conclusão',
      content: project.endMatter.conclusao,
    });
  }
  if (project.endMatter?.exercicios?.trim()) {
    sequence.push({
      id: 'sec-end-exercicios',
      type: 'end_matter',
      title: 'Exercícios e Práticas Recomendadas',
      content: project.endMatter.exercicios,
    });
  }
  if (project.endMatter?.sobreAutor?.trim()) {
    sequence.push({
      id: 'sec-end-sobre-autor',
      type: 'end_matter',
      title: 'Sobre o Autor',
      content: project.endMatter.sobreAutor,
    });
  }

  return sequence;
}

export function renderProseToHTML(proseText: string): string {
  if (!proseText) return '';

  const paragraphs = proseText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      // Check if it looks like an uppercase section title
      if (p.length < 120 && p === p.toUpperCase() && !p.endsWith('.')) {
        return `<h3 className="text-lg font-serif font-bold italic text-[#1C1917] mt-8 mb-4 border-b border-[#E7E5E4] pb-1">${escapeHtml(p)}</h3>`;
      }
      return `<p className="text-base text-[#1C1917] font-serif leading-relaxed mb-6">${escapeHtml(p)}</p>`;
    })
    .join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
