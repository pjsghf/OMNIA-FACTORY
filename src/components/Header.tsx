import React from 'react';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  Download,
  Plus,
  Library,
  Layers,
  Cpu,
  Globe,
  Terminal,
} from 'lucide-react';
import { BookProject, EditorialStage } from '../types';

interface HeaderProps {
  project: BookProject;
  activeStage: EditorialStage;
  onSelectStage: (stage: EditorialStage) => void;
  onNewProject: () => void;
  onOpenProjectList: () => void;
  onOpenAiSettings: () => void;
  onOpenTranslation?: () => void;
  onOpenLogConsole?: () => void;
  onOpenSidebar?: () => void;
  totalWordCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  activeStage,
  onSelectStage,
  onNewProject,
  onOpenProjectList,
  onOpenAiSettings,
  onOpenTranslation,
  onOpenLogConsole,
  onOpenSidebar,
  totalWordCount,
}) => {
  const stages: { id: EditorialStage; label: string; icon: React.ReactNode }[] = [
    { id: 'config', label: '1. Configuração', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'writing', label: '2. Estúdio Central', icon: <FileText className="w-3.5 h-3.5" /> },
    {
      id: 'design_export',
      label: '3. Capa & Exportação',
      icon: <Download className="w-3.5 h-3.5" />,
    },
  ];

  const completedChapters = project.chapters.filter(
    (c) => c.status === 'completed' || c.status === 'edited'
  ).length;
  const totalChapters = project.metadata.qtdCapitulos || project.chapters.length || 0;

  return (
    <header className="bg-[#FDFCFB] border-b border-[#E7E5E4] text-[#1C1917] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-[#F5F5F4]">
          {/* Brand Logo & Current Project Info */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-sm bg-[#1C1917] text-white flex items-center justify-center font-serif text-base italic font-bold">
              O
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif text-xl italic font-bold text-[#1C1917] tracking-tight">
                  OMNIA Factory
                </span>
                <span className="text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 bg-[#F5F5F4] text-[#78716C] border border-[#E7E5E4] font-semibold">
                  Editora OMNIA
                </span>
              </div>
              <p className="text-[11px] text-[#78716C] italic truncate max-w-[180px] sm:max-w-xs font-serif">
                {project.metadata.titulo || 'Obra em Desenvolvimento'}
              </p>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="hidden lg:flex items-center space-x-8 text-xs text-[#57534E]">
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#A8A29E] font-medium">
                Capítulos
              </p>
              <p className="font-serif text-sm italic font-semibold text-[#1C1917]">
                {completedChapters} / {totalChapters}
              </p>
            </div>
            <div className="h-6 w-px bg-[#E7E5E4]" />
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#A8A29E] font-medium">
                Volume Total
              </p>
              <p className="font-serif text-sm italic font-semibold text-[#1C1917]">
                {totalWordCount.toLocaleString('pt-BR')}{' '}
                <span className="text-[10px] font-sans text-[#78716C]">palavras</span>
              </p>
            </div>
            <div className="h-6 w-px bg-[#E7E5E4]" />
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#A8A29E] font-medium">
                Gênero
              </p>
              <p className="font-serif text-sm italic capitalize font-semibold text-[#1C1917]">
                {project.metadata.estilo.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Project & AI Settings Controls */}
          <div className="flex items-center space-x-2">
            {onOpenTranslation && (
              <button
                onClick={onOpenTranslation}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#1C1917] bg-amber-50 hover:bg-amber-100 border border-amber-300 transition rounded-sm"
                title="Tradutor e Localizador Cultural de E-books"
              >
                <Globe className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Traduzir E-book</span>
              </button>
            )}

            <button
              onClick={onOpenAiSettings}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#1C1917] bg-[#F5F5F4] hover:bg-[#E7E5E4] border border-[#D6D3D1] transition rounded-sm"
              title="Configurações de IA (Gemini / OpenCode GO)"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Modelos IA</span>
            </button>

            {onOpenLogConsole && (
              <button
                onClick={onOpenLogConsole}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-900 bg-slate-200 hover:bg-amber-400 hover:text-slate-950 border border-slate-400 transition rounded-sm shadow-xs font-mono"
                title="Abrir Console de Logs e Diagnóstico em Tempo Real"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Console Logs</span>
              </button>
            )}

            {onOpenSidebar && (
              <button
                onClick={onOpenSidebar}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 border border-amber-500 transition rounded-sm shadow-xs"
                title="Abrir Painel Lateral de Controle OMNIA"
              >
                <Layers className="w-3.5 h-3.5 text-slate-950" />
                <span className="hidden sm:inline">Painel OMNIA</span>
              </button>
            )}

            <button
              onClick={onOpenProjectList}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#44403C] bg-[#F5F5F4] hover:bg-[#E7E5E4] border border-[#D6D3D1] transition rounded-sm"
              title="Biblioteca de Projetos"
            >
              <Library className="w-3.5 h-3.5 text-[#78716C]" />
              <span className="hidden sm:inline">Biblioteca</span>
            </button>

            <button
              onClick={onNewProject}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-white bg-[#1C1917] hover:bg-[#44403C] transition rounded-sm shadow-xs"
              title="Criar Novo Livro"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Novo Livro</span>
            </button>
          </div>
        </div>

        {/* Navigation Stage Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto py-2 scrollbar-none text-xs">
          {stages.map((stage) => {
            const isActive = activeStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => onSelectStage(stage.id)}
                className={`flex items-center space-x-2 px-4 py-2 border transition-all ${
                  isActive
                    ? 'bg-[#1C1917] text-white border-[#1C1917] font-semibold shadow-xs'
                    : 'bg-transparent text-[#78716C] border-transparent hover:text-[#1C1917] hover:border-[#E7E5E4] hover:bg-[#F5F5F4]'
                }`}
              >
                {stage.icon}
                <span className="uppercase tracking-wider text-[11px] font-medium">
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
