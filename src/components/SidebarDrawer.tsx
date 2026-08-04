import React from 'react';
import { FolderOpen, Settings, Terminal, X, Sparkles } from 'lucide-react';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenProjects: () => void;
  onOpenLogs: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenProjects,
  onOpenLogs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex font-sans">
      {/* Fundo escuro clicável para fechar */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Conteúdo do Painel Lateral Drawer */}
      <div className="relative z-10 w-80 bg-[#FDFCFB] border-r border-[#E7E5E4] p-6 shadow-2xl flex flex-col justify-between text-[#1C1917]">
        <div>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E7E5E4]">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-600 animate-pulse" />
              <h2 className="text-lg font-serif font-bold text-[#1C1917]">Menu OMNIA</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#78716C] hover:text-[#1C1917] transition rounded-sm"
              title="Fechar Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => {
                onOpenProjects();
                onClose();
              }}
              className="flex w-full items-center space-x-3 rounded-sm p-3 text-left font-serif font-semibold text-xs text-[#1C1917] bg-white border border-[#E7E5E4] hover:border-[#1C1917] hover:bg-stone-50 transition shadow-xs"
            >
              <FolderOpen className="w-4 h-4 text-amber-700 shrink-0" />
              <span>📂 Meus Projetos & Livros</span>
            </button>

            <button
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="flex w-full items-center space-x-3 rounded-sm p-3 text-left font-serif font-semibold text-xs text-[#1C1917] bg-white border border-[#E7E5E4] hover:border-[#1C1917] hover:bg-stone-50 transition shadow-xs"
            >
              <Settings className="w-4 h-4 text-amber-700 shrink-0" />
              <span>⚙️ Configurações de API & IA</span>
            </button>

            <button
              onClick={() => {
                onOpenLogs();
                onClose();
              }}
              className="flex w-full items-center space-x-3 rounded-sm p-3 text-left font-serif font-semibold text-xs text-[#1C1917] bg-white border border-[#E7E5E4] hover:border-[#1C1917] hover:bg-stone-50 transition shadow-xs"
            >
              <Terminal className="w-4 h-4 text-amber-700 shrink-0" />
              <span>📋 Logs do Sistema & Diagnóstico</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-[#E7E5E4] text-[11px] text-[#78716C] font-serif flex items-center justify-between">
          <span>OMNIA Factory v3.0</span>
          <span>IndexedDB Ativo</span>
        </div>
      </div>
    </div>
  );
};
