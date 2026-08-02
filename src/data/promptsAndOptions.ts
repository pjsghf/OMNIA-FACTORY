import { BookStyle, WritingTone } from '../types';

export interface StyleOption {
  id: BookStyle;
  label: string;
  description: string;
  agentSystemPrompt: string;
}

export interface ToneOption {
  id: WritingTone;
  label: string;
  description: string;
  agentSystemPrompt: string;
}

// Exactly 20 languages from Americas and Europe
export const EUROPE_AMERICAS_LANGUAGES: { code: string; name: string; region: string }[] = [
  { code: 'pt-BR', name: 'Português (Brasil)', region: 'Américas' },
  { code: 'pt-PT', name: 'Português (Portugal)', region: 'Europa' },
  { code: 'en-US', name: 'Inglês (Estados Unidos)', region: 'Américas' },
  { code: 'en-GB', name: 'Inglês (Reino Unido)', region: 'Europa' },
  { code: 'es-MX', name: 'Espanhol (América Latina)', region: 'Américas' },
  { code: 'es-ES', name: 'Espanhol (Espanha)', region: 'Europa' },
  { code: 'fr-FR', name: 'Francês (França)', region: 'Europa' },
  { code: 'fr-CA', name: 'Francês (Canadá / Québec)', region: 'Américas' },
  { code: 'de-DE', name: 'Alemão (Alemanha / Áustria / Suíça)', region: 'Europa' },
  { code: 'it-IT', name: 'Italiano (Itália)', region: 'Europa' },
  { code: 'nl-NL', name: 'Holandês (Países Baixos)', region: 'Europa' },
  { code: 'pl-PL', name: 'Polonês (Polônia)', region: 'Europa' },
  { code: 'sv-SE', name: 'Sueco (Suécia)', region: 'Europa' },
  { code: 'no-NO', name: 'Norueguês (Noruega)', region: 'Europa' },
  { code: 'da-DK', name: 'Dinamarquês (Dinamarca)', region: 'Europa' },
  { code: 'fi-FI', name: 'Finlandês (Finlândia)', region: 'Europa' },
  { code: 'ru-RU', name: 'Russo (Europa Oriental)', region: 'Europa' },
  { code: 'uk-UA', name: 'Ucraniano (Ucrânia)', region: 'Europa' },
  { code: 'el-GR', name: 'Grego (Grécia)', region: 'Europa' },
  { code: 'ro-RO', name: 'Romeno (Romênia)', region: 'Europa' },
];

