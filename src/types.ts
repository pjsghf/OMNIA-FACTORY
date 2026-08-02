export type BookStyle =
  | 'desenvolvimento_pessoal'
  | 'nao_ficcao'
  | 'ficcao'
  | 'negocios_estrategia'
  | 'tecnico_educacional'
  | 'biografia_memorias'
  | 'infantil_juvenil'
  | 'filosofia_espiritualidade'
  | 'saude_bem_estar'
  | 'historia_sociedade'
  | 'financas_investimentos'
  | 'psicologia_mente'
  | 'misterio_thriller'
  | 'fantasia_sci_fi'
  | 'poesia_cronicas'
  | (string & {});

export type WritingTone =
  | 'didatico_inspirador'
  | 'analitico_rigoroso'
  | 'conversacional'
  | 'poetico_sensivel'
  | 'dramatico'
  | 'persuasivo_vendedor'
  | 'jornalistico'
  | 'provocativo_provocante'
  | 'humoristico_satirico'
  | 'sombrio_misterioso'
  | (string & {});

export interface BookMetadata {
  titulo: string;
  subtitulo: string;
  autor: string;
  editora?: string;
  idioma: string;
  publicoAlvo: string;
  resumo: string;
  estilo: BookStyle;
  promptEstilo: string;
  tom: WritingTone;
  qtdCapitulos: number;
  minPalavras: number;
  maxPalavras: number;
  materiais: string;
  informacoesObrigatorias: string;
  restricoes: string;
  coverImageUrl?: string;
}

export interface ReaderProfile {
  descricao: string;
  doresEAnseios: string[];
  oQueBuscaraNoLivro: string[];
}

export interface ChapterPlan {
  numero: number;
  titulo: string;
  subtitulo?: string;
  objetivo: string;
  topicos: string[];
  subtopicos?: string[];
  estimativaPalavras: number;
}

export interface EditorialPlan {
  conceitoCentral: string;
  promessaPrincipal: string;
  perfilLeitor: ReaderProfile;
  sumario: ChapterPlan[];
}

export interface ChapterContent {
  numero: number;
  titulo: string;
  subtitulo?: string;
  content: string;
  wordCount: number;
  status: 'pending' | 'generating' | 'completed' | 'edited';
  notes?: string;
}

export interface FrontMatter {
  folhaDeRostoTitle?: string;
  direitosAutorais?: string;
  apresentacao?: string;
  introducao?: string;
}

export interface EndMatter {
  conclusao?: string;
  exercicios?: string;
  referencias?: string;
  agradecimentos?: string;
  sobreAutor?: string;
}

export interface ChapterVersionItem {
  id: string;
  chapterNumber: number;
  versionNumber: number;
  createdAt: string;
  author: 'ia' | 'user' | 'review_patch';
  label?: string;
  content: string;
  wordCount: number;
}

export interface SelectedRange {
  itemId: string;
  versionId: string;
  start: number;
  end: number;
  original: string;
}

export interface ReviewFinding {
  id: string;
  unitId: string;
  unitTitle: string;
  versionId: string;
  start?: number;
  end?: number;
  snippet?: string;
  tipo: 'estrutural' | 'linguistica' | 'continuidade' | 'factual' | 'sensibilidade' | 'conformidade';
  severidade: 'Alta' | 'Média' | 'Baixa';
  descricao: string;
  sugestaoDeCorrecao: string;
  status: 'pending' | 'applied' | 'rejected';
}

export interface ReviewModalityScore {
  categoria: 'estrutural' | 'linguistica' | 'continuidade' | 'factual' | 'sensibilidade' | 'conformidade';
  nota: number;
  resumo: string;
}

export interface EditorialReport {
  id: string;
  createdAt: string;
  projectVersionHash: string;
  notaGeral: number;
  resumoAvaliatorio: string;
  modalidades: ReviewModalityScore[];
  pontosFortes: string[];
  problemasDetectados: ReviewFinding[];
  sugestoesGlobais: string[];
  coberturaTotalUnidadesPercent: number;
  obsoleto?: boolean;
}

export type EditorialStage = 'config' | 'planning' | 'writing' | 'review' | 'design_export';

export interface BookProject {
  id: string;
  createdAt: string;
  updatedAt: string;
  metadata: BookMetadata;
  plan: EditorialPlan | null;
  chapters: ChapterContent[];
  frontMatter: FrontMatter;
  endMatter: EndMatter;
  editorialReport: EditorialReport | null;
  chapterVersions?: Record<number, ChapterVersionItem[]>;
  projectVersionHash?: string;
  currentStage: EditorialStage;
  trash?: boolean;
}

export interface AiConfig {
  provider: 'gemini' | 'opencode';
  geminiModel?: string;
  opencodeApiKey?: string;
  opencodeBaseUrl?: string;
  opencodeModel?: string;
}

export interface ProjectPreset {
  id: string;
  name: string;
  description: string;
  metadata: Partial<BookMetadata>;
}
