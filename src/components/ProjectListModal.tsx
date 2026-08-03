import React, { useState } from 'react';
import { BookProject } from '../types';
import { X, Plus, BookOpen, Trash2, Download, Upload, ShieldCheck, Copy } from 'lucide-react';
import { createBackupPackage, validateAndRestoreBackup } from '../lib/backupService';

interface ProjectListModalProps {
  projects: BookProject[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onImportProject: (imported: BookProject | BookProject[]) => void;
  onClose: () => void;
}

export const ProjectListModal: React.FC<ProjectListModalProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onImportProject,
  onClose,
}) => {
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState<string>('');

  const handleBackupAll = () => {
    try {
      const pkg = createBackupPackage(projects);
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(pkg, null, 2));
      const downloadAnchor = document.createElement('a');
      const filename = `omnia_backup_v2_${new Date().toISOString().slice(0, 10)}.json`;
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setMigrationNotice(`Backup completo gerado (${pkg.manifest.projectCount} projetos).`);
    } catch (err: any) {
      alert('Erro ao gerar pacote de backup: ' + (err.message || 'Erro desconhecido.'));
    }
  };

  const handleDuplicateProject = (proj: BookProject) => {
    const copy: BookProject = {
      ...proj,
      id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...proj.metadata,
        titulo: `${proj.metadata.titulo || 'Livro'} (Cópia)`,
      },
    };
    onImportProject(copy);
    setMigrationNotice(`Projeto "${proj.metadata.titulo}" duplicado com sucesso.`);
  };

  const handleDeleteWithConfirm = (proj: BookProject) => {
    if (
      confirmNameInput.trim().toLowerCase() !== (proj.metadata.titulo || '').trim().toLowerCase()
    ) {
      alert('O nome digitado não corresponde ao título do livro. Exclusão cancelada.');
      return;
    }
    onDeleteProject(proj.id);
    setDeleteConfirmId(null);
    setConfirmNameInput('');
    setMigrationNotice(`Projeto "${proj.metadata.titulo}" excluído.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result as string;
        const parsed = JSON.parse(rawText);

        const restored = validateAndRestoreBackup(parsed);
        if (restored.success && restored.projects && restored.projects.length > 0) {
          onImportProject(restored.projects);
          setMigrationNotice(`Restaurados ${restored.projects.length} projeto(s) com sucesso.`);
        } else if (parsed.id && parsed.metadata && parsed.metadata.titulo) {
          onImportProject(parsed);
          setMigrationNotice('Projeto individual importado.');
        } else {
          alert(
            'Arquivo JSON de projeto ou backup inválido: ' +
              (restored.error || 'estrutura não reconhecida.')
          );
        }
      } catch (err) {
        alert('Erro ao ler e validar o arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Biblioteca de Projetos Editorial"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white border border-[#E7E5E4] w-full max-w-xl p-6 shadow-xl space-y-5 text-[#1C1917]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#1C1917]" />
            <h3 className="font-serif italic font-bold text-base">
              Biblioteca de Projetos Editorial
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F5F5F4] text-[#78716C]"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local Storage & Backup Banner */}
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
          <div className="flex items-center space-x-2 font-bold">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <span>Segurança de Dados e Migração</span>
          </div>
          <p className="text-amber-800 leading-relaxed">
            Seus projetos estão salvos neste navegador. Gere backups periódicos para prevenir perda
            de dados.
          </p>
          {migrationNotice && (
            <div className="p-2 bg-emerald-100 border border-emerald-300 text-emerald-900 font-medium">
              {migrationNotice}
            </div>
          )}
        </div>

        {/* Project List */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {projects.map((proj) => {
            const isCurrent = proj.id === currentProjectId;
            const completedCaps = proj.chapters.filter(
              (c) => c.status === 'completed' || c.status === 'edited'
            ).length;
            const totalWords = proj.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
            const isConfirmingDelete = deleteConfirmId === proj.id;

            return (
              <div
                key={proj.id}
                className={`p-4 border flex flex-col space-y-3 transition ${
                  isCurrent
                    ? 'bg-[#1C1917] text-white border-[#1C1917]'
                    : 'bg-[#FDFCFB] border-[#E7E5E4] hover:border-[#D6D3D1] text-[#1C1917]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-serif italic font-bold text-sm">
                        {proj.metadata.titulo || 'Livro Sem Título'}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-white text-[#1C1917] font-mono text-[9px] uppercase tracking-wider font-bold">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${isCurrent ? 'text-stone-300' : 'text-[#78716C]'}`}>
                      {completedCaps} de {proj.metadata.qtdCapitulos} Capítulos •{' '}
                      {totalWords.toLocaleString('pt-BR')} palavras
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isCurrent && (
                      <button
                        onClick={() => {
                          onSelectProject(proj.id);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-[#1C1917] hover:bg-[#44403C] text-white text-xs uppercase tracking-wider font-bold transition"
                      >
                        Abrir
                      </button>
                    )}

                    <button
                      onClick={() => handleDuplicateProject(proj)}
                      className={`p-1.5 transition ${isCurrent ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-stone-100 text-[#44403C]'}`}
                      title="Duplicar Projeto"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {projects.length > 1 && (
                      <button
                        onClick={() => {
                          setDeleteConfirmId(isConfirmingDelete ? null : proj.id);
                          setConfirmNameInput('');
                        }}
                        className={`p-1.5 transition ${isCurrent ? 'hover:bg-stone-800 text-rose-300' : 'hover:bg-rose-50 text-rose-700'}`}
                        title="Excluir Projeto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {isConfirmingDelete && (
                  <div className="bg-rose-950 text-white p-3 space-y-2 text-xs border border-rose-800 animate-fade-in">
                    <p>
                      Digite <strong>{proj.metadata.titulo}</strong> para confirmar a exclusão
                      permanente:
                    </p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={confirmNameInput}
                        onChange={(e) => setConfirmNameInput(e.target.value)}
                        placeholder="Nome exato do livro"
                        className="bg-black/40 border border-rose-700 px-2 py-1 text-xs text-white w-full"
                      />
                      <button
                        onClick={() => handleDeleteWithConfirm(proj)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Backup & Actions */}
        <div className="pt-4 border-t border-[#E7E5E4] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBackupAll}
              className="flex items-center space-x-1.5 px-3 py-2 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#1C1917] text-xs font-medium uppercase tracking-wider transition border border-[#D6D3D1]"
              title="Baixar pacote de backup completo (.json)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Backup</span>
            </button>

            <label className="flex items-center space-x-1.5 px-3 py-2 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#1C1917] text-xs font-medium uppercase tracking-wider cursor-pointer transition border border-[#D6D3D1]">
              <Upload className="w-3.5 h-3.5" />
              <span>Restaurar / Importar</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#1C1917] hover:bg-[#44403C] text-white text-xs uppercase tracking-widest font-bold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Livro</span>
          </button>
        </div>
      </div>
    </div>
  );
};
