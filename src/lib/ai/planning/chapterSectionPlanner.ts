import { ChapterPlan, BookMetadata } from '../../../types';

export interface ChapterSectionPlan {
  numeroBloco: number;
  tituloBloco: string;
  proposito: string;
  topicos: string[];
  fatosObrigatorios: string[];
  transicaoProximoBloco: string;
  estimativaPalavras: number;
}

export interface DetailedChapterPlan {
  chapterNumber: number;
  chapterTitle: string;
  targetWordCount: number;
  sections: ChapterSectionPlan[];
}

export function buildChapterSectionPlan(
  chapter: ChapterPlan,
  metadata: BookMetadata
): DetailedChapterPlan {
  const targetWords = chapter.estimativaPalavras || Math.round((metadata.minPalavras + metadata.maxPalavras) / 2);

  // Determine optimal block count (each block 700-1200 words)
  let blockCount = 2;
  if (targetWords >= 2500) {
    blockCount = 4;
  } else if (targetWords >= 1500) {
    blockCount = 3;
  }

  const wordsPerBlock = Math.round(targetWords / blockCount);

  const topicos = chapter.topicos && chapter.topicos.length > 0
    ? chapter.topicos
    : ['Introdução ao tema', 'Desenvolvimento do conceito', 'Aplicações e conclusão'];

  const subtopicos = chapter.subtopicos || [];

  const sections: ChapterSectionPlan[] = [];

  for (let b = 1; b <= blockCount; b++) {
    let tituloBloco = '';
    let proposito = '';
    let blockTopics: string[] = [];

    if (b === 1) {
      tituloBloco = `Introdução e Fundamentos de ${chapter.titulo}`;
      proposito = `Apresentar o conceito central e contextualizar o leitor sobre ${chapter.objetivo}`;
      blockTopics = topicos.slice(0, Math.ceil(topicos.length / blockCount));
    } else if (b === blockCount) {
      tituloBloco = `Síntese e Implicações Práticas`;
      proposito = `Consolidar o aprendizado do capítulo e preparar o gancho para o próximo tema.`;
      blockTopics = topicos.slice((b - 1) * Math.floor(topicos.length / blockCount));
    } else {
      tituloBloco = `Aprofundamento e Análise Crítica (Parte ${b})`;
      proposito = `Explorar em detalhe os aspectos técnicos e práticos de ${chapter.titulo}`;
      blockTopics = topicos.slice(
        (b - 1) * Math.floor(topicos.length / blockCount),
        b * Math.floor(topicos.length / blockCount)
      );
    }

    if (blockTopics.length === 0) {
      blockTopics = [topicos[b - 1] || `Aprofundamento do tema ${b}`];
    }

    sections.push({
      numeroBloco: b,
      tituloBloco,
      proposito,
      topicos: blockTopics,
      fatosObrigatorios: subtopicos.length > 0 ? [subtopicos[(b - 1) % subtopicos.length]] : [],
      transicaoProximoBloco: b < blockCount ? `Conectar naturalmente com o bloco ${b + 1}` : 'Conclusão firme do capítulo',
      estimativaPalavras: wordsPerBlock,
    });
  }

  return {
    chapterNumber: chapter.numero,
    chapterTitle: chapter.titulo,
    targetWordCount: targetWords,
    sections,
  };
}
