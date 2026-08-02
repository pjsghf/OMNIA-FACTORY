import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error Boundary:', error, errorInfo);
  }

  private handleDownloadDiagnostics = () => {
    const data = {
      timestamp: new Date().toISOString(),
      errorName: this.state.error?.name,
      errorMessage: this.state.error?.message,
      stack: this.state.error?.stack,
      localStorage: { ...localStorage },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnia-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6 text-[#1C1917]">
          <div className="bg-white border border-rose-300 p-8 max-w-xl w-full shadow-lg space-y-6">
            <div className="flex items-center space-x-3 text-rose-800 border-b border-rose-100 pb-4">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
              <div>
                <h2 className="font-serif italic font-bold text-xl">Ocorreu um Erro Inesperado</h2>
                <p className="text-xs text-rose-700 font-mono">Falha de Renderização do Domínio</p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono bg-rose-50 border border-rose-200 p-4 rounded-xs overflow-x-auto max-h-40">
              <p className="font-bold text-rose-900">{this.state.error?.name}: {this.state.error?.message}</p>
            </div>

            <p className="text-xs text-[#57534E] font-serif leading-relaxed">
              Sua obra e dados locais foram preservados. Você pode baixar um arquivo de diagnóstico técnico para auditoria ou recarregar a interface.
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-[#E7E5E4]">
              <button
                onClick={this.handleDownloadDiagnostics}
                className="px-4 py-2.5 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#1C1917] font-bold text-xs uppercase tracking-wider transition flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Diagnóstico</span>
              </button>

              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-[#1C1917] hover:bg-[#44403C] text-white font-bold text-xs uppercase tracking-widest transition flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar Aplicação</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
