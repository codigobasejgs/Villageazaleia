import React, { useEffect, useRef, useState } from 'react';
import { AppRole } from '../../types';
import { Shield, Smartphone, Box, BarChart3, Volume2, VolumeX, Download, Check, LogOut, Menu, X } from 'lucide-react';
import { sound } from '../../utils/audio';
import { VillageAzaleiaLogo } from '../VillageAzaleiaLogo';
import { usePwaInstall } from '../../hooks/usePwaInstall';

const ROLE_META: Record<AppRole, { label: string; icon: React.ReactNode }> = {
  portaria: { label: 'Portaria / Recepção', icon: <Shield className="w-4 h-4" /> },
  morador: { label: 'PWA Morador', icon: <Smartphone className="w-4 h-4" /> },
  totem: { label: 'Totem Entregador', icon: <Box className="w-4 h-4" /> },
  sindico: { label: 'Painel Síndico', icon: <BarChart3 className="w-4 h-4" /> }
};

interface AppShellProps {
  role: AppRole;
  displayName: string;
  pendingCount?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  /** Omit for unauthenticated kiosk mode (Totem) — hides the "Sair" action. */
  onLogout?: () => void;
  children: React.ReactNode;
}

/**
 * Chrome fixo do app: sidebar lateral no desktop, gaveta deslizante no mobile.
 * Não existe navegação entre papéis aqui de propósito (cada sessão vê só o seu papel) —
 * a sidebar só carrega identidade (logo/papel/nome) e ações globais (instalar, som, sair).
 * Cada tela (Síndico, Portaria, Morador) organiza seu próprio conteúdo em abas internas.
 */
export const AppShell: React.FC<AppShellProps> = ({
  role,
  displayName,
  pendingCount = 0,
  soundEnabled,
  onToggleSound,
  onLogout,
  children
}) => {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const meta = ROLE_META[role];

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDrawerOpen]);

  const handleInstallClick = async () => {
    setIsDrawerOpen(false);
    if (!isInstallable) return;
    sound.playScanBeep();
    const outcome = await promptInstall();
    if (outcome === 'accepted') sound.playSuccess();
  };

  const handleToggleSound = () => {
    onToggleSound();
    setIsDrawerOpen(false);
  };

  const handleLogoutClick = () => {
    setIsDrawerOpen(false);
    sound.playScanBeep();
    onLogout?.();
  };

  // Conteúdo comum da identidade — reaproveitado na sidebar desktop e na gaveta mobile
  const NavItems = ({ compact = false }: { compact?: boolean }) => (
    <>
      {isInstalled ? (
        <div
          className={`flex items-center gap-2.5 text-emerald-200 ${compact ? 'w-full px-4 py-3 text-xs font-bold' : 'w-11 h-11 justify-center rounded-xl bg-white/5'}`}
          title="App instalado"
        >
          <Check className="w-4 h-4 text-[#D4AF37]" />
          {compact && <span>App instalado</span>}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          title={isInstallable ? 'Instalar o app na tela inicial' : 'No iPhone: Compartilhar → Adicionar à Tela de Início'}
          className={`flex items-center gap-2.5 text-white transition-all ${
            compact
              ? 'w-full px-4 py-3 text-xs font-bold hover:bg-white/5'
              : 'w-11 h-11 justify-center rounded-xl bg-white/5 hover:bg-white/10'
          }`}
        >
          <Download className="w-4 h-4 text-[#D4AF37]" />
          {compact && <span>{isInstallable ? 'Instalar aplicativo' : 'Como instalar'}</span>}
        </button>
      )}

      <button
        type="button"
        onClick={handleToggleSound}
        title={soundEnabled ? 'Silenciar sons' : 'Ativar sons'}
        className={`flex items-center gap-2.5 text-white transition-all ${
          compact
            ? 'w-full px-4 py-3 text-xs font-bold hover:bg-white/5'
            : 'w-11 h-11 justify-center rounded-xl bg-white/5 hover:bg-white/10'
        }`}
      >
        {soundEnabled ? <Volume2 className="w-4 h-4 text-[#D4AF37]" /> : <VolumeX className="w-4 h-4 text-emerald-300/50" />}
        {compact && <span>{soundEnabled ? 'Silenciar sons' : 'Ativar sons'}</span>}
      </button>

      {onLogout && (
        <button
          type="button"
          onClick={handleLogoutClick}
          className={`flex items-center gap-2.5 text-red-300 transition-all ${
            compact ? 'w-full px-4 py-3 text-xs font-bold hover:bg-red-500/10' : 'w-11 h-11 justify-center rounded-xl bg-white/5 hover:bg-red-500/20'
          }`}
        >
          <LogOut className="w-4 h-4" />
          {compact && <span>Sair da conta</span>}
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] text-[#1A2E22] font-sans antialiased selection:bg-[#D81B60] selection:text-white">
      {/* Sidebar fixa — desktop */}
      <aside className="hidden md:flex md:flex-col w-20 shrink-0 bg-[#061D12] border-r border-[#D4AF37]/25 py-5">
        <div className="flex flex-col items-center gap-1 pb-5 border-b border-white/10 mx-3">
          <div className="relative w-11 h-11 rounded-2xl bg-white/10 border border-[#D4AF37]/40 flex items-center justify-center shadow-inner">
            <VillageAzaleiaLogo variant="icon" size="sm" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D81B60] text-white text-[10px] font-black flex items-center justify-center ring-2 ring-[#061D12]">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-white/70" title={meta.label}>
            {meta.icon}
          </span>
        </div>

        <nav className="flex-1 flex flex-col items-center gap-2 pt-5">
          <NavItems />
        </nav>

        <div className="px-2 pt-3 border-t border-white/10 mx-3 text-center">
          <span className="text-[9px] text-emerald-100/60 font-semibold leading-tight block truncate" title={displayName}>
            {displayName.split(' ')[0]}
          </span>
        </div>
      </aside>

      {/* Coluna principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top strip — só mobile: hambúrguer + identidade */}
        <header className="md:hidden sticky top-0 z-40 bg-[#061D12]/95 backdrop-blur-md border-b border-[#D4AF37]/30 shadow-lg">
          <div className="px-4 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Abrir menu"
              className="p-2 -ml-2 rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md text-[11px] font-bold shrink-0">
                {meta.icon}
                <span>{meta.label}</span>
                {pendingCount > 0 && (
                  <span className="ml-0.5 px-1.5 rounded-full bg-white text-[#AD1457] text-[10px] font-black">{pendingCount}</span>
                )}
              </span>
            </div>

            <VillageAzaleiaLogo variant="icon" size="sm" />
          </div>
        </header>

        {/* Conteúdo da tela */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Gaveta deslizante — mobile */}
      {isDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            ref={drawerRef}
            className="w-72 max-w-[80vw] h-full bg-[#061D12] shadow-2xl flex flex-col animate-in slide-in-from-left duration-200"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <VillageAzaleiaLogo variant="horizontal" size="sm" />
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Fechar menu"
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-4 border-b border-white/10 space-y-2">
              <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white text-[11px] font-bold shadow-md">
                {meta.icon}
                {meta.label}
              </span>
              <div className="text-xs text-emerald-100/90 font-medium">
                Olá, <strong className="text-white">{displayName}</strong>
              </div>
            </div>

            <nav className="flex-1 py-2">
              <NavItems compact />
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};
