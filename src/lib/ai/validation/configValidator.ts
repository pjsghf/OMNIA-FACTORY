import { BookMetadata } from '../../../types';

export interface ValidationResult {
  valid: boolean;
  sanitizedMetadata?: BookMetadata;
  errors: Record<string, string>;
}

export function validateBookConfig(input: Partial<BookMetadata>): ValidationResult {
  const errors: Record<string, string> = {};

  const titulo = (input.titulo || '').trim();
  if (!titulo) {
    errors.titulo = 'O título do livro é obrigatório.';
  } else if (titulo.length > 200) {
    errors.titulo = 'O título deve conter no máximo 200 caracteres.';
  }

  const autor = (input.autor || '').trim();
  if (!autor) {
    errors.autor = 'O nome do autor é obrigatório.';
  }

  const qtdCapitulos = Number(input.qtdCapitulos) || 7;
  if (!Number.isInteger(qtdCapitulos) || qtdCapitulos < 1 || qtdCapitulos > 50) {
    errors.qtdCapitulos = 'A quantidade de capítulos deve ser um número inteiro entre 1 e 50.';
  }

  let minPalavras = Number(input.minPalavras) || 1000;
  let maxPalavras = Number(input.maxPalavras) || 2500;

  if (isNaN(minPalavras) || minPalavras < 300) {
    errors.minPalavras = 'O mínimo de palavras por capítulo deve ser pelo menos 300.';
  }

  if (isNaN(maxPalavras) || maxPalavras > 20000) {
    errors.maxPalavras = 'O máximo de palavras por capítulo não pode exceder 20.000.';
  }

  if (maxPalavras < minPalavras + 100) {
    errors.maxPalavras =
      'O máximo de palavras deve ser pelo menos 100 palavras maior que o mínimo.';
    maxPalavras = minPalavras + 500;
  }

  const sanitizedMetadata: BookMetadata = {
    titulo: titulo || 'Livro Sem Título',
    subtitulo: (input.subtitulo || '').trim(),
    autor: autor || 'Anônimo',
    editora: (input.editora || 'Editora OMNIA').trim(),
    idioma: (input.idioma || 'pt-BR').trim(),
    publicoAlvo: (input.publicoAlvo || 'Público Geral').trim(),
    resumo: (input.resumo || 'Obra transformadora e bem fundamentada.').trim(),
    estilo: input.estilo || 'nao_ficcao',
    promptEstilo: (input.promptEstilo || '').trim(),
    tom: input.tom || 'conversacional',
    qtdCapitulos,
    minPalavras,
    maxPalavras,
    materiais: (input.materiais || '').trim(),
    informacoesObrigatorias: (input.informacoesObrigatorias || '').trim(),
    restricoes: (input.restricoes || '').trim(),
    coverImageUrl: input.coverImageUrl,
  };

  return {
    valid: Object.keys(errors).length === 0,
    sanitizedMetadata,
    errors,
  };
}
