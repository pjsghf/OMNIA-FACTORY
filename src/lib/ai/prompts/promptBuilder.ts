import { BookMetadata, EditorialPlan, ChapterPlan } from '../../../types';
import { BookBibleMemory, formatMemoryForPrompt } from '../memory/bookBibleMemory';
import { detectSensitiveNiche } from '../policies/sensitiveNichePolicy';
import { ChapterSectionPlan } from '../planning/chapterSectionPlanner';

export interface PromptPackage {
  taskVersion: string;
  systemInstruction: string;
  userPrompt: string;
  jsonMode: boolean;
  temperature: number;
}

export function buildPlanPrompt(metadata: BookMetadata): PromptPackage {
  const nichePolicy = detectSensitiveNiche(metadata);

  const systemInstruction = `Você é um consagrado Diretor Editorial e Arquiteto de Livros.
Sua missão é projetar um Planejamento Editorial Completo e Coeso para um livro inédito em ${metadata.idioma || 'Português'}.

INSTRUÇÃO DE ESTILO:
${metadata.promptEstilo || 'Estilo fluido e envolvente de não-ficção.'}

INSTRUÇÃO DE TOM:
${metadata.tom || 'Conversacional e didático.'}

${nichePolicy.type !== 'none' ? `DIRETRIZES PARA NICHO SENSÍVEL (${nichePolicy.type.toUpperCase()}):\n${nichePolicy.toneConstraints}\nAviso obrigatório: ${nichePolicy.mandatoryDisclaimer}` : ''}

REGRAS RÍGIDAS DE PLANEJAMENTO:
1. Projete EXATAMENTE ${metadata.qtdCapitulos} capítulos no sumário.
2. Cada capítulo deve ter estimativa entre ${metadata.minPalavras} e ${metadata.maxPalavras} palavras.
3. Não crie estruturas vazias.
4. Responda ESTRITAMENTE em formato JSON.`;

  const userPrompt = `PROJETO EDITORIAL DO LIVRO:
- Título: ${metadata.titulo}
- Subtítulo: ${metadata.subtitulo || ''}
- Autor: ${metadata.autor}
- Editora: ${metadata.editora || 'Editora OMNIA'}
- Idioma: ${metadata.idioma}
- Público-Alvo: ${metadata.publicoAlvo}
- Resumo e Visão do Livro: ${metadata.resumo}
- Estilo: ${metadata.estilo}
- Tom da Escrita: ${metadata.tom}
- Quantidade de Capítulos Solicitada: ${metadata.qtdCapitulos}
- Mínimo de Palavras por Capítulo: ${metadata.minPalavras}
- Máximo de Palavras por Capítulo: ${metadata.maxPalavras}
- Materiais e Trechos do Usuário: ${metadata.materiais || 'Nenhum'}
- Informações Obrigatórias a Incluir: ${metadata.informacoesObrigatorias || 'Nenhuma'}
- Restrições e Proibições: ${metadata.restricoes || 'Nenhuma'}

Gere a estrutura em JSON exato:
{
  "conceitoCentral": "string",
  "promessaPrincipal": "string",
  "perfilLeitor": {
    "descricao": "string",
    "doresEAnseios": ["string"],
    "oQueBuscaraNoLivro": ["string"]
  },
  "sumario": [
    {
      "numero": 1,
      "titulo": "string",
      "subtitulo": "string",
      "objetivo": "string",
      "topicos": ["string"],
      "subtopicos": ["string"],
      "estimativaPalavras": 1500
    }
  ]
}`;

  return {
    taskVersion: '2.0.0-plan',
    systemInstruction,
    userPrompt,
    jsonMode: true,
    temperature: 0.2,
  };
}

