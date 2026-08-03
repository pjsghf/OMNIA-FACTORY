import React, { useState } from 'react';
import {
  Globe,
  Languages,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { BookProject, AiConfig } from '../types';
import {
  TARGET_LANGUAGES,
  translateFullBook,
  TranslationProgressUpdate,
} from '../lib/ai/translation/translatorService';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: BookProject;
  aiConfig: AiConfig;
  onTranslationComplete: (translatedProject: BookProject, saveMode: 'new_project' | 'replace_current') => void;
}

export const TranslationModal: React.FC<TranslationModalProps> = ({
  isOpen,
  onClose,
  project,
  aiConfig,
  onTranslationComplete,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Inglês (EUA)');
  const [customLanguage, setCustomLanguage] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'new_project' | 'replace_current'>('new_project');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [translatedResult, setTranslatedResult] = useState<BookProject | null>(null);

  if (!isOpen) return null;

  const targetLangName = isCustom ? customLanguage.trim() : selectedLanguage;

  const handleStartTranslation = async () => {
    if (!targetLangName) {
      setError('Por favor, especifique o idioma de destino.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgressLog([`Iniciando tradução e localização cultural para ${targetLangName}...`]);
    setCurrentProgress(5);

    try {
      const result = await translateFullBook(
        project,
        targetLangName,
        aiConfig,
        (update: TranslationProgressUpdate) => {
          if (update.stage === 'error') {
            setError(update.error || 'Ocorreu um erro durante a tradução.');
          } else {
            setProgressLog((prev) => [...prev, update.message]);
            if (update.stage === 'initializing') setCurrentProgress(10);
            if (update.stage === 'metadata') setCurrentProgress(25);
            if (update.stage === 'front_matter') setCurrentProgress(40);
            if (update.stage === 'chapter') setCurrentProgress(65);
            if (update.stage === 'cover') setCurrentProgress(85);
            if (update.stage === 'completed') setCurrentProgress(100);
          }
        }
      );

      setTranslatedResult(result);
      setCurrentProgress(100);
    } catch (err: any) {
      console.error('Translation error:', err);
      setError(err.message || 'Falha ao executar a tradução do e-book.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAndOpen = () => {
    if (translatedResult) {
      onTranslationComplete(translatedResult, saveMode);
      onClose();
    }
  };

  const totalWords = project.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-[#FDFCFB] border border-[#E7E5E4] w-full max-w-2xl rounded-sm shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-[#1C1917] text-white p-6 flex items-center justify-between border-b border-[#292524]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-sm border border-amber-500/30">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-lg font-bold tracking-tight text-white">
                  Tradutor e Localizador Cultural
                </h3>
                <span className="text-[10px] uppercase font-mono tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-xs">
                  IA Literária
                </span>
              </div>
              <p className="text-xs text-[#A8A29E] mt-0.5 font-sans">
                Tradução adaptativa de expressões, gírias e narrativa com capa no idioma gerado.
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="text-[#A8A29E] hover:text-white transition p-1.5 rounded-sm hover:bg-[#292524]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-sm text-xs flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Erro de Processamento</p>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {translatedResult ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-center space-x-3 text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">Localização Cultural Concluída!</h4>
                  <p className="text-xs text-emerald-700">
                    Sua nova edição em <strong className="underline">{translatedResult.metadata.idioma}</strong> foi
                    criada e uma capa oficial no idioma foi gerada com sucesso.
                  </p>
                </div>
              </div>

              {/* Translated Book Summary Card */}
              <div className="p-5 bg-white border border-[#E7E5E4] rounded-sm grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                <div className="aspect-3/4 bg-[#F5F5F4] border border-[#E7E5E4] rounded-sm overflow-hidden flex items-center justify-center shadow-md relative group">
                  {translatedResult.metadata.coverImageUrl ? (
                    <img
                      src={translatedResult.metadata.coverImageUrl}
                      alt={translatedResult.metadata.titulo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="p-4 text-center text-[#78716C]">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <span className="text-[10px] uppercase font-mono">Capa Gerada</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-xs uppercase">
                    {translatedResult.metadata.idioma}
                  </span>
                </div>

                <div className="sm:col-span-2 space-y-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-[#78716C] font-semibold">
                      Título Localizado
                    </span>
                    <h4 className="font-serif text-lg font-bold text-[#1C1917] leading-snug">
                      {translatedResult.metadata.titulo}
                    </h4>
                    {translatedResult.metadata.subtitulo && (
                      <p className="text-xs text-[#57534E] italic mt-0.5">
                        {translatedResult.metadata.subtitulo}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#F5F5F4] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[#A8A29E] block uppercase font-mono">
                        Idioma
                      </span>
                      <span className="font-semibold text-[#1C1917]">
                        {translatedResult.metadata.idioma}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A8A29E] block uppercase font-mono">
                        Capítulos
                      </span>
                      <span className="font-semibold text-[#1C1917]">
                        {translatedResult.chapters.length} Capítulos
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#78716C] line-clamp-3 bg-[#FDFCFB] p-2.5 border border-[#F5F5F4] italic">
                    "{translatedResult.metadata.resumo}"
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E7E5E4]">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#57534E] bg-[#F5F5F4] hover:bg-[#E7E5E4] border border-[#D6D3D1] rounded-sm transition uppercase tracking-wider"
                >
                  Fechar
                </button>
                <button
                  onClick={handleConfirmAndOpen}
                  className="flex items-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1C1917] hover:bg-[#44403C] rounded-sm shadow-md transition uppercase tracking-widest"
                >
                  <span>
                    {saveMode === 'new_project' ? 'Abrir Novo E-book Traduzido' : 'Aplicar Alterações'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : isProcessing ? (
            /* PROCESSING STATE */
            <div className="py-8 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <Loader2 className="w-16 h-16 text-amber-600 animate-spin" />
                <Globe className="w-7 h-7 text-[#1C1917] absolute" />
              </div>

              <div className="space-y-2">
                <h4 className="font-serif text-lg font-bold text-[#1C1917]">
                  Processando Localização Literária...
                </h4>
                <p className="text-xs text-[#78716C] max-w-md mx-auto">
                  Adaptando expressões idiomáticas, tom narrativo e gerando capa no idioma{' '}
                  <strong className="text-[#1C1917]">{targetLangName}</strong>.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#E7E5E4] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${currentProgress}%` }}
                />
              </div>

              {/* Progress Log Console */}
              <div className="bg-[#1C1917] text-amber-200/90 font-mono text-[11px] p-4 rounded-sm text-left h-36 overflow-y-auto space-y-1.5 border border-[#292524] shadow-inner">
                {progressLog.map((log, index) => (
                  <p key={index} className="flex items-start space-x-2">
                    <span className="text-amber-500 select-none">&gt;</span>
                    <span>{log}</span>
                  </p>
                ))}
              </div>
            </div>
          ) : (
            /* CONFIGURATION FORM STATE */
            <div className="space-y-6">
              {/* Target Language Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1C1917] flex items-center space-x-1.5">
                  <Languages className="w-4 h-4 text-amber-600" />
                  <span>1. Selecione o Idioma de Destino</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TARGET_LANGUAGES.map((lang) => {
                    const isSelected = !isCustom && selectedLanguage === lang.name;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setIsCustom(false);
                          setSelectedLanguage(lang.name);
                        }}
                        className={`flex items-center space-x-2 p-2.5 text-xs text-left border rounded-sm transition ${
                          isSelected
                            ? 'border-[#1C1917] bg-[#1C1917] text-white font-semibold shadow-xs'
                            : 'border-[#E7E5E4] bg-white text-[#44403C] hover:bg-[#F5F5F4]'
                        }`}
                      >
                        <span className="text-base">{lang.flag}</span>
                        <span className="truncate">{lang.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Language Toggle */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCustom(!isCustom)}
                    className="text-xs text-amber-700 hover:text-amber-900 font-medium underline flex items-center space-x-1"
                  >
                    <span>{isCustom ? '← Escolher da lista' : '+ Outro idioma personalizado'}</span>
                  </button>

                  {isCustom && (
                    <input
                      type="text"
                      value={customLanguage}
                      onChange={(e) => setCustomLanguage(e.target.value)}
                      placeholder="Ex: Mandarim Tradicional, Esperanto, Norueguês, Swahili..."
                      className="mt-2 w-full p-2.5 text-xs border border-[#D6D3D1] rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1C1917]"
                    />
                  )}
                </div>
              </div>

              {/* Save Options */}
              <div className="space-y-2 pt-2 border-t border-[#E7E5E4]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1C1917] flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-[#78716C]" />
                  <span>2. Modo de Salvamento</span>
                </label>

                <div className="space-y-2">
                  <label className="flex items-start space-x-3 p-3 border border-[#E7E5E4] bg-white rounded-sm cursor-pointer hover:bg-[#F5F5F4] transition">
                    <input
                      type="radio"
                      name="saveMode"
                      value="new_project"
                      checked={saveMode === 'new_project'}
                      onChange={() => setSaveMode('new_project')}
                      className="mt-0.5 text-[#1C1917] focus:ring-[#1C1917]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#1C1917]">
                        Criar Nova Edição Localizada (Recomendado)
                      </p>
                      <p className="text-[11px] text-[#78716C]">
                        Gera um novo e-book na sua biblioteca preservando o livro original em Português.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 border border-[#E7E5E4] bg-white rounded-sm cursor-pointer hover:bg-[#F5F5F4] transition">
                    <input
                      type="radio"
                      name="saveMode"
                      value="replace_current"
                      checked={saveMode === 'replace_current'}
                      onChange={() => setSaveMode('replace_current')}
                      className="mt-0.5 text-[#1C1917] focus:ring-[#1C1917]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#1C1917]">Substituir E-book Atual</p>
                      <p className="text-[11px] text-[#78716C]">
                        Atualiza o projeto ativo com a versão traduzida e substitui a capa atual.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-[#F5F5F4] border border-[#E7E5E4] rounded-sm text-xs space-y-2 text-[#57534E]">
                <div className="flex items-center space-x-2 font-bold text-[#1C1917]">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Resumo do Processo de Localização</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#78716C]">
                  <li>
                    <strong>Prosa Adaptativa:</strong> Tradução fluida sem literalismos, adaptando
                    gírias e tom para leitores nativos de <em>{targetLangName}</em>.
                  </li>
                  <li>
                    <strong>Escopo Completo:</strong> Metadados, Capítulos ({project.chapters.length}),
                    Prefácio, Introdução e Pós-fácio (~{totalWords.toLocaleString('pt-BR')} palavras).
                  </li>
                  <li>
                    <strong>Nova Capa Exclusiva:</strong> Redesenho da capa com título e conceito em{' '}
                    <em>{targetLangName}</em>.
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#57534E] bg-[#F5F5F4] hover:bg-[#E7E5E4] border border-[#D6D3D1] rounded-sm transition uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleStartTranslation}
                  className="flex items-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1C1917] hover:bg-[#44403C] rounded-sm shadow-md transition uppercase tracking-widest"
                >
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>Iniciar Tradução do E-book</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
