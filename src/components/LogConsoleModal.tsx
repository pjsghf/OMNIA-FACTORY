import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  X,
  Copy,
  Check,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Info,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export interface LogItem {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'HTTP';
  source: 'client' | 'server';
  message: string;
  context?: Record<string, any>;
}

interface LogConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogConsoleModal: React.FC<LogConsoleModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Poll server logs & sync client logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/system/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          const serverLogs: LogItem[] = data.logs.map((item: any) => {
            let categoryLevel: 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'HTTP' = item.level || 'INFO';
            if (item.message?.includes('HTTP')) categoryLevel = 'HTTP';
            if (item.message?.includes('IA') || item.message?.includes('Provedor'))
              categoryLevel = 'AI';
            if (item.level === 'ERROR') categoryLevel = 'ERROR';

            return {
              id: item.id || `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              timestamp: item.timestamp || new Date().toISOString(),
              level: categoryLevel,
              source: 'server',
              message: item.message,
              context: item.context || item,
            };
          });

          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newEntries = serverLogs.filter((l) => !existingIds.has(l.id));
            if (newEntries.length === 0) return prev;
            return [...prev, ...newEntries].slice(-300);
          });
        }
      }
    } catch {
      // Quiet fail on network disconnect
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const formattedText = logs
      .map((l) => {
        const ctxStr =
          l.context && Object.keys(l.context).length > 0
            ? ` | Context: ${JSON.stringify(l.context)}`
            : '';
        return `[${l.timestamp}] [${l.level}] [${l.source.toUpperCase()}] ${l.message}${ctxStr}`;
      })
      .join('\n');

    navigator.clipboard.writeText(formattedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownload = () => {
    const formattedText = logs
      .map((l) => {
        const ctxStr =
          l.context && Object.keys(l.context).length > 0
            ? ` | Context: ${JSON.stringify(l.context)}`
            : '';
        return `[${l.timestamp}] [${l.level}] [${l.source.toUpperCase()}] ${l.message}${ctxStr}`;
      })
      .join('\n');

    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnia-factory-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    setLogs([]);
    try {
      await fetch('/api/system/logs', { method: 'DELETE' });
    } catch {
      // Quiet fail
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (filterLevel === 'ERROR' && l.level !== 'ERROR') return false;
    if (filterLevel === 'AI' && l.level !== 'AI') return false;
    if (filterLevel === 'HTTP' && l.level !== 'HTTP') return false;
    if (filterLevel === 'WARN' && l.level !== 'WARN') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = l.message.toLowerCase().includes(q);
      const matchCtx = JSON.stringify(l.context || {})
        .toLowerCase()
        .includes(q);
      return matchMsg || matchCtx;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        className={`bg-[#0F172A] border border-slate-700 text-slate-100 rounded-lg shadow-2xl flex flex-col transition-all duration-200 ${
          isExpanded ? 'w-full h-full' : 'w-full max-w-5xl h-[85vh]'
        }`}
      >
        {/* Header Bar */}
        <div className="bg-[#1E293B] border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-mono text-sm font-bold text-slate-100 tracking-wide">
                  Console de Logs e Diagnóstico em Tempo Real
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-semibold">
                  ● LIVE ({logs.length} registros)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Monitore requisições de IA, rotas HTTP, erros e métricas do sistema.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
              title={isExpanded ? 'Restaurar tamanho' : 'Maximizar'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
              title="Fechar Console"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-[#0F172A] border-b border-slate-800 p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-mono">
            <span className="text-slate-400 text-[11px] mr-1 flex items-center">
              <Filter className="w-3 h-3 mr-1" /> Nível:
            </span>
            {['ALL', 'ERROR', 'AI', 'HTTP', 'WARN'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded transition text-[11px] font-semibold ${
                  filterLevel === lvl
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {lvl === 'ALL' ? 'Todos' : lvl}
              </button>
            ))}
          </div>

          {/* Search Box & Actions */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no log (ex: timeout, 500)..."
                className="w-full bg-[#1E293B] border border-slate-700 rounded pl-8 pr-3 py-1 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded transition flex items-center space-x-1.5 shadow-xs ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
              title="Copiar todo o histórico de log formatado para colar no chat"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Logs</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
              title="Baixar arquivo .txt de logs"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleClear}
              className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 rounded transition"
              title="Limpar Histórico"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log Viewer Terminal Box */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 bg-[#090D16] text-slate-300 select-text font-mono leading-relaxed"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
              <Terminal className="w-8 h-8 text-slate-600" />
              <p>Nenhum log encontrado para os filtros selecionados.</p>
            </div>
          ) : (
            filteredLogs.map((item) => {
              const isErr = item.level === 'ERROR';
              const isAi = item.level === 'AI';
              const isHttp = item.level === 'HTTP';
              const isWarn = item.level === 'WARN';

              return (
                <div
                  key={item.id}
                  className={`p-2 rounded border transition-all ${
                    isErr
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                      : isWarn
                        ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                        : isAi
                          ? 'bg-purple-950/30 border-purple-800/50 text-purple-200'
                          : isHttp
                            ? 'bg-slate-900 border-slate-800 text-sky-200'
                            : 'bg-slate-900/50 border-slate-800/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 flex-wrap font-mono text-[11px]">
                      <span className="text-slate-500">[{item.timestamp.slice(11, 19)}]</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isErr
                            ? 'bg-rose-600 text-white'
                            : isWarn
                              ? 'bg-amber-500 text-slate-950'
                              : isAi
                                ? 'bg-purple-600 text-white'
                                : isHttp
                                  ? 'bg-sky-700 text-white'
                                  : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {item.level}
                      </span>
                      <span className="text-slate-400 font-semibold">{item.message}</span>
                    </div>
                  </div>

                  {item.context && Object.keys(item.context).length > 0 && (
                    <div className="mt-1.5 pl-3 border-l border-slate-700 text-[10px] text-slate-400 overflow-x-auto">
                      <pre className="whitespace-pre-wrap font-mono">
                        {JSON.stringify(item.context, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bar */}
        <div className="bg-[#1E293B] border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 font-mono flex-shrink-0">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-amber-400 rounded"
              />
              <span>Rolar automaticamente (Auto-Scroll)</span>
            </label>
          </div>

          <div className="text-slate-500">
            Dica: Clique em <strong>Copiar Logs</strong> e cole o texto no chat para rápida
            resolução de problemas.
          </div>
        </div>
      </div>
    </div>
  );
};
