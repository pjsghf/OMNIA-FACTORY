import React, { useState } from 'react';
import { BookMetadata, EditorialPlan, ChapterContent, FrontMatter, EndMatter } from '../types';
import {
  FileText,
  Wand2,
  Play,
  CheckCircle,
  Clock,
  Sparkles,
  Edit2,
  Eye,
  Columns,
  Maximize2,
  Scissors,
  Zap,
  BookOpen,
  Feather,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Layers,
} from 'lucide-react';

export type MatterType =
  'apresentacao' | 'introducao' | 'conclusao' | 'agradecimentos' | 'sobreAutor' | 'exercicios';

export type SelectedItem =
  { kind: 'chapter'; index: number } | { kind: 'matter'; type: MatterType };

interface WritingStageProps {
  metadata: BookMetadata;
  plan: EditorialPlan;
  chapters: ChapterContent[];
  frontMatter: FrontMatter;
  endMatter: EndMatter;
  onUpdateChapter: (index: number, content: string, status?: ChapterContent['status']) => void;
  onUpdateFrontOrEndMatter: (type: MatterType, content: string) => void;
  onGenerateChapter: (index: number) => Promise<boolean>;
  onGenerateBatchChapters: () => Promise<void>;
  onGenerateFrontOrEndMatter: (type: MatterType) => Promise<boolean>;
  onGenerateBatchFrontAndEndMatter: () => Promise<void>;
  onOpenAiAssist: (text: string, actionName: string) => void;
  isGeneratingBatch: boolean;
  isGeneratingFrontEndBatch: boolean;
  generatingIndex: number | null;
}