export const BOOK_STYLES_OPTIONS: StyleOption[] = [
  {
    id: 'desenvolvimento_pessoal',
    label: 'Desenvolvimento Pessoal & Alta Performance',
    description: 'Focado em hábitos, mentalidade, foco, transformação e superação.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO DESENVOLVIMENTO PESSOAL:
- Estrutura de capítulos com arco de conscientização -> revelação teórica -> métodos práticos -> exercícios de fixação.
- Use metáforas viscerais, analogias cotidianas e estudos de caso de psicologia comportamental.
- Evite lugares-comuns e clichês superficiais. Forneça estratégias aplicáveis com passos mensuráveis.
- Encerre seções com perguntas reflexivas direcionadas ao leitor.`,
  },
  {
    id: 'nao_ficcao',
    label: 'Não-Ficção Geral & Ensaio Editorial',
    description: 'Análise profunda, rigor conceitual e clareza de exposição temática.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO NÃO-FICÇÃO GERAL:
- Mantenha argumentação lógica encadeada, fundamentação clara e transições fluidas entre conceitos.
- Contextualize o panorama histórico, social ou cultural do tema tratado.
- Equilibre dados e reflexões conceituais com narrativa fluida e atraente.`,
  },
  {
    id: 'ficcao',
    label: 'Ficção, Romance & Narrativa Literária',
    description: 'Construção narrativa imersiva, diálogos vívidos, conflito e desenvolvimento de personagens.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO FICÇÃO & ROMANCE:
- Priorize 'Show, Don't Tell' (Mostre, Não Apenas Conte) através de detalhes sensoriais e ações dramáticas.
- Desenvolva subtexto nos diálogos, ritmo de cena variado e arco de tensão crescente em cada capítulo.
- Mantenha a voz interior dos personagens autêntica e alinhada ao gênero.`,
  },
  {
    id: 'negocios_estrategia',
    label: 'Negócios, Liderança & Estratégia Corporativa',
    description: 'Frameworks de gestão, tomada de decisão, escalabilidade e cases práticos.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO NEGÓCIOS & ESTRATÉGIA:
- Adote tom executivo, orientado a resultados, eficiência, ROI e criação de valor sustentável.
- Inclua checklists conceituais, princípios de liderança e diretrizes de implementação em empresas.
- Apresente dilemas reais do mercado e como líderes os superam com dados e visão de futuro.`,
  },
  {
    id: 'tecnico_educacional',
    label: 'Técnico, Científico & Educacional',
    description: 'Precisão de conceitos, passo a passo estruturado, exemplos e rigor acadêmico.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO TÉCNICO & EDUCACIONAL:
- Priorize a clareza didática com progressão lógica do simples ao complexo.
- Explique jargões técnicos com precisão e forneça definições contextuais imediatas.
- Adicione diagramas textuais ou exemplos práticos comentados para fixação do conhecimento.`,
  },
  {
    id: 'biografia_memorias',
    label: 'Biografia, Autobiografia & Memórias',
    description: 'Narrativa pessoal humanizada, contexto de época, superação e legado.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO BIOGRAFIA & MEMÓRIAS:
- Reconstrua momentos decisivos com sensibilidade histórica, detalhes de época e profundidade emocional.
- Mostre vulnerabilidade, conflitos íntimos e as lições universais extraídas das vivências.
- Evite tom puramente laudatório; traga humanidade e contradições reais.`,
  },
  {
    id: 'infantil_juvenil',
    label: 'Infantil & Infanto-Juvenil',
    description: 'Linguagem lúdica, engajante, ritmo dinâmico e lições de vida acessíveis.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO INFANTIL & JUVENIL:
- Use vocabulário vibrante, imagens mentais marcantes e ritmo ágil adequado à faixa etária.
- Construa personagens cativantes com desejos claros e desafios entusiasmantes.
- Transmita valores de empatia, coragem e curiosidade de forma natural na trama.`,
  },
  {
    id: 'filosofia_espiritualidade',
    label: 'Filosofia, Espiritualidade & Sabedoria',
    description: 'Contemplação profunda, busca por significado, serenidade e iluminação.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO FILOSOFIA & ESPIRITUALIDADE:
- Escreva com cadência pausada, vocabulário nobre e elegância meditativa.
- Explore dilemas existenciais, sabedoria ancestral e conexão com o propósito humano.
- Proporcione momentos de pausa reflexiva e autoconhecimento.`,
  },
  {
    id: 'saude_bem_estar',
    label: 'Saúde, Nutrição & Bem-Estar',
    description: 'Ciência do corpo, longevidade, equilíbrio mental e hábitos saudáveis.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO SAÚDE & BEM-ESTAR:
- Combine embasamento em neurociência e medicina do estilo de vida com orientações acolhedoras.
- Desmistifique mitos de saúde e entregue protocolos simples de hábitos sustentáveis.
- Incentive o autocuidado consciente sem abordagens alarmistas.`,
  },
  {
    id: 'historia_sociedade',
    label: 'História, Política & Sociedade',
    description: 'Análise de conjuntura, eventos marcantes, movimentos sociais e impacto cultural.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO HISTÓRIA & SOCIEDADE:
- Ofereça visão panorâmica rigorosa relacionando causas, desdobramentos e legados contemporâneos.
- Dê voz a múltiplos atores sociais e analise forças econômicas e culturais em jogo.`,
  },
  {
    id: 'financas_investimentos',
    label: 'Finanças Pessoais & Investimentos',
    description: 'Educação financeira, gestão de risco, patrimônio e liberdade de escolha.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO FINANÇAS & INVESTIMENTOS:
- Desmistifique termos financeiros complexos com analogias claras do dia a dia.
- Foque em disciplina de aportes, controle de riscos, mentalidade de longo prazo e independência.`,
  },
  {
    id: 'psicologia_mente',
    label: 'Psicologia, Neurociência & Comportamento',
    description: 'Compreensão do cérebro, relações humanas, emoções e padrões cognitivos.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO PSICOLOGIA & NEUROCIÊNCIA:
- Explique o funcionamento do sistema nervoso e vieses cognitivos de forma fascinante.
- Relacione descobertas científicas recentes com situações emocionais do cotidiano.`,
  },
  {
    id: 'misterio_thriller',
    label: 'Mistério, Suspense & Policial',
    description: 'Tensão psicológica, reviravoltas, pistas enigmáticas e ritmo vertiginoso.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO MISTÉRIO & THRILLER:
- Construa atmosfera de constante apreensão, jogo de pistas e suspeitas cruzadas.
- Encerre seções com 'cliffhangers' irresistíveis que mantenham a leitura compulsiva.`,
  },
  {
    id: 'fantasia_sci_fi',
    label: 'Fantasia & Ficção Científica (Worldbuilding)',
    description: 'Construção de mundos épicos, sistemas de magia/tecnologia e mitologia própria.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO FANTASIA & SCI-FI:
- Desenvolva regramentos internos consistentes para a tecnologia ou magia do universo.
- Integre o 'worldbuilding' organicamente na rotina e decisões dos personagens sem exposições massivas.`,
  },
  {
    id: 'poesia_cronicas',
    label: 'Poesia, Crônicas & Prosa Poética',
    description: 'Sensibilidade lírica, ritmo verbal, metáforas marcantes e olhar sobre o cotidiano.',
    agentSystemPrompt: `DIRETRIZ DE AGENTE - ESTILO POESIA & CRÔNICAS:
- Destaque a sonoridade das palavras, a beleza das pausas e imagens poéticas surpreendentes.
- Eleve pequenos detalhes da vida comum a reflexões profundas sobre a condição humana.`,
  },
];

