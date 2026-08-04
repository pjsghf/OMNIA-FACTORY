import React from 'react';
import {
  Wand2,
  Cpu,
  Bot,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  BookOpen,
  Layers,
  Award,
  Terminal,
} from 'lucide-react';
import { TelemetryState } from '../lib/pipeline/autonomousPipeline';

interface AutonomousPipelineModalProps {
  isOpen: boolean;
  telemetry: TelemetryState;
  onCancel: () => void;
  onMinimize: () => void;
}

export const AutonomousPipelineModal: React.FC<AutonomousPipelineModalProps> = ({
  isOpen,
  telemetry,
  onCancel,
  onMinimize,
}) => {
  if (!isOpen) return null;

  const isCompleted = telemetry.step === 'completed';
  const isFailed = telemetry.step === 'failed';

  const stepsList = [
    { label: '1. Planejamento Editorial', stepKey: 'planning' },
    { label: '2. Elementos Pré-Textuais', stepKey: 'front_matter' },
    { label: '3. Redação dos Capítulos', stepKey: 'writing_chapters' },
    { label: '4. Elementos Pós-Textuais', stepKey: 'end_matter' },
    { label: '5. Auditoria & Autocorreção', stepKey: 'review_audit' },
    { label: '6. Finalização & Publicação', stepKey: 'completed' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-[#0F172A] border border-slate-700 text-slate-100 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="bg-[#1E293B] border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                  Piloto Automático OMNIA — Produção de E-book
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold uppercase tracking-wider">
                  ● 1-CLIQUE AUTO
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Executando pipeline autônomo de planejamento, redação, revisão e publicação.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onMinimize}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded border border-slate-600 transition"
              title="Continuar em segundo plano"
            >
              Minimizar
            </button>

            {!isCompleted && !isFailed && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 text-xs font-mono rounded transition flex items-center space-x-1"
                title="Cancelar Execução"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Dashboard Grid */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Progress Bar & Stage Banner */}
          <div className="bg-[#1E293B]/60 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-2">
                <Wand2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>{telemetry.stepLabel}</span>
              </span>
              <span className="font-mono font-bold text-slate-300">
                {telemetry.stepProgress}% CONCLUÍDO
              </span>
            </div>

            {/* Main Progress Bar */}
            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${telemetry.stepProgress}%` }}
              />
            </div>

            <p className="text-xs text-slate-300 italic font-serif">"{telemetry.statusMessage}"</p>
          </div>

          {/* Real-Time Telemetry Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center space-x-1">
                <Bot className="w-3 h-3 text-sky-400" />
                <span>Agente Ativo</span>
              </span>
              <p className="font-bold text-slate-200 truncate">{telemetry.activeAgent}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-amber-400" />
                <span>Provedor / Modelo</span>
              </span>
              <p className="font-bold text-slate-200 truncate">
                {telemetry.provider} ({telemetry.activeModel.split('/')[1] || telemetry.activeModel}
                )
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center space-x-1">
                <FileText className="w-3 h-3 text-emerald-400" />
                <span>Volume de Palavras</span>
              </span>
              <p className="font-bold text-emerald-300">
                {telemetry.currentWordCount.toLocaleString('pt-BR')}{' '}
                <span className="text-[10px] text-slate-400">palavras</span>
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center space-x-1">
                <Award className="w-3 h-3 text-purple-400" />
                <span>Nota da Auditoria</span>
              </span>
              <p className="font-bold text-purple-300">
                {telemetry.currentScore !== undefined
                  ? `${telemetry.currentScore.toFixed(1)} / 10`
                  : 'Em Análise...'}
              </p>
            </div>
          </div>

          {/* Checklist of Steps */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
              Etapas do Pipeline Autônomo
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {stepsList.map((st, idx) => {
                const stepNum = idx + 1;
                const isCurrent = telemetry.currentStepIndex === stepNum;
                const isDone = telemetry.currentStepIndex > stepNum || isCompleted;

                return (
                  <div
                    key={st.stepKey}
                    className={`flex items-center space-x-2.5 p-2 rounded border transition ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : isDone
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                          : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <Wand2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 text-[10px] font-mono flex items-center justify-center shrink-0 text-slate-500">
                        {stepNum}
                      </div>
                    )}
                    <span className="font-medium text-xs truncate">{st.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal Log Stream */}
          <div className="bg-[#090D16] border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span className="flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Log de Execução ao Vivo</span>
              </span>
              <span>{telemetry.logs.length} eventos</span>
            </div>

            <div className="h-32 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300">
              {telemetry.logs.map((log, idx) => (
                <div key={idx} className="truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#1E293B] border-t border-slate-700 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
          <span>OMNIA Autonomous Publishing Engine v2.5</span>
          {isCompleted && (
            <span className="text-emerald-400 font-bold font-mono flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Publicação Autônoma Concluída!</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