export const WritingStage: React.FC<WritingStageProps> = ({
  metadata,
  plan,
  chapters,
  frontMatter,
  endMatter,
  onUpdateChapter,
  onUpdateFrontOrEndMatter,
  onGenerateChapter,
  onGenerateBatchChapters,
  onGenerateFrontOrEndMatter,
  onGenerateBatchFrontAndEndMatter,
  onOpenAiAssist,
  isGeneratingBatch,
  isGeneratingFrontEndBatch,
  generatingIndex,
}) => {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>({ kind: 'chapter', index: 0 });
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [selectedText, setSelectedText] = useState<string>('');
  const [isGeneratingSingleSection, setIsGeneratingSingleSection] = useState<string | null>(null);

  const matterMeta: Record<
    MatterType,
    { title: string; subtitle: string; category: 'Pré-Textual' | 'Pós-Textual' }
  > = {
    apresentacao: {
      title: 'Apresentação',
      subtitle: 'Visão geral e contexto de criação da obra',
      category: 'Pré-Textual',
    },
    introducao: {
      title: 'Introdução',
      subtitle: 'Primeiro contato profundo com a tese central',
      category: 'Pré-Textual',
    },
    conclusao: {
      title: 'Conclusão',
      subtitle: 'Síntese das ideias e fechamento transformador',
      category: 'Pós-Textual',
    },
    exercicios: {
      title: 'Exercícios e Práticas',
      subtitle: 'Atividades e guias de aplicação prática',
      category: 'Pós-Textual',
    },
    agradecimentos: {
      title: 'Agradecimentos',
      subtitle: 'Reconhecimento às contribuições e apoios',
      category: 'Pós-Textual',
    },
    sobreAutor: {
      title: 'Sobre o Autor',
      subtitle: 'Biografia, credenciais e trajetória do autor',
      category: 'Pós-Textual',
    },
  };

  const isMatterGenerated = (type: MatterType): boolean => {
    if (type === 'apresentacao' || type === 'introducao') {
      return Boolean(frontMatter[type]?.trim());
    } else {
      return Boolean(endMatter[type]?.trim());
    }
  };

  const getItemTitle = (): string => {
    if (selectedItem.kind === 'chapter') {
      const cap = chapters[selectedItem.index];
      const planCap = plan.sumario[selectedItem.index];
      return `Capítulo ${selectedItem.index + 1}: ${cap?.titulo || planCap?.titulo || 'Capítulo'}`;
    } else {
      return matterMeta[selectedItem.type].title;
    }
  };

  const getItemContent = (): string => {
    if (selectedItem.kind === 'chapter') {
      return chapters[selectedItem.index]?.content || '';
    } else {
      const type = selectedItem.type;
      if (type === 'apresentacao' || type === 'introducao') {
        return frontMatter[type] || '';
      } else {
        return endMatter[type] || '';
      }
    }
  };

  const handleContentChange = (val: string) => {
    if (selectedItem.kind === 'chapter') {
      onUpdateChapter(selectedItem.index, val);
    } else {
      onUpdateFrontOrEndMatter(selectedItem.type, val);
    }
  };

  const handleGenerateCurrentItem = async () => {
    if (selectedItem.kind === 'chapter') {
      await onGenerateChapter(selectedItem.index);
    } else {
      const type = selectedItem.type;
      setIsGeneratingSingleSection(type);
      try {
        await onGenerateFrontOrEndMatter(type);
      } finally {
        setIsGeneratingSingleSection(null);
      }
    }
  };

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const selection = target.value.substring(target.selectionStart, target.selectionEnd);
    if (selection && selection.trim().length > 5) {
      setSelectedText(selection);
    } else {
      setSelectedText('');
    }
  };

  const currentContent = getItemContent();
  const wordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0;
  const minWords = metadata.minPalavras || 1000;
  const maxWords = metadata.maxPalavras || 2500;

  const isWordCountOptimal =
    selectedItem.kind === 'chapter'
      ? wordCount >= minWords && wordCount <= maxWords
      : wordCount > 100;
  const isWordCountLow = selectedItem.kind === 'chapter' ? wordCount < minWords : wordCount === 0;

  const completedCount = chapters.filter(
    (c) => c.status === 'completed' || c.status === 'edited'
  ).length;
  const progressPercent = Math.round((completedCount / (chapters.length || 1)) * 100);

  const preMatterKeys: MatterType[] = ['apresentacao', 'introducao'];
  const postMatterKeys: MatterType[] = ['conclusao', 'exercicios', 'agradecimentos', 'sobreAutor'];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Banner & Batch Generation Bar */}
      <div className="bg-[#F5F5F4] border border-[#E7E5E4] p-6 text-[#1C1917] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="border-l-2 border-[#1C1917] pl-6 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A8A29E] font-semibold italic">
            Etapa 3 • Estúdio de Redação e Edição Integral
          </p>
          <h1 className="text-xl sm:text-2xl font-serif italic font-bold text-[#1C1917]">
            {metadata.titulo}
          </h1>
          <div className="flex items-center space-x-4 text-xs text-[#57534E]">
            <span>
              Capítulos Prontos:{' '}
              <strong className="text-[#1C1917] font-semibold">
                {completedCount}/{chapters.length} ({progressPercent}%)
              </strong>
            </span>
            <span>•</span>
            <span>
              Meta de Palavras:{' '}
              <strong className="text-[#1C1917]">
                {minWords} - {maxWords} por cap.
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onGenerateBatchFrontAndEndMatter}
            disabled={isGeneratingFrontEndBatch || isGeneratingBatch}
            className="flex items-center space-x-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-[#1C1917] border border-amber-500 disabled:opacity-50 font-bold text-xs uppercase tracking-widest transition shadow-xs"
          >
            {isGeneratingFrontEndBatch ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1C1917]" />
                <span>Gerando Fila Pré/Pós-Textual...</span>
              </>
            ) : (
              <>
                <Feather className="w-3.5 h-3.5 text-[#1C1917]" />
                <span>Gerar Todos Pré/Pós-Textuais em Fila</span>
              </>
            )}
          </button>

          <button
            onClick={onGenerateBatchChapters}
            disabled={isGeneratingBatch || generatingIndex !== null || isGeneratingFrontEndBatch}
            className="flex items-center space-x-2 px-6 py-3 bg-[#1C1917] hover:bg-[#44403C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest transition shadow-xs"
          >
            {isGeneratingBatch ? (
              <>
                <Wand2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Escrevendo Capítulos...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Escrever Todos os Capítulos (IA)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar: Chapters & Pre/Post Matter Navigator */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pre-Textual Sections Card */}
          <div className="bg-white border border-[#E7E5E4] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F5F5F4]">
              <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E] flex items-center space-x-2">
                <Feather className="w-3.5 h-3.5 text-[#78716C]" />
                <span>Elementos Pré-Textuais</span>
              </h2>
            </div>

            <div className="space-y-1.5">
              {preMatterKeys.map((key) => {
                const isSelected = selectedItem.kind === 'matter' && selectedItem.type === key;
                const generated = isMatterGenerated(key);
                const meta = matterMeta[key];
                const isGeneratingThis =
                  isGeneratingSingleSection === key || isGeneratingFrontEndBatch;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedItem({ kind: 'matter', type: key })}
                    className={`w-full text-left p-2.5 border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#1C1917] text-white border-[#1C1917] shadow-xs'
                        : 'bg-[#FDFCFB] border-[#E7E5E4] hover:border-[#D6D3D1] text-[#44403C]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs font-serif italic">{meta.title}</div>
                      <div
                        className={`text-[10px] ${isSelected ? 'text-stone-300' : 'text-[#78716C]'}`}
                      >
                        {meta.subtitle}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {isGeneratingThis ? (
                        <Wand2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                      ) : generated ? (
                        <CheckCircle
                          className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`}
                        />
                      ) : (
                        <span
                          className={`text-[10px] font-mono ${isSelected ? 'text-stone-400' : 'text-[#A8A29E]'}`}
                        >
                          + Gerar
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chapters Card */}
          <div className="bg-white border border-[#E7E5E4] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5F5F4]">
              <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E] flex items-center space-x-2">
                <BookOpen className="w-3.5 h-3.5 text-[#78716C]" />
                <span>Sumário de Capítulos</span>
              </h2>
              <span className="text-[11px] text-[#78716C] font-mono">
                {completedCount}/{chapters.length} Prontos
              </span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {plan.sumario.map((planCap, idx) => {
                const capState = chapters[idx] || { status: 'pending', wordCount: 0 };
                const isSelected = selectedItem.kind === 'chapter' && selectedItem.index === idx;
                const isGeneratingThis = generatingIndex === idx;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedItem({ kind: 'chapter', index: idx })}
                    className={`w-full text-left p-3 border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#1C1917] text-white border-[#1C1917] shadow-xs'
                        : 'bg-[#FDFCFB] border-[#E7E5E4] hover:border-[#D6D3D1] text-[#44403C]'
                    }`}
                  >
                    <div className="space-y-1 max-w-[180px] sm:max-w-[220px]">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 font-bold ${
                            isSelected ? 'bg-white text-[#1C1917]' : 'bg-[#F5F5F4] text-[#1C1917]'
                          }`}
                        >
                          Cap. {planCap.numero}
                        </span>
                        <span className="text-xs font-serif italic font-semibold truncate block">
                          {planCap.titulo}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] truncate ${isSelected ? 'text-stone-300' : 'text-[#78716C]'}`}
                      >
                        {capState.wordCount
                          ? `${capState.wordCount} pal.`
                          : `~${planCap.estimativaPalavras} pal. meta`}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isGeneratingThis ? (
                        <Wand2 className="w-4 h-4 text-amber-500 animate-spin" />
                      ) : capState.status === 'completed' || capState.status === 'edited' ? (
                        <CheckCircle
                          className={`w-4 h-4 ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`}
                        />
                      ) : (
                        <Clock
                          className={`w-4 h-4 ${isSelected ? 'text-stone-400' : 'text-[#A8A29E]'}`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Post-Textual Sections Card */}
          <div className="bg-white border border-[#E7E5E4] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F5F5F4]">
              <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E] flex items-center space-x-2">
                <Layers className="w-3.5 h-3.5 text-[#78716C]" />
                <span>Elementos Pós-Textuais</span>
              </h2>
            </div>

            <div className="space-y-1.5">
              {postMatterKeys.map((key) => {
                const isSelected = selectedItem.kind === 'matter' && selectedItem.type === key;
                const generated = isMatterGenerated(key);
                const meta = matterMeta[key];
                const isGeneratingThis =
                  isGeneratingSingleSection === key || isGeneratingFrontEndBatch;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedItem({ kind: 'matter', type: key })}
                    className={`w-full text-left p-2.5 border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#1C1917] text-white border-[#1C1917] shadow-xs'
                        : 'bg-[#FDFCFB] border-[#E7E5E4] hover:border-[#D6D3D1] text-[#44403C]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs font-serif italic">{meta.title}</div>
                      <div
                        className={`text-[10px] ${isSelected ? 'text-stone-300' : 'text-[#78716C]'}`}
                      >
                        {meta.subtitle}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {isGeneratingThis ? (
                        <Wand2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                      ) : generated ? (
                        <CheckCircle
                          className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`}
                        />
                      ) : (
                        <span
                          className={`text-[10px] font-mono ${isSelected ? 'text-stone-400' : 'text-[#A8A29E]'}`}
                        >
                          + Gerar
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Editor & Live Chapter / Section Content Studio */}
        <div className="lg:col-span-8 space-y-4">
          {/* Header & Controls */}
          <div className="bg-white border border-[#E7E5E4] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-[#1C1917] text-white font-mono text-xs font-bold">
                  {selectedItem.kind === 'chapter'
                    ? `Capítulo ${selectedItem.index + 1}`
                    : matterMeta[selectedItem.type].category}
                </span>
                <h2 className="text-lg font-serif italic font-bold text-[#1C1917]">
                  {getItemTitle()}
                </h2>
              </div>

              {/* Word Count Progress Gauge */}
              <div className="flex items-center space-x-3 mt-2">
                <span className="text-xs text-[#57534E]">
                  Volume: <strong className="text-[#1C1917] font-mono">{wordCount}</strong> palavras
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border ${
                    isWordCountOptimal
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : isWordCountLow
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {isWordCountOptimal
                    ? '✓ No limite ideal'
                    : isWordCountLow
                      ? 'Pendente / Curto'
                      : 'Volume Alto'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* View mode toggle */}
              <div className="flex items-center bg-[#F5F5F4] p-1 border border-[#E7E5E4]">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`p-1.5 text-xs ${
                    viewMode === 'edit'
                      ? 'bg-[#1C1917] text-white'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                  title="Apenas Editor"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`p-1.5 text-xs ${
                    viewMode === 'split'
                      ? 'bg-[#1C1917] text-white'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                  title="Visão Lado a Lado"
                >
                  <Columns className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`p-1.5 text-xs ${
                    viewMode === 'preview'
                      ? 'bg-[#1C1917] text-white'
                      : 'text-[#78716C] hover:text-[#1C1917]'
                  }`}
                  title="Apenas Visualização"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Single Generate Button */}
              <button
                onClick={handleGenerateCurrentItem}
                disabled={
                  generatingIndex !== null ||
                  isGeneratingSingleSection !== null ||
                  isGeneratingBatch ||
                  isGeneratingFrontEndBatch
                }
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#1C1917] hover:bg-[#44403C] text-white font-bold text-xs uppercase tracking-widest transition shadow-xs"
              >
                <Wand2
                  className={`w-3.5 h-3.5 ${generatingIndex === (selectedItem.kind === 'chapter' ? selectedItem.index : -1) || isGeneratingSingleSection === (selectedItem.kind === 'matter' ? selectedItem.type : null) ? 'animate-spin' : ''}`}
                />
                <span>{currentContent ? 'Regerar com IA' : 'Gerar com IA'}</span>
              </button>
            </div>
          </div>

          {/* Quick AI Selection Floating Assist Bar */}
          {selectedText && (
            <div className="bg-[#1C1917] text-white p-3 shadow-md flex items-center justify-between text-xs animate-fade-in border-l-2 border-amber-400">
              <div className="flex items-center space-x-2 truncate max-w-xs sm:max-w-md">
                <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="truncate italic font-serif text-stone-200">"{selectedText}"</span>
              </div>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                <button
                  onClick={() => onOpenAiAssist(selectedText, 'expand')}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-white font-medium uppercase tracking-wider text-[10px]"
                >
                  Expandir
                </button>
                <button
                  onClick={() => onOpenAiAssist(selectedText, 'polish')}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-white font-medium uppercase tracking-wider text-[10px]"
                >
                  Polir
                </button>
                <button
                  onClick={() => onOpenAiAssist(selectedText, 'fixGrammar')}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-white font-medium uppercase tracking-wider text-[10px]"
                >
                  Corrigir
                </button>
              </div>
            </div>
          )}

          {/* Editor Container Area */}
          <div
            className={`grid gap-4 ${
              viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {/* Editor Input */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className="bg-white border border-[#E7E5E4] p-4 flex flex-col h-[580px]">
                <div className="flex items-center justify-between pb-2 border-b border-[#F5F5F4] mb-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E]">
                    Editor Markdown
                  </span>
                  <span className="text-[11px] text-[#78716C]">Digite ou use a IA para gerar</span>
                </div>
                <textarea
                  value={currentContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onSelect={handleTextareaSelect}
                  placeholder={`O texto de ${getItemTitle()} aparecerá aqui. Você pode escrever diretamente ou clicar em 'Gerar com IA'...`}
                  className="w-full h-full bg-[#FDFCFB] border border-[#E7E5E4] p-4 text-xs font-mono text-[#1C1917] focus:outline-none focus:border-[#1C1917] resize-none leading-relaxed"
                />
              </div>
            )}

            {/* Rendered Markdown Preview */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="bg-white border border-[#E7E5E4] p-6 h-[580px] overflow-y-auto font-serif space-y-4 text-[#1C1917] leading-relaxed text-sm">
                <div className="pb-3 border-b border-[#F5F5F4] flex justify-between items-center font-sans text-xs text-[#78716C] font-mono">
                  <span>Visualização Impressa</span>
                  <span>{wordCount} palavras</span>
                </div>

                {currentContent ? (
                  <div className="max-w-none space-y-4 text-[#1C1917]">
                    <h2 className="text-2xl font-bold font-serif italic text-[#1C1917] border-b border-[#E7E5E4] pb-2">
                      {getItemTitle()}
                    </h2>
                    <div className="whitespace-pre-wrap font-serif text-[#1C1917] leading-relaxed text-sm">
                      {currentContent}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#A8A29E] text-xs space-y-3 py-20">
                    <Feather className="w-8 h-8 text-[#D6D3D1]" />
                    <p className="font-serif italic">Nenhum texto gerado para esta seção ainda.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