export const WRITING_TONES_OPTIONS: ToneOption[] = [
  {
    id: 'didatico_inspirador',
    label: 'Didático & Inspirador (Encorajador e Claro)',
    description: 'Explica com clareza enquanto eleva a motivação e a confiança do leitor.',
    agentSystemPrompt: 'TOM DE ESCRITA: Transmita entusiasmo contagiante e autoridade acolhedora. Simplifique o complexo e encoraje a ação.',
  },
  {
    id: 'analitico_rigoroso',
    label: 'Analítico, Acadêmico & Rigoroso',
    description: 'Linguagem precisa, estrutura lógica impecável e fundamentação técnica.',
    agentSystemPrompt: 'TOM DE ESCRITA: Mantenha postura objetiva, vocabulário refinado e encadeamento lógico irrefutável.',
  },
  {
    id: 'conversacional',
    label: 'Conversacional, Próximo & Acolhedor',
    description: 'Como uma conversa intimista entre velhos amigos com sabedoria.',
    agentSystemPrompt: 'TOM DE ESCRITA: Use linguagem direta no ' + 'você' + ', tom caloroso, empático e extremamente acessível.',
  },
  {
    id: 'poetico_sensivel',
    label: 'Poético, Sensível & Evocativo',
    description: 'Prosa rica em lirismo, sonoridade e imagens evocativas.',
    agentSystemPrompt: 'TOM DE ESCRITA: Explore metáforas delicadas, ritmo cadenciado e profundidade emocional.',
  },
  {
    id: 'dramatico',
    label: 'Dramático, Intenso & Cinematográfico',
    description: 'Focado em tensão, fortes emoções e alto contraste visual.',
    agentSystemPrompt: 'TOM DE ESCRITA: Destaque o conflito, a urgência e a intensidade dramática das cenas e temas.',
  },
  {
    id: 'persuasivo_vendedor',
    label: 'Persuasivo, Motivacional & Direto',
    description: 'Voltado a quebrar objeções e engajar o leitor para decisões imediatas.',
    agentSystemPrompt: 'TOM DE ESCRITA: Use gatilhos mentais de urgência, contraste, valor e convicção absoluta.',
  },
  {
    id: 'jornalistico',
    label: 'Jornalístico, Investigativo & Objetivo',
    description: 'Foco nos fatos, dados, múltiplas perspectivas e imparcialidade.',
    agentSystemPrompt: 'TOM DE ESCRITA: Apresente fatos com clareza cristalina, dinamismo, objetividade e precisão factual.',
  },
  {
    id: 'provocativo_provocante',
    label: 'Provocativo, Questionador & Desafiador',
    description: 'Desafia o senso comum e obriga o leitor a repensar suas certezas.',
    agentSystemPrompt: 'TOM DE ESCRITA: Questionador, audacioso, provocando desconforto produtivo e reflexão profunda.',
  },
  {
    id: 'humoristico_satirico',
    label: 'Leve, Bem-Humorado & Irônico',
    description: 'Usa a ironia elegante e o humor para tornar a leitura fluida e envolvente.',
    agentSystemPrompt: 'TOM DE ESCRITA: Inteligente, bem-humorado, leve, usando observações sagazes do cotidiano.',
  },
  {
    id: 'sombrio_misterioso',
    label: 'Sombrio, Atmosférico & Enigmático',
    description: 'Clima denso, mistério e exploração das sombras.',
    agentSystemPrompt: 'TOM DE ESCRITA: Atmosférico, misterioso, despertando curiosidade e fascínio pelo desconhecido.',
  },
];

export function getStylePrompt(styleId: BookStyle): string {
  const found = BOOK_STYLES_OPTIONS.find((s) => s.id === styleId);
  return found ? found.agentSystemPrompt : 'Estilo livre e equilibrado.';
}

export function getTonePrompt(toneId: WritingTone): string {
  const found = WRITING_TONES_OPTIONS.find((t) => t.id === toneId);
  return found ? found.agentSystemPrompt : 'Tom claro e agradável.';
}
