import React from 'react';
import { EditorialReport, ReviewFinding } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  BarChart2,
  Wand2,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface ReviewStageProps {
  report: EditorialReport | null;
  onRunReview: () => void;
  onApplyReviewImprovements: (chapterIndex?: number) => Promise<void>;
  isReviewing: boolean;
  isApplyingReview: boolean;
  generatingIndex?: number | null;
  totalWords: number;
}

export const ReviewStage: React.FC<ReviewStageProps> = ({
  report,
  onRunReview,
  onApplyReviewImprovements,
  isReviewing,
  isApplyingReview,
  generatingIndex,
  totalWords,
}) => {
  const getChapterIndexFromFinding = (f: ReviewFinding): number | null => {
    if (f.unitId?.startsWith('cap-')) {
      const num = parseInt(f.unitId.replace('cap-', ''), 10);
      return !isNaN(num) && num > 0 ? num - 1 : null;
    }
    const match = f.unitTitle?.match(/(?:capítulo|cap\.?)\s*(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return num > 0 ? num - 1 : null;
    }
    return null;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Top Banner */}
      <div className="bg-[#F5F5F4] border border-[#E7E5E4] p-6 sm:p-8 text-[#1C1917] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="border-l-2 border-[#1C1917] pl-6 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A8A29E] font-semibold italic">
            Etapa 4 • Auditoria & Polimento Editorial
          </p>
          <h1 className="text-2xl sm:text-3xl font-serif italic font-bold text-[#1C1917]">
            Revisão Crítica e Diagnóstico
          </h1>
          <p className="text-xs text-[#57534E] font-serif">
            Auditoria hierárquica por unidade (100% de cobertura) com avaliação em 6 modalidades.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={onRunReview}
            disabled={isReviewing || isApplyingReview || totalWords === 0}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-white border border-[#1C1917] text-[#1C1917] hover:bg-[#F5F5F4] disabled:opacity-50 font-bold text-xs uppercase tracking-widest transition shadow-xs"
          >
            {isReviewing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#1C1917]" />
                <span>Auditando Obra...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-[#1C1917]" />
                <span>Refazer Auditoria</span>
              </>
            )}
          </button>

          {report && (
            <button
              onClick={() => onApplyReviewImprovements()}
              disabled={isApplyingReview || isReviewing}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-[#1C1917] hover:bg-[#44403C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest transition shadow-md"
            >
              {isApplyingReview ? (
                <>
                  <Wand2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Aplicando Melhorias na Obra...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Aplicar Melhorias na Obra (IA)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Obsolete Warning Banner */}
      {report?.obsoleto && (
        <div className="bg-amber-50 border border-amber-300 p-4 text-amber-900 flex items-center justify-between text-xs font-serif">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <span>
              <strong>Atenção:</strong> O texto do livro foi editado após esta auditoria. Clique em
              "Refazer Auditoria" para atualizar as notas e os localizadores.
            </span>
          </div>
          <button
            onClick={onRunReview}
            disabled={isReviewing}
            className="px-3 py-1 bg-amber-800 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-amber-900"
          >
            Atualizar
          </button>
        </div>
      )}

      {!report ? (
        <div className="bg-white border border-[#E7E5E4] p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-[#F5F5F4] border border-[#E7E5E4] mx-auto flex items-center justify-center font-serif text-2xl font-bold italic text-[#1C1917]">
            R
          </div>
          <h2 className="text-lg font-serif italic font-bold text-[#1C1917]">
            Nenhuma Auditoria Realizada Ainda
          </h2>
          <p className="text-xs text-[#57534E] max-w-md mx-auto font-serif">
            Gere os capítulos do seu livro e execute a auditoria para obter a nota de qualidade,
            identificação de incoerências e recomendações de polimento.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Quick Apply Callout */}
          <div className="bg-[#1C1917] text-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-l-4 border-amber-400 shadow-sm">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start space-x-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Aprimoramento Automático com IA</span>
              </div>
              <h3 className="font-serif italic font-bold text-base text-white">
                Deseja aplicar as correções sugeridas aos capítulos?
              </h3>
              <p className="text-xs text-stone-300 font-serif">
                A IA reescreverá e polirá as unidades auditadas preservando o estilo do autor e
                gerando histórico de versões.
              </p>
            </div>
            <button
              onClick={() => onApplyReviewImprovements()}
              disabled={isApplyingReview || isReviewing}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-[#1C1917] font-bold text-xs uppercase tracking-widest transition shadow-xs flex-shrink-0 flex items-center space-x-2"
            >
              <Wand2 className={`w-4 h-4 ${isApplyingReview ? 'animate-spin' : ''}`} />
              <span>{isApplyingReview ? 'Reescrevendo...' : 'Aplicar Melhorias Agora'}</span>
            </button>
          </div>

          {/* Score & Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score Card */}
            <div className="bg-white border border-[#E7E5E4] p-6 text-center flex flex-col justify-center space-y-2">
              <span className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-[0.2em]">
                Índice Geral de Qualidade
              </span>
              <div className="text-5xl font-serif italic font-bold text-[#1C1917]">
                {report.notaGeral}
                <span className="text-xl text-[#78716C] font-normal">/100</span>
              </div>
              <div className="text-[10px] text-emerald-800 font-mono font-bold bg-emerald-50 border border-emerald-200 py-1 px-2 rounded-xs mt-1 inline-block">
                Cobertura Auditada: {report.coberturaTotalUnidadesPercent || 100}% das unidades
              </div>
            </div>

            {/* Strengths Card */}
            <div className="bg-white border border-[#E7E5E4] p-6 space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A8A29E] flex items-center space-x-1.5 border-b border-[#F5F5F4] pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Pontos Fortes Identificados</span>
              </h3>
              <ul className="text-xs text-[#44403C] space-y-1.5 list-disc list-inside font-serif">
                {report.pontosFortes?.map((ponto, i) => (
                  <li key={i}>{ponto}</li>
                ))}
              </ul>
            </div>

            {/* Global Suggestions Card */}
            <div className="bg-white border border-[#E7E5E4] p-6 space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A8A29E] flex items-center space-x-1.5 border-b border-[#F5F5F4] pb-2">
                <BarChart2 className="w-4 h-4 text-[#1C1917]" />
                <span>Recomendações de Polimento</span>
              </h3>
              <ul className="text-xs text-[#44403C] space-y-1.5 list-disc list-inside font-serif">
                {report.sugestoesGlobais?.map((sug, i) => (
                  <li key={i}>{sug}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Modalities Breakdown Grid */}
          <div className="bg-white border border-[#E7E5E4] p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1917] flex items-center space-x-2 border-b border-[#E7E5E4] pb-3">
              <Layers className="w-4 h-4 text-[#1C1917]" />
              <span>Avaliação por Modalidade Editorial</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-serif">
              {(report.modalidades || []).map((m, idx) => (
                <div key={idx} className="bg-[#FDFCFB] border border-[#E7E5E4] p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold capitalize text-[#1C1917]">{m.categoria}</span>
                    <span className="font-mono font-bold text-[#1C1917]">{m.nota}/100</span>
                  </div>
                  <p className="text-[11px] text-[#57534E] leading-snug">{m.resumo}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Evaluative Summary */}
          <div className="bg-white border border-[#E7E5E4] p-6 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
              Parecer Geral da Junta Editorial
            </h3>
            <p className="text-xs text-[#44403C] leading-relaxed font-serif">
              {report.resumoAvaliatorio}
            </p>
          </div>

          {/* Problems Table */}
          <div className="bg-white border border-[#E7E5E4] p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
              <h3 className="text-base font-serif italic font-bold text-[#1C1917] flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-[#1C1917]" />
                <span>
                  Oportunidades de Melhoria Encontradas ({report.problemasDetectados?.length || 0})
                </span>
              </h3>
              <button
                onClick={() => onApplyReviewImprovements()}
                disabled={isApplyingReview || isReviewing}
                className="text-xs font-bold text-[#1C1917] hover:underline flex items-center space-x-1"
              >
                <Wand2
                  className={`w-3.5 h-3.5 ${isApplyingReview ? 'animate-spin text-amber-500' : ''}`}
                />
                <span>
                  {isApplyingReview
                    ? typeof generatingIndex === 'number'
                      ? `Reescrevendo Cap. ${generatingIndex + 1}...`
                      : 'Aplicando Correções...'
                    : 'Aplicar Todas as Correções'}
                </span>
              </button>
            </div>

            <div className="space-y-4">
              {report.problemasDetectados?.map((prob, idx) => {
                const isHigh = prob.severidade === 'Alta';
                const isMed = prob.severidade === 'Média';
                const capIdx = getChapterIndexFromFinding(prob);

                return (
                  <div
                    key={prob.id || idx}
                    className="bg-[#FDFCFB] border border-[#E7E5E4] p-4 sm:p-5 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#1C1917] font-serif italic">
                          {prob.unitTitle}
                        </span>
                        <span className="text-[#A8A29E]">•</span>
                        <span className="text-[#57534E] font-medium capitalize">{prob.tipo}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 font-mono font-bold text-[10px] uppercase border ${
                            isHigh
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : isMed
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-[#F5F5F4] text-[#44403C] border-[#D6D3D1]'
                          }`}
                        >
                          Severidade {prob.severidade}
                        </span>

                        {capIdx !== null && (
                          <button
                            onClick={() => onApplyReviewImprovements(capIdx)}
                            disabled={isApplyingReview}
                            className="px-2.5 py-1 bg-[#1C1917] hover:bg-[#44403C] text-white font-bold text-[10px] uppercase tracking-wider transition flex items-center space-x-1"
                          >
                            <Wand2 className="w-3 h-3 text-amber-400" />
                            <span>Aprimorar Cap. {capIdx + 1}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[#44403C] leading-relaxed font-serif">{prob.descricao}</p>

                    <div className="bg-white border border-[#E7E5E4] p-3 text-[#44403C] font-serif">
                      <strong className="text-[#1C1917] block mb-1 font-sans text-[10px] uppercase tracking-wider">
                        Sugestão de Correção Editorial:
                      </strong>
                      <span>{prob.sugestaoDeCorrecao}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
