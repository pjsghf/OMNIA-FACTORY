/**
 * AST-aware and structure-preserving prose normalizer.
 * Replaces destructive regexes with token protection for code, math, snake_case, and markdown symbols.
 */

import { cleanChapterProse } from '../../rendering/cleanChapterProse';

export function normalizeProse(rawContent: string, chapterNumber?: number, chapterTitle?: string): string {
  if (!rawContent || typeof rawContent !== 'string') return '';

  let text = rawContent;

  // 1. Remove AI conversational prefixes and suffixes
  text = text.replace(
    /^(com certeza|aqui está|certamente|com prazer|abaixo está|segue o)[^\n]*:\n+/gi,
    ''
  );
  text = text.replace(
    /\n+(espero que este capítulo|espero que goste|quaisquer dúvidas|boa leitura!)[^\n]*$/gi,
    ''
  );

  // 1b. Clean redundant leading chapter header if present
  text = cleanChapterProse(text, chapterNumber, chapterTitle);

  // 2. Protect Code Blocks
  const codeBlocks: string[] = [];
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
  });

  // 3. Protect Inline Code
  const inlineCodes: string[] = [];
  text = text.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match);
    return `___INLINE_CODE_${inlineCodes.length - 1}___`;
  });

  // 4. Protect Math Formulas (e.g. $...$ or $$...$$)
  const mathExpressions: string[] = [];
  text = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    mathExpressions.push(match);
    return `___MATH_BLOCK_${mathExpressions.length - 1}___`;
  });
  text = text.replace(/\$[^\$\n]+\$/g, (match) => {
    mathExpressions.push(match);
    return `___MATH_INLINE_${mathExpressions.length - 1}___`;
  });

  // 5. Clean excessive empty lines (more than 2 consecutive newlines)
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. Restore Math Expressions
  mathExpressions.forEach((math, idx) => {
    text = text.replace(`___MATH_INLINE_${idx}___`, math);
    text = text.replace(`___MATH_BLOCK_${idx}___`, math);
  });

  // 7. Restore Inline Code
  inlineCodes.forEach((code, idx) => {
    text = text.replace(`___INLINE_CODE_${idx}___`, code);
  });

  // 8. Restore Code Blocks
  codeBlocks.forEach((code, idx) => {
    text = text.replace(`___CODE_BLOCK_${idx}___`, code);
  });

  return text.trim();
}