export function buildWriterSectionBlockPrompt({
  metadata,
  plan,
  chapterPlan,
  sectionBlock,
  memory,
}: {
  metadata: BookMetadata;
  plan?: EditorialPlan | null;
  chapterPlan: ChapterPlan;
  sectionBlock: ChapterSectionPlan;
  memory: BookBibleMemory;
}): PromptPackage {
  const nichePolicy = detectSensitiveNiche(metadata);
  const memoryText = formatMemoryForPrompt(memory);

  const systemInstruction = `Você é um Escritor Editorial Sênior especialista na redação de obras completas em ${metadata.idioma || 'Português'}.
Sua missão é escrever o BLOCO DE CONTEÚDO ${sectionBlock.numeroBloco}: "${sectionBlock.tituloBloco}" para o CAPÍTULO ${chapterPlan.numero}: "${chapterPlan.titulo}".

DIRETRIZES DE ESTILO E TOM:
- Estilo (${metadata.estilo}): ${metadata.promptEstilo || 'Prosa límpida e fundamentada.'}
- Tom (${metadata.tom}): Mantenha ritmo envolvente e voz autoral consistente.

${nichePolicy.type !== 'none' ? `POLÍTICA PARA NICHO SENSÍVEL (${nichePolicy.type.toUpperCase()}):\n${nichePolicy.toneConstraints}\nFRASES PROIBIDAS: ${nichePolicy.forbiddenPhrases.join(', ')}` : ''}

REGRAS DE OURO DE ESCRITA:
1. Escreva em prosa contínua e rica de livro impresso.
2. Escreva EXATAMENTE em torno de ${sectionBlock.estimativaPalavras} palavras.
3. NÃO inclua saudações, introduções de IA ou observações meta-textuais. Escreva diretamente o texto do livro.
4. NÃO inclua o título do livro, cabeçalhos "Capítulo X" nem repita o título do capítulo no início do texto (o layout de diagramação insere a abertura do capítulo automaticamente).`;

  const userPrompt = `DADOS DO LIVRO E CONTEXTO:
- Título: ${metadata.titulo} (${metadata.subtitulo || ''})
- Autor: ${metadata.autor}
- Público-Alvo: ${metadata.publicoAlvo}
- Conceito Central: ${plan?.conceitoCentral || metadata.resumo}

${memoryText}

INSTRUÇÕES DO BLOCO DE TRABALHO ATUAL:
- Capítulo ${chapterPlan.numero}: ${chapterPlan.titulo}
- Bloco ${sectionBlock.numeroBloco}: ${sectionBlock.tituloBloco}
- Propósito do Bloco: ${sectionBlock.proposito}
- Tópicos Obrigatórios a Aprofundar: ${sectionBlock.topicos.join(', ')}
${sectionBlock.fatosObrigatorios.length > 0 ? `- Fatos/Pontos de Destaque Exigidos: ${sectionBlock.fatosObrigatorios.join(', ')}` : ''}
${metadata.materiais ? `<materiais_usuario>\n${metadata.materiais}\n</materiais_usuario>` : ''}
${metadata.informacoesObrigatorias ? `<informacoes_obrigatorias>\n${metadata.informacoesObrigatorias}\n</informacoes_obrigatorias>` : ''}
${metadata.restricoes ? `<restricoes_usuario>\n${metadata.restricoes}\n</restricoes_usuario>` : ''}
- Meta de Palavras para este Bloco: ~${sectionBlock.estimativaPalavras} palavras

Escreva a prosa do bloco agora:`;

  return {
    taskVersion: '2.0.0-write-block',
    systemInstruction,
    userPrompt,
    jsonMode: false,
    temperature: 0.65,
  };
}

export function buildMatterPrompt({
  metadata,
  plan: _plan,
  fullBookContent,
  type,
}: {
  metadata: BookMetadata;
  plan?: EditorialPlan | null;
  fullBookContent: string;
  type: 'introducao' | 'conclusao' | 'exercicios' | 'sobreAutor';
}): PromptPackage {
  const titles: Record<string, string> = {
    introducao: 'Introdução Oficial da Obra',
    conclusao: 'Conclusão e Encerramento',
    exercicios: 'Guia Prático de Exercícios e Aplicações',
    sobreAutor: 'Sobre o Autor',
  };

  const systemInstruction = `Você é um Editor Chefe Literário. Escreva a seção "${titles[type]}" para o livro em ${metadata.idioma || 'Português'}.
${type === 'sobreAutor' ? 'ATENÇÃO CRÍTICA: Use EXCLUSIVAMENTE as informações reais do autor fornecidas pelo usuário. JAMAIS invente diplomas, prêmios ou cargos não mencionados.' : ''}`;

  const userPrompt = `OBRA: ${metadata.titulo} - ${metadata.subtitulo || ''}
AUTOR: ${metadata.autor}
PERFIL DO AUTOR / NOTAS: ${metadata.resumo}

RESUMO DO CONTEÚDO EFETIVO DO LIVRO:
${fullBookContent ? fullBookContent.slice(0, 15000) : 'Livro fundamentado na obra do autor.'}

Escreva o texto completo da seção "${titles[type]}" em prosa elegante:`;

  return {
    taskVersion: '2.0.0-matter',
    systemInstruction,
    userPrompt,
    jsonMode: false,
    temperature: 0.5,
  };
}
