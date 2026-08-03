import { BookProject, AiConfig } from '../../../types';

export const SYSTEM_PROMPT_TRANSLATION =
  'Você é um tradutor e especialista em localização literária. Sua função é traduzir e adaptar culturalmente o e-book enviado para o idioma de destino especificado. Adapte gírias, metáforas e expressões idiomáticas de forma natural para leitores nativos. Mantenha o tom e o estilo original do autor. Retorne APENAS o texto adaptado em prosa limpa, sem saudações, introduções, notas ou explicações.';

export function buildUserPromptTranslation(targetLanguage: string, originalText: string): string {
  return `Idioma de Destino: ${targetLanguage}\n\nTexto Original:\n${originalText}`;
}

export interface TranslationLanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const TARGET_LANGUAGES: TranslationLanguageOption[] = [
  { code: 'en-US', name: 'Inglês (EUA)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'Inglês (Reino Unido)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Espanhol (Espanha)', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Espanhol (América Latina)', flag: '🇲🇽' },
  { code: 'fr-FR', name: 'Francês', flag: '🇫🇷' },
  { code: 'de-DE', name: 'Alemão', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-PT', name: 'Português (Portugal)', flag: '🇵🇹' },
  { code: 'ja-JP', name: 'Japonês', flag: '🇯🇵' },
  { code: 'zh-CN', name: 'Chinês Mandarim', flag: '🇨🇳' },
  { code: 'ru-RU', name: 'Russo', flag: '🇷🇺' },
  { code: 'nl-NL', name: 'Holandês', flag: '🇳🇱' },
  { code: 'ko-KR', name: 'Coreano', flag: '🇰🇷' },
  { code: 'ar-SA', name: 'Árabe', flag: '🇸🇦' },
];

export interface TranslationProgressUpdate {
  stage: 'initializing' | 'metadata' | 'front_matter' | 'chapter' | 'end_matter' | 'cover' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  message: string;
  chapterTitle?: string;
  translatedProject?: BookProject;
  error?: string;
}

/**
 * Executes a section translation request against backend /api/editorial/translate-section endpoint
 */
export async function translateTextSnippet(
  originalText: string,
  targetLanguage: string,
  aiConfig?: AiConfig
): Promise<string> {
  if (!originalText || !originalText.trim()) return '';

  const response = await fetch('/api/editorial/translate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: originalText,
      targetLanguage,
      aiConfig,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Erro HTTP ${response.status} na tradução.`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Falha na tradução da seção.');
  }

  return data.translatedText || '';
}

/**
 * Triggers full e-book translation and cultural localization pipeline on backend
 */
export async function translateFullBook(
  project: BookProject,
  targetLanguage: string,
  aiConfig?: AiConfig,
  onProgress?: (update: TranslationProgressUpdate) => void
): Promise<BookProject> {
  if (!project) {
    throw new Error('Nenhum projeto de e-book foi selecionado para tradução.');
  }

  if (!targetLanguage || !targetLanguage.trim()) {
    throw new Error('Por favor, selecione um idioma de destino válido.');
  }

  onProgress?.({
    stage: 'initializing',
    currentStep: 0,
    totalSteps: 100,
    message: `Iniciando localização cultural para ${targetLanguage}...`,
  });

  const response = await fetch('/api/editorial/translate-book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      targetLanguage,
      aiConfig,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errorMsg = errData.error || `Erro HTTP ${response.status} na tradução do e-book.`;
    onProgress?.({
      stage: 'error',
      currentStep: 0,
      totalSteps: 100,
      message: errorMsg,
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data.success || !data.translatedProject) {
    const errorMsg = data.error || 'Falha ao processar e-book traduzido.';
    onProgress?.({
      stage: 'error',
      currentStep: 0,
      totalSteps: 100,
      message: errorMsg,
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  onProgress?.({
    stage: 'completed',
    currentStep: 100,
    totalSteps: 100,
    message: `E-book localizado com sucesso para ${targetLanguage}! Nova capa gerada.`,
    translatedProject: data.translatedProject,
  });

  return data.translatedProject;
}
