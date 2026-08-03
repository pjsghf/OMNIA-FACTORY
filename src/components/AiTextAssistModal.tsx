import React, { useState } from 'react';
import { X, Sparkles, Wand2, Check } from 'lucide-react';

interface AiTextAssistModalProps {
  initialText: string;
  initialAction: string;
  onApply: (replacementText: string) => void;
  onClose: () => void;
  language?: string;
}

export const AiTextAssistModal: React.FC<AiTextAssistModalProps> = ({
  initialText,
  initialAction,
  onApply,
  onClose,
  language = 'Português',
}) => {
  const [action, setAction] = useState<string>(initialAction || 'expand');
  const tone = 'didático e envolvente';
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>('');

  const runAssist = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/editorial/text-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          text: initialText,
          tone,
          language,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResultText(data.result);
      } else {
        alert(data.error || 'Erro no assistente de texto.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com o servidor de IA.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E7E5E4] w-full max-w-2xl p-6 shadow-xl space-y-6 text-[#1C1917]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#1C1917]" />
            <h3 className="font-serif italic font-bold text-base text-[#1C1917]">
              Assistente de Redação Inteligente
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F5F5F4] text-[#78716C]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Options */}
        <div className="space-y-3">
          <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A8A29E]">
            Escolha a Ação Editorial
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-serif italic">
            <button
              onClick={() => setAction('expand')}
              className={`p-2.5 border text-center transition ${
                action === 'expand'
                  ? 'bg-[#1C1917] border-[#1C1917] text-white font-bold'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C]'
              }`}
            >
              Expandir Trecho
            </button>
            <button
              onClick={() => setAction('polish')}
              className={`p-2.5 border text-center transition ${
                action === 'polish'
                  ? 'bg-[#1C1917] border-[#1C1917] text-white font-bold'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C]'
              }`}
            >
              Polir & Elegância
            </button>
            <button
              onClick={() => setAction('fixGrammar')}
              className={`p-2.5 border text-center transition ${
                action === 'fixGrammar'
                  ? 'bg-[#1C1917] border-[#1C1917] text-white font-bold'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C]'
              }`}
            >
              Corrigir Gramática
            </button>
            <button
              onClick={() => setAction('addExample')}
              className={`p-2.5 border text-center transition ${
                action === 'addExample'
                  ? 'bg-[#1C1917] border-[#1C1917] text-white font-bold'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C]'
              }`}
            >
              Adicionar Exemplo
            </button>
            <button
              onClick={() => setAction('changeTone')}
              className={`p-2.5 border text-center transition ${
                action === 'changeTone'
                  ? 'bg-[#1C1917] border-[#1C1917] text-white font-bold'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C]'
              }`}
            >
              Ajustar Tom
            </button>
            <button
              onClick={() => setAction('summarize')}
              className={`p-2.5 border text-center transition ${
                action === 'summarize'
                  ? 'bg-[#1C1917] border-[#1C1917] text-white font-bold'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C]'
              }`}
            >
              Sintetizar
            </button>
          </div>
        </div>

        {/* Text comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="block font-semibold text-[10px] uppercase tracking-wider text-[#A8A29E] mb-1">
              Texto Original Selecionado:
            </span>
            <div className="bg-[#FDFCFB] border border-[#E7E5E4] p-3 h-40 overflow-y-auto text-[#44403C] font-serif leading-relaxed">
              {initialText}
            </div>
          </div>

          <div>
            <span className="block font-semibold text-[10px] uppercase tracking-wider text-[#1C1917] mb-1">
              Sugestão Aprimorada pela IA:
            </span>
            <div className="bg-[#FDFCFB] border border-[#E7E5E4] p-3 h-40 overflow-y-auto text-[#1C1917] font-serif leading-relaxed">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-[#A8A29E] space-y-2">
                  <Wand2 className="w-6 h-6 animate-spin" />
                  <span className="font-serif italic text-xs">Aprimorando texto...</span>
                </div>
              ) : (
                resultText || 'Clique em Processar para ver o resultado.'
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E7E5E4]">
          <button
            onClick={runAssist}
            disabled={isLoading}
            className="px-5 py-2.5 bg-[#1C1917] hover:bg-[#44403C] text-white text-xs uppercase tracking-widest font-bold transition flex items-center space-x-2"
          >
            <Wand2 className="w-4 h-4" />
            <span>Processar com IA</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#44403C] text-xs font-medium uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (resultText) {
                  onApply(resultText);
                  onClose();
                }
              }}
              disabled={!resultText}
              className="px-5 py-2.5 bg-[#1C1917] hover:bg-[#44403C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest transition flex items-center space-x-1"
            >
              <Check className="w-4 h-4" />
              <span>Substituir no Editor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
