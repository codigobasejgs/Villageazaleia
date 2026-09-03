import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Rede de seguranca contra tela branca. Antes disso, qualquer excecao nao
 * tratada em qualquer tela (ex: acesso a propriedade de dado ainda nao
 * carregado) derrubava a arvore inteira do React sem nenhum aviso visivel —
 * o usuario via a pagina em branco e nao havia pista do que aconteceu.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  // Redeclarados explicitamente: o projeto nao tem @types/react instalado, entao o
  // namespace React resolve como `any` e o TS nao enxerga os membros herdados de
  // React.Component (props/setState) — sem isso o typecheck falha nesta classe.
  declare props: { children: React.ReactNode };
  declare setState: (state: Partial<ErrorBoundaryState>) => void;
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Excecao nao tratada:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
          <div className="max-w-sm w-full bg-white rounded-3xl border-2 border-[#D4AF37] shadow-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#0D3823]">Algo deu errado</h2>
              <p className="text-xs text-slate-500 mt-1">
                Um erro inesperado interrompeu a tela. Recarregar geralmente resolve.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0D3823] via-[#15462D] to-[#0D3823] text-[#FFF2B2] font-black text-xs shadow-lg border border-[#D4AF37] flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recarregar</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
