import React, { useState } from 'react';
import { EditorialPlan, ChapterPlan, BookMetadata } from '../types';
import {
  Sparkles,
  BookOpen,
  UserCheck,
  ListOrdered,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit3,
  Check,
  Wand2,
  ArrowRight,
} from 'lucide-react';

interface PlanningStageProps {
  plan: EditorialPlan | null;
  metadata: BookMetadata;
  onUpdatePlan: (plan: EditorialPlan) => void;
  onRegeneratePlan: () => void;
  onProceedToWriting: () => void;
  isGenerating: boolean;
}

export const PlanningStage: React.FC<PlanningStageProps> = ({
  plan,
  metadata,
  onUpdatePlan,
  onRegeneratePlan,
  onProceedToWriting,
  isGenerating,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCapForm, setEditCapForm] = useState<Partial<ChapterPlan>>({});

  if (!plan) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-6">
        <div className="p-4 bg-[#F5F5F4] border border-[#E7E5E4] w-16 h-16 mx-auto text-[#1C1917] flex items-center justify-center font-serif text-2xl font-bold italic">
          S
        </div>
        <h2 className="text-2xl font-serif italic font-bold text-[#1C1917]">
          Nenhum Planejamento Editorial Gerado
        </h2>
        <p className="text-[#57534E] text-xs sm:text-sm max-w-md mx-auto font-serif">
          Clique no botão abaixo para que o Scriptor estruture o conceito central, perfil do leitor
          e o sumário detalhado do livro.
        </p>
        <button
          onClick={onRegeneratePlan}
          disabled={isGenerating}
          className="px-6 py-3 bg-[#1C1917] hover:bg-[#44403C] text-white font-bold text-xs uppercase tracking-widest transition shadow-xs inline-flex items-center space-x-2"
        >
          {isGenerating ? (
            <>
              <Wand2 className="w-4 h-4 animate-spin" />
              <span>Elaborando Arquitetura Editorial...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Gerar Arquitetura Editorial com IA</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const startEditChapter = (index: number, cap: ChapterPlan) => {
    setEditingIndex(index);
    setEditCapForm({ ...cap });
  };

  const saveChapterEdit = (index: number) => {
    if (!plan || editingIndex === null) return;
    const updatedSumario = [...plan.sumario];
    updatedSumario[index] = {
      ...updatedSumario[index],
      ...editCapForm,
    } as ChapterPlan;

    onUpdatePlan({ ...plan, sumario: updatedSumario });
    setEditingIndex(null);
  };

  const addChapter = () => {
    if (!plan) return;
    const nextNum = plan.sumario.length + 1;
    const newCap: ChapterPlan = {
      numero: nextNum,
      titulo: `Novo Capítulo ${nextNum}`,
      subtitulo: 'Subtítulo complementar',
      objetivo: 'Aprofundar um conceito chave no desenvolvimento do livro',
      topicos: ['Tópico principal 1', 'Tópico complementar 2'],
      estimativaPalavras: Math.round((metadata.minPalavras + metadata.maxPalavras) / 2),
    };
    onUpdatePlan({ ...plan, sumario: [...plan.sumario, newCap] });
  };

  const deleteChapter = (index: number) => {
    if (!plan) return;
    const updated = plan.sumario
      .filter((_, i) => i !== index)
      .map((cap, i) => ({ ...cap, numero: i + 1 }));
    onUpdatePlan({ ...plan, sumario: updated });
  };

  const moveChapter = (index: number, direction: 'up' | 'down') => {
    if (!plan) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= plan.sumario.length) return;

    const list = [...plan.sumario];
    const current = list[index];
    const target = list[targetIndex];
    if (!current || !target) return;
    list[index] = target;
    list[targetIndex] = current;

    // re-number
    const renumbered = list.map((cap, i) => ({ ...cap, numero: i + 1 }));
    onUpdatePlan({ ...plan, sumario: renumbered });
  };

  const totalEstimatedWords = plan.sumario.reduce(
    (acc, cap) => acc + (cap.estimativaPalavras || 0),
    0
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Top Banner */}
      <div className="bg-[#F5F5F4] border border-[#E7E5E4] p-6 sm:p-8 text-[#1C1917] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="border-l-2 border-[#1C1917] pl-6 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A8A29E] font-semibold italic">
            Etapa 2 • Arquitetura & Sumário Editorial
          </p>
          <h1 className="text-2xl sm:text-3xl font-serif italic font-bold text-[#1C1917]">
            {metadata.titulo}
          </h1>
          <p className="text-xs text-[#57534E] font-serif">
            Volume total previsto:{' '}
            <span className="text-[#1C1917] font-semibold">
              {totalEstimatedWords.toLocaleString('pt-BR')} palavras
            </span>{' '}
            distribuídas em {plan.sumario.length} capítulos.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRegeneratePlan}
            disabled={isGenerating}
            className="px-4 py-2.5 bg-white hover:bg-[#E7E5E4] text-[#44403C] text-xs font-semibold uppercase tracking-wider border border-[#D6D3D1] transition"
          >
            {isGenerating ? 'Regerando...' : 'Regerar Arquitetura'}
          </button>
          <button
            onClick={onProceedToWriting}
            className="flex items-center space-x-2 px-6 py-2.5 bg-[#1C1917] hover:bg-[#44403C] text-white text-xs font-bold uppercase tracking-widest transition shadow-xs"
          >
            <span>Redação dos Capítulos (Etapa 3)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Concept & Reader Persona Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Conceito Central */}
        <div className="bg-white border border-[#E7E5E4] p-6 space-y-3">
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E] flex items-center space-x-2 border-b border-[#F5F5F4] pb-2">
            <BookOpen className="w-3.5 h-3.5 text-[#78716C]" />
            <span>Conceito Central & Promessa</span>
          </h2>
          <div className="text-xs text-[#44403C] space-y-2 leading-relaxed font-serif">
            <p>
              <strong>Conceito:</strong> {plan.conceitoCentral}
            </p>
            <p>
              <strong>Promessa Principal:</strong>{' '}
              <span className="text-[#1C1917] font-semibold italic">{plan.promessaPrincipal}</span>
            </p>
          </div>
        </div>

        {/* Perfil do Leitor */}
        <div className="bg-white border border-[#E7E5E4] p-6 space-y-3">
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E] flex items-center space-x-2 border-b border-[#F5F5F4] pb-2">
            <UserCheck className="w-3.5 h-3.5 text-[#78716C]" />
            <span>Perfil do Leitor</span>
          </h2>
          <div className="text-xs text-[#44403C] space-y-2 leading-relaxed font-serif">
            <p className="line-clamp-2">{plan.perfilLeitor?.descricao}</p>
            {plan.perfilLeitor?.doresEAnseios && (
              <div>
                <span className="font-semibold text-[#78716C] font-sans text-[11px]">
                  Dores e Anseios:
                </span>
                <ul className="list-disc list-inside text-[#57534E] mt-0.5 space-y-0.5">
                  {plan.perfilLeitor.doresEAnseios.slice(0, 2).map((dor, i) => (
                    <li key={i}>{dor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table of Contents (Sumário) */}
      <div className="bg-white border border-[#E7E5E4] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
          <div className="flex items-center space-x-3">
            <ListOrdered className="w-5 h-5 text-[#1C1917]" />
            <div>
              <h2 className="text-lg font-serif italic font-bold text-[#1C1917]">
                Sumário e Estrutura dos Capítulos
              </h2>
              <p className="text-xs text-[#78716C]">
                Você pode reordenar, ajustar objetivos ou incluir novos capítulos antes da geração.
              </p>
            </div>
          </div>
          <button
            onClick={addChapter}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#44403C] border border-[#D6D3D1] text-xs font-semibold uppercase tracking-wider transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Capítulo</span>
          </button>
        </div>

        {/* Chapters Accordion / List */}
        <div className="space-y-4">
          {plan.sumario.map((cap, index) => {
            const isEditing = editingIndex === index;

            return (
              <div
                key={index}
                className="bg-[#FDFCFB] border border-[#E7E5E4] hover:border-[#D6D3D1] p-4 sm:p-5 transition space-y-3"
              >
                {isEditing ? (
                  /* Edit Mode Form */
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#57534E] font-semibold mb-1">
                          Título do Capítulo
                        </label>
                        <input
                          type="text"
                          value={editCapForm.titulo || ''}
                          onChange={(e) =>
                            setEditCapForm({ ...editCapForm, titulo: e.target.value })
                          }
                          className="w-full bg-white border border-[#D6D3D1] p-2 text-[#1C1917] font-serif focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[#57534E] font-semibold mb-1">Subtítulo</label>
                        <input
                          type="text"
                          value={editCapForm.subtitulo || ''}
                          onChange={(e) =>
                            setEditCapForm({ ...editCapForm, subtitulo: e.target.value })
                          }
                          className="w-full bg-white border border-[#D6D3D1] p-2 text-[#1C1917] font-serif focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#57534E] font-semibold mb-1">
                        Objetivo Central
                      </label>
                      <textarea
                        rows={2}
                        value={editCapForm.objetivo || ''}
                        onChange={(e) =>
                          setEditCapForm({ ...editCapForm, objetivo: e.target.value })
                        }
                        className="w-full bg-white border border-[#D6D3D1] p-2 text-[#1C1917] font-serif focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#57534E] font-semibold mb-1">
                          Tópicos (separados por vírgula)
                        </label>
                        <input
                          type="text"
                          value={editCapForm.topicos?.join(', ') || ''}
                          onChange={(e) =>
                            setEditCapForm({
                              ...editCapForm,
                              topicos: e.target.value.split(',').map((s) => s.trim()),
                            })
                          }
                          className="w-full bg-white border border-[#D6D3D1] p-2 text-[#1C1917] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[#57534E] font-semibold mb-1">
                          Estimativa de Palavras
                        </label>
                        <input
                          type="number"
                          value={editCapForm.estimativaPalavras || 1500}
                          onChange={(e) =>
                            setEditCapForm({
                              ...editCapForm,
                              estimativaPalavras: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full bg-white border border-[#D6D3D1] p-2 text-[#1C1917] font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="px-3 py-1 bg-[#F5F5F4] text-[#57534E] border border-[#E7E5E4]"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveChapterEdit(index)}
                        className="px-3 py-1 bg-[#1C1917] text-white font-medium flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read Mode View */
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 bg-[#1C1917] text-white font-serif italic text-xs font-bold">
                          Cap. {cap.numero}
                        </span>
                        <h3 className="font-serif italic font-bold text-[#1C1917] text-base">
                          {cap.titulo}
                        </h3>
                        {cap.subtitulo && (
                          <span className="text-xs text-[#78716C] hidden md:inline font-serif italic">
                            — {cap.subtitulo}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#44403C] leading-relaxed font-serif">
                        <span className="text-[#1C1917] font-bold font-sans uppercase tracking-wider text-[10px]">
                          Objetivo:
                        </span>{' '}
                        {cap.objetivo}
                      </p>

                      {cap.topicos && cap.topicos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {cap.topicos.map((topico, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 bg-white text-[11px] text-[#57534E] border border-[#E7E5E4]"
                            >
                              • {topico}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-start">
                      <span className="text-xs text-[#1C1917] font-mono font-semibold bg-[#F5F5F4] border border-[#E7E5E4] px-2.5 py-1">
                        ~{cap.estimativaPalavras} pal.
                      </span>

                      <div className="flex items-center space-x-1 bg-white p-1 border border-[#E7E5E4]">
                        <button
                          onClick={() => moveChapter(index, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-[#F5F5F4] disabled:opacity-30 text-[#57534E]"
                          title="Mover Para Cima"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveChapter(index, 'down')}
                          disabled={index === plan.sumario.length - 1}
                          className="p-1 hover:bg-[#F5F5F4] disabled:opacity-30 text-[#57534E]"
                          title="Mover Para Baixo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => startEditChapter(index, cap)}
                          className="p-1 hover:bg-[#F5F5F4] text-[#1C1917]"
                          title="Editar Capítulo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteChapter(index)}
                          className="p-1 hover:bg-rose-50 text-rose-600"
                          title="Excluir Capítulo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
