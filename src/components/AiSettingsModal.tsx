import React, { useState } from 'react';
import { Sparkles, Key, Cpu, Check, X, ShieldCheck, Globe, Zap } from 'lucide-react';
import { AiConfig } from '../types';
import { OPENCODE_DEFAULT_BASE_URL } from '../lib/ai/catalog';

interface AiSettingsModalProps {
  config: AiConfig;
  onSave: (config: AiConfig) => void;
  onClose: () => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ config, onSave, onClose }) => {
  const [provider, setProvider] = useState<'gemini' | 'opencode'>(config.provider || 'gemini');
  const [geminiModel, setGeminiModel] = useState<string>(config.geminiModel || 'gemini-2.5-flash');
  const [opencodeApiKey, setOpencodeApiKey] = useState<string>(config.opencodeApiKey || '');
  const [opencodeBaseUrl, setOpencodeBaseUrl] = useState<string>(
    config.opencodeBaseUrl || OPENCODE_DEFAULT_BASE_URL
  );
  const [opencodeModel, setOpencodeModel] = useState<string>(
    config.opencodeModel || 'opencode/claude-3-5-sonnet'
  );
  const [customOpencodeModel, setCustomOpencodeModel] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  // Stable, long-standing ids first: these are the ones known to exist upstream.
  // The newer entries are kept selectable but flagged, because an id that the API
  // does not recognise fails every generation in the app.
  const geminiModels = [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Padrão — Rápido e Estável)' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Análise Avançada)' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (verifique disponibilidade na sua conta)' },
    {
      id: 'gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro (verifique disponibilidade na sua conta)',
    },
  ];

  const opencodeModels = [
    { id: 'opencode/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Anthropic - Recomendado)' },
    { id: 'opencode/gpt-4o', label: 'GPT-4o (OpenAI - Alta Inteligência)' },
    { id: 'opencode/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Google via OpenCode)' },
    { id: 'opencode/deepseek-r1', label: 'DeepSeek R1 (Raciocínio Matemático e Lógico)' },
    { id: 'opencode/llama-3.3-70b', label: 'Llama 3.3 70B (Meta Open Source)' },
    { id: 'custom', label: 'Outro Modelo Personalizado...' },
  ];

  const handleSave = () => {
    const finalOpencodeModel = opencodeModel === 'custom' ? customOpencodeModel : opencodeModel;

    onSave({
      provider,
      geminiModel,
      opencodeApiKey,
      opencodeBaseUrl,
      opencodeModel: finalOpencodeModel || 'opencode/claude-3-5-sonnet',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E7E5E4] w-full max-w-2xl p-6 shadow-2xl space-y-6 text-[#1C1917]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-[#1C1917]" />
            <div>
              <h3 className="font-serif italic font-bold text-base">
                Configurações de Inteligência Artificial
              </h3>
              <p className="text-[10px] uppercase tracking-wider text-[#78716C]">
                Selecione o provedor de IA (Gemini / OpenCode GO) e os modelos ativos
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F5F5F4] text-[#78716C] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider Switch Tabs */}
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#A8A29E]">
            Provedor de IA para Redação
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setProvider('gemini')}
              className={`p-4 border text-left transition flex items-start space-x-3 ${
                provider === 'gemini'
                  ? 'bg-[#1C1917] text-white border-[#1C1917]'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C] hover:border-[#D6D3D1]'
              }`}
            >
              <Sparkles className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-sm">Google Gemini</div>
                <div className="text-xs opacity-80 mt-0.5">
                  Provedor oficial nativo. Modelos Flash & Pro otimizados para produção editorial.
                </div>
              </div>
            </button>

            <button
              onClick={() => setProvider('opencode')}
              className={`p-4 border text-left transition flex items-start space-x-3 ${
                provider === 'opencode'
                  ? 'bg-[#1C1917] text-white border-[#1C1917]'
                  : 'bg-[#FDFCFB] border-[#E7E5E4] text-[#44403C] hover:border-[#D6D3D1]'
              }`}
            >
              <Globe className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-sm">OpenCode GO / Externa</div>
                <div className="text-xs opacity-80 mt-0.5">
                  Conecte chaves de API externas via OpenCode GO, Claude, OpenAI ou OpenRouter.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Gemini Settings */}
        {provider === 'gemini' && (
          <div className="bg-[#FDFCFB] border border-[#E7E5E4] p-4 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#1C1917]">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>Modelos Google Gemini Disponíveis</span>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wider text-[#78716C]">
                Selecione o Modelo Gemini Ativo:
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full bg-white border border-[#E7E5E4] p-2.5 text-xs text-[#1C1917] font-medium"
              >
                {geminiModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-start space-x-2 text-[11px] text-[#78716C] bg-white p-3 border border-[#E7E5E4]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                A chave de API do Gemini está configurada de forma segura no servidor da aplicação.
                Não é necessário inserir chaves manualmente para o Google Gemini.
              </span>
            </div>
          </div>
        )}

        {/* OpenCode GO / External Settings */}
        {provider === 'opencode' && (
          <div className="bg-[#FDFCFB] border border-[#E7E5E4] p-4 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#1C1917]">
              <Key className="w-4 h-4 text-[#1C1917]" />
              <span>Configurações OpenCode GO / Provedor Externo</span>
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-[#78716C]">
                Chave de API (API Key OpenCode GO / OpenRouter / OpenAI):
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={opencodeApiKey}
                  onChange={(e) => setOpencodeApiKey(e.target.value)}
                  placeholder="Insira sua chave de API..."
                  className="w-full bg-white border border-[#E7E5E4] p-2.5 text-xs text-[#1C1917] font-mono pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-2 px-2 py-1 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[10px] uppercase tracking-wider text-[#44403C]"
                >
                  {showKey ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-[#78716C]">
                URL Base do Provedor (Base URL):
              </label>
              <input
                type="text"
                value={opencodeBaseUrl}
                onChange={(e) => setOpencodeBaseUrl(e.target.value)}
                placeholder={`${OPENCODE_DEFAULT_BASE_URL} ou https://openrouter.ai/api/v1`}
                className="w-full bg-white border border-[#E7E5E4] p-2.5 text-xs text-[#1C1917] font-mono"
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-wider text-[#78716C]">
                Selecione o Modelo de IA Externa:
              </label>
              <select
                value={opencodeModel}
                onChange={(e) => setOpencodeModel(e.target.value)}
                className="w-full bg-white border border-[#E7E5E4] p-2.5 text-xs text-[#1C1917] font-medium"
              >
                {opencodeModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {opencodeModel === 'custom' && (
              <div className="space-y-1">
                <label className="block text-[10px] uppercase tracking-wider text-[#78716C]">
                  ID do Modelo Personalizado (ex: anthropic/claude-3-opus):
                </label>
                <input
                  type="text"
                  value={customOpencodeModel}
                  onChange={(e) => setCustomOpencodeModel(e.target.value)}
                  placeholder="Nome do modelo..."
                  className="w-full bg-white border border-[#E7E5E4] p-2.5 text-xs text-[#1C1917] font-mono"
                />
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E7E5E4]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#44403C] text-xs font-medium uppercase tracking-wider"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#1C1917] hover:bg-[#44403C] text-white text-xs font-bold uppercase tracking-widest transition flex items-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>Salvar Configurações</span>
          </button>
        </div>
      </div>
    </div>
  );
};
