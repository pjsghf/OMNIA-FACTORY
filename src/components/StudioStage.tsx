import React, { useState } from 'react';
import { BookProject, ChapterContent } from '../types';
import {
  BookOpen,
  Edit3,
  Sparkles,
  Wand2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Eye,
  Maximize2,
  Columns,
} from 'lucide-react';
import { cleanChapterProse } from '../lib/rendering/cleanChapterProse';

interface StudioStageProps {
  project: BookProject;
  onUpdateChapterContent: (chapterIndex: number, content: string) => void;
  onGenerateChapter: (index: number) => Promise<void>;
  onGenerateBatchChapters?: () => Promise<void>;
  onRunAiAssist: (text: string, action: string, chapterIndex?: number) => Promise<void>;
  isGeneratingIndex: number | null;
  isGeneratingBatch?: boolean;
  onProceedToReview: () => void;
  onProceedToExport: () => void;
}

export const StudioStage: React.FC<StudioStageProps> = ({
  project,
  onUpdateChapterContent,
  onGenerateChapter,
  onGenerateBatchChapters,
  onRunAiAssist,
  isGeneratingIndex,
  isGeneratingBatch,
  onProceedToReview,
  onProceedToExport,
}) => {
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(true);
  const [aiCustomInstruction, setAiCustomInstruction] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const chapters = project.chapters || [];
  const currentChapter: ChapterContent | undefined = chapters[selectedChapterIndex];

  const handleCopyChapter = () => {
    if (!currentChapter?.content) return;
    navigator.clipboard.writeText(currentChapter.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-[#FDFCFB] border border-[#E7E5E4] rounded-sm shadow-xs overflow-hidden font-sans">
      {/* Studio Header Toolbar */}
      <div className="bg-[#F5F5F4] border-b border-[#E7E5E4] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-[#1C1917] text-white flex items-center justify-center font-serif italic text-sm font-bold">
            O
          </div>
          <div>
            <h2 className="font-serif font-bold text-sm text-[#1C1917] truncate">
              {project.metadata.titulo || 'Estúdio Centralizado OMNIA'}
            </h2>
            <p className="text-[11px] text-[#78716C] font-serif italic">
              {project.metadata.autor} • {chapters.length} Capítulos
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onGenerateBatchChapters && (
            <button
              onClick={onGenerateBatchChapters}
              disabled={isGeneratingBatch}
              className="px-3 py-1.5 bg-[#1C1917] hover:bg-[#44403C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition rounded-sm flex items-center space-x-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isGeneratingBatch ? 'Escrevendo Lote...' : 'Escrever Todos os Capítulos'}
              </span>
            </button>
          )}

          <button
            onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border transition flex items-center space-x-1.5 rounded-sm ${
              isAiPanelOpen
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-white border-[#D6D3D1] text-[#1C1917] hover:bg-[#F5F5F4]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>Assistente IA</span>
          </button>

          <button
            onClick={onProceedToExport}
            className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-500 font-extrabold text-xs uppercase tracking-wider transition shadow-xs"
          >
            <span>Exportar E-book / PDF →</span>
          </button>
        </div>
      </div>

      {/* 3-Column Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Left Table of Contents & Navigation */}
        <div className="w-64 border-r border-[#E7E5E4] bg-[#FDFCFB] flex flex-col shrink-0">
          <div className="p-3 border-b border-[#E7E5E4] bg-[#F5F5F4] flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-[#78716C]">
              Sumário da Obra
            </span>
            <span className="text-[10px] text-[#78716C] font-mono">
              {chapters.filter((c) => c.status === 'completed').length}/{chapters.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chapters.map((cap, idx) => {
              const isSelected = idx === selectedChapterIndex;
              const isDone = cap.status === 'completed' || (cap.content && cap.content.length > 50);
              const isGenerating = isGeneratingIndex === idx;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedChapterIndex(idx)}
                  className={`w-full text-left p-2.5 transition rounded-sm border flex items-start space-x-2.5 ${
                    isSelected
                      ? 'border-[#1C1917] bg-amber-50/60 shadow-xs'
                      : 'border-transparent hover:bg-[#F5F5F4]'
                  }`}
                >
                  <span className="text-xs font-mono font-bold text-[#78716C] shrink-0 mt-0.5">
                    {cap.numero || idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-serif font-bold text-[#1C1917] truncate">
                      {cap.titulo}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-[#78716C]">
                      <span>{cap.wordCount || 0} pal.</span>
                      {isGenerating ? (
                        <span className="text-amber-700 font-bold flex items-center space-x-1">
                          <Wand2 className="w-3 h-3 animate-spin" />
                          <span>Escrevendo</span>
                        </span>
                      ) : isDone ? (
                        <span className="text-emerald-700 font-semibold flex items-center space-x-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Pronto</span>
                        </span>
                      ) : (
                        <span className="text-stone-400">Pendente</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Center Live Editor & Reader */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {currentChapter ? (
            <>
              {/* Chapter Header Bar */}
              <div className="px-6 py-3 border-b border-[#E7E5E4] bg-[#FDFCFB] flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#1C1917]">
                    Capítulo {currentChapter.numero}: {currentChapter.titulo}
                  </h3>
                  {currentChapter.subtitulo && (
                    <p className="text-xs text-[#78716C] font-serif italic">
                      {currentChapter.subtitulo}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyChapter}
                    className="px-2.5 py-1 text-xs border border-[#D6D3D1] hover:bg-[#F5F5F4] text-[#1C1917] transition flex items-center space-x-1 rounded-sm"
                    title="Copiar Texto do Capítulo"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  <button
                    onClick={() => onGenerateChapter(selectedChapterIndex)}
                    disabled={isGeneratingIndex === selectedChapterIndex}
                    className="px-3 py-1 bg-[#1C1917] hover:bg-[#44403C] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition flex items-center space-x-1.5 rounded-sm"
                  >
                    {isGeneratingIndex === selectedChapterIndex ? (
                      <>
                        <Wand2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Redigindo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Gerar / Re-escrever com IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Text Area Editor */}
              <div className="flex-1 p-6 overflow-y-auto bg-[#FDFCFB]">
                <textarea
                  value={currentChapter.content || ''}
                  onChange={(e) => onUpdateChapterContent(selectedChapterIndex, e.target.value)}
                  placeholder="O texto do capítulo aparecerá aqui. Você pode digitar diretamente ou usar o botão 'Gerar com IA'..."
                  className="w-full h-full min-h-[400px] p-4 bg-white border border-[#E7E5E4] focus:border-[#1C1917] focus:outline-none font-serif text-sm leading-relaxed text-[#1C1917] resize-none shadow-xs"
                />
              </div>

              {/* Status Footer */}
              <div className="px-6 py-2 border-t border-[#E7E5E4] bg-[#F5F5F4] text-xs text-[#78716C] flex items-center justify-between font-mono">
                <span>
                  Palavras:{' '}
                  <strong>
                    {currentChapter.content
                      ? cleanChapterProse(currentChapter.content).split(/\s+/).filter(Boolean)
                          .length
                      : 0}
                  </strong>
                </span>
                <span>Salvo automaticamente (IndexedDB)</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#78716C]">
              <BookOpen className="w-12 h-12 text-stone-300 mb-3" />
              <p className="font-serif text-base font-bold text-[#1C1917]">
                Nenhum capítulo selecionado
              </p>
              <p className="text-xs">
                Selecione um capítulo no sumário à esquerda para começar a redigir.
              </p>
            </div>
          )}
        </div>

        {/* Column 3: Right Retractable AI Assistant */}
        {isAiPanelOpen && (
          <div className="w-80 border-l border-[#E7E5E4] bg-[#FDFCFB] flex flex-col shrink-0">
            <div className="p-3 border-b border-[#E7E5E4] bg-[#F5F5F4] flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-serif font-bold text-xs text-[#1C1917]">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Assistente Editorial IA</span>
              </div>
              <button
                onClick={() => setIsAiPanelOpen(false)}
                className="text-[#78716C] hover:text-[#1C1917] text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-serif font-bold text-[#1C1917] mb-1">
                  Ações Rápidas de IA
                </label>
                <div className="space-y-1.5">
                  <button
                    onClick={() =>
                      onRunAiAssist(currentChapter?.content || '', 'expandir', selectedChapterIndex)
                    }
                    disabled={!currentChapter?.content}
                    className="w-full py-2 px-3 bg-white hover:bg-stone-50 border border-[#D6D3D1] text-[#1C1917] font-semibold text-left transition rounded-sm flex items-center justify-between"
                  >
                    <span>✨ Expandir e Aprofundar Trecho</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
                  </button>

                  <button
                    onClick={() =>
                      onRunAiAssist(
                        currentChapter?.content || '',
                        'melhorar_tom',
                        selectedChapterIndex
                      )
                    }
                    disabled={!currentChapter?.content}
                    className="w-full py-2 px-3 bg-white hover:bg-stone-50 border border-[#D6D3D1] text-[#1C1917] font-semibold text-left transition rounded-sm flex items-center justify-between"
                  >
                    <span>✍️ Refinar Fluência e Tom</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
                  </button>

                  <button
                    onClick={() =>
                      onRunAiAssist(
                        currentChapter?.content || '',
                        'corrigir_erros',
                        selectedChapterIndex
                      )
                    }
                    disabled={!currentChapter?.content}
                    className="w-full py-2 px-3 bg-white hover:bg-stone-50 border border-[#D6D3D1] text-[#1C1917] font-semibold text-left transition rounded-sm flex items-center justify-between"
                  >
                    <span>🔍 Corrigir Ortografia e Estilo</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E7E5E4]">
                <label className="block font-serif font-bold text-[#1C1917] mb-1">
                  Instrução Personalizada
                </label>
                <textarea
                  rows={3}
                  value={aiCustomInstruction}
                  onChange={(e) => setAiCustomInstruction(e.target.value)}
                  placeholder="Ex: Reescreva com um tom mais persuasivo e adicione um exemplo prático..."
                  className="w-full p-2 bg-white border border-[#D6D3D1] focus:border-[#1C1917] focus:outline-none text-xs font-serif text-[#1C1917]"
                />
                <button
                  onClick={() => {
                    if (!aiCustomInstruction.trim()) return;
                    onRunAiAssist(
                      currentChapter?.content || '',
                      `custom:${aiCustomInstruction}`,
                      selectedChapterIndex
                    );
                  }}
                  disabled={!aiCustomInstruction.trim() || !currentChapter?.content}
                  className="mt-2 w-full py-2 bg-[#1C1917] hover:bg-[#44403C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition rounded-sm"
                >
                  Executar Instrução
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
