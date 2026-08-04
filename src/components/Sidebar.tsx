import React, { useState } from 'react';
import { BookProject, AiConfig } from '../types';
import {
  Settings,
  FolderOpen,
  Terminal,
  X,
  Plus,
  Trash2,
  BookOpen,
  Sparkles,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { LogConsoleModal } from './LogConsoleModal';
import { AiSettingsModal } from './AiSettingsModal';
import { ProjectListModal } from './ProjectListModal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: BookProject[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  aiConfig: AiConfig;
  onSaveAiConfig: (updated: AiConfig) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  aiConfig,
  onSaveAiConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'settings' | 'logs'>('projects');
  const [isLogConsoleOpen, setIsLogConsoleOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FDFCFB] text-[#1C1917] border-l border-[#E7E5E4] shadow-2xl flex flex-col font-sans">
          {/* Header */}
          <div className="p-4 border-b border-[#E7E5E4] flex items-center justify-between bg-[#F5F5F4]">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="font-serif font-bold text-base text-[#1C1917]">
                Painel de Controle OMNIA
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#78716C] hover:text-[#1C1917] transition rounded-sm"
              title="Fechar Painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-[#E7E5E4] bg-[#FDFCFB] text-xs font-semibold">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex-1 py-3 px-2 flex items-center justify-center space-x-2 border-b-2 transition ${
                activeTab === 'projects'
                  ? 'border-[#1C1917] text-[#1C1917] bg-stone-50 font-bold'
                  : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Projetos ({projects.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-3 px-2 flex items-center justify-center space-x-2 border-b-2 transition ${
                activeTab === 'settings'
                  ? 'border-[#1C1917] text-[#1C1917] bg-stone-50 font-bold'
                  : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configurações IA</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-3 px-2 flex items-center justify-center space-x-2 border-b-2 transition ${
                activeTab === 'logs'
                  ? 'border-[#1C1917] text-[#1C1917] bg-stone-50 font-bold'
                  : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console Logs</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'projects' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-bold text-[#78716C]">
                    Seus Livros
                  </span>
                  <button
                    onClick={() => {
                      onNewProject();
                      onClose();
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#1C1917] hover:bg-[#44403C] text-white text-xs font-semibold rounded-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Livro</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {projects.map((proj) => {
                    const isSelected = proj.id === currentProjectId;
                    return (
                      <div
                        key={proj.id}
                        onClick={() => {
                          onSelectProject(proj.id);
                          onClose();
                        }}
                        className={`p-3 border transition cursor-pointer flex items-center justify-between rounded-sm ${
                          isSelected
                            ? 'border-[#1C1917] bg-amber-50/50 shadow-xs'
                            : 'border-[#E7E5E4] bg-white hover:border-[#A8A29E]'
                        }`}
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <BookOpen
                            className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-700' : 'text-[#78716C]'}`}
                          />
                          <div className="truncate">
                            <p className="text-xs font-serif font-bold text-[#1C1917] truncate">
                              {proj.metadata.titulo || 'Sem Título'}
                            </p>
                            <p className="text-[10px] text-[#78716C] truncate">
                              {proj.metadata.autor} • {proj.chapters?.length || 0} capítulos
                            </p>
                          </div>
                        </div>

                        {projects.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Deseja excluir o livro "${proj.metadata.titulo}"?`)) {
                                onDeleteProject(proj.id);
                              }
                            }}
                            className="text-stone-400 hover:text-rose-600 p-1 transition"
                            title="Excluir Projeto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm font-serif">
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    <Cpu className="w-4 h-4 text-amber-700" />
                    <span>Motor de IA Ativo</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Provedor: <strong className="uppercase">{aiConfig.provider}</strong> | Modelo:{' '}
                    <strong>
                      {aiConfig.provider === 'opencode'
                        ? aiConfig.opencodeModel
                        : aiConfig.geminiModel}
                    </strong>
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      // Triggers AI Settings Modal
                    }}
                    className="w-full py-2.5 px-4 bg-[#1C1917] hover:bg-[#44403C] text-white font-bold text-xs uppercase tracking-wider transition rounded-sm flex items-center justify-center space-x-2"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Abrir Configurações Completas de IA</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-3 text-xs">
                <p className="text-[#78716C] leading-relaxed">
                  Consulte os registros técnicos em tempo real das chamadas da IA, auditorias e
                  exportações de PDF.
                </p>
                <button
                  onClick={() => setIsLogConsoleOpen(true)}
                  className="w-full py-2.5 px-4 bg-stone-900 hover:bg-black text-amber-400 font-mono text-xs font-bold transition rounded-sm flex items-center justify-center space-x-2"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Abrir Console de Telemetria ao Vivo</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[#E7E5E4] bg-[#F5F5F4] text-[10px] text-[#78716C] flex items-center justify-between font-serif">
            <span>OMNIA FACTORY v3.0 — Estúdio Editorial</span>
            <span>IndexedDB Ativo</span>
          </div>
        </div>
      </div>

      <LogConsoleModal isOpen={isLogConsoleOpen} onClose={() => setIsLogConsoleOpen(false)} />
    </div>
  );
};
