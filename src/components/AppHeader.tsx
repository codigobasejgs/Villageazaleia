import React, { useEffect, useRef, useState } from 'react';
import { AppRole } from '../types';
import { Shield, Smartphone, Box, BarChart3, Volume2, VolumeX, Download, Check, LogOut, MoreVertical } from 'lucide-react';
import { sound } from '../utils/audio';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { usePwaInstall } from '../hooks/usePwaInstall';

const ROLE_META: Record<AppRole, { label: string; shortLabel: string; icon: React.ReactNode }> = {
  portaria: { label: 'Portaria / Recepção', shortLabel: 'Portaria', icon: <Shield className="w-4 h-4" /> },
  morador: { label: 'PWA Morador', shortLabel: 'Morador', icon: <Smartphone className="w-4 h-4" /> },
  totem: { label: 'Totem Entregador', shortLabel: 'Totem', icon: <Box className="w-4 h-4" /> },
  sindico: { label: 'Painel Síndico', shortLabel: 'Síndico', icon: <BarChart3 className="w-4 h-4" /> }
};

interface AppHeaderProps {
  role: AppRole;
  displayName: string;
  pendingCount?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  /** Omit for unauthenticated kiosk mode (Totem) — hides the "Sair" action. */
  onLogout?: () => void;
}

/**
 * Header enxuto: uma faixa só. No mobile, o secundário (instalar PWA, som, sair) vai
 * pro menu "⋮" pra não empilhar linha e comer a tela.
 *
 * Não existe seletor de papel aqui de propósito — cada sessão vê só o seu contexto.
 * Pra testar outro papel em desenvolvimento, use query param: ?role=portaria|morador|totem|sindico
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  role,
  displayName,
  pendingCount = 0,
  soundEnabled,
  onToggleSound,
  onLogout
}) => {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const meta = ROLE_META[role];

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleInstallClick = async () => {
    setIsMenuOpen(false);
    if (!isInstallable) return;
    sound.playScanBeep();
    const outcome = await promptInstall();
    if (outcome === 'accepted') sound.playSuccess();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#061D12]/95 backdrop-blur-md border-b border-[#D4AF37]/30 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Identidade + papel da sessão */}
        <div className="flex items-center gap-2.5 min-w-0">
          <VillageAzaleiaLogo variant="horizontal" size="sm" />

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md ring-1 ring-[#FFF2B2]/40 text-[11px] sm:text-xs font-bold shrink-0">
            <span className="text-white">{meta.icon}</span>
            <span className="hidden sm:inline">{meta.label}</span>
            <span className="inline sm:hidden">{meta.shortLabel}</span>
            {pendingCount > 0 && (
              <span className="ml-0.5 px-1.5 rounded-full bg-white text-[#AD1457] text-[10px] font-black shadow-sm">
                {pendingCount}
              </span>
            )}
          </span>

          <span className="hidden md:inline text-xs text-emerald-100/90 font-medium truncate">
            Olá, <strong className="text-white">{displayName}</strong>
          </span>
        </div>

        {/* Desktop: ações visíveis. Mobile: tudo dentro do menu "⋮" */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Instalar PWA — visível direto no desktop */}
          {isInstalled ? (
            <span className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-[#0D3823] text-emerald-200 border border-[#D4AF37]/20 items-center gap-1.5 text-[11px] font-medium shadow-sm">
              <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
              Instalado
            </span>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              title={
                isInstallable
                  ? 'Instalar o app na tela inicial'
                  : 'No iPhone: toque em Compartilhar → Adicionar à Tela de Início'
              }
              className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] text-white border border-[#FFF2B2]/20 transition-all items-center gap-1.5 text-[11px] font-bold shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#FFF2B2]" />
              {isInstallable ? 'Instalar' : 'PWA'}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Silenciar efeitos sonoros' : 'Ativar efeitos sonoros'}
            className="hidden sm:flex p-1.5 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-emerald-100 border border-[#D4AF37]/20 transition-all items-center shadow-sm"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-emerald-300/50" />
            )}
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                sound.playScanBeep();
                onLogout();
              }}
              className="hidden sm:flex px-3 py-1.5 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-emerald-100 hover:text-white border border-[#D4AF37]/25 hover:border-[#D4AF37]/50 transition-all items-center gap-1.5 text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5 text-[#D4AF37]" />
              Sair
            </button>
          )}

          {/* Menu compacto (mobile) */}
          <div className="relative sm:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Abrir menu"
              aria-expanded={isMenuOpen}
              className="p-2 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-emerald-100 border border-[#D4AF37]/25 transition-all"
            >
              <MoreVertical className="w-4 h-4 text-[#D4AF37]" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-[#D4AF37]/40 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 bg-[#F8F9FA] border-b border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Conectado como</div>
                  <div className="text-xs font-black text-[#0D3823] truncate">{displayName}</div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full px-4 py-3 text-left hover:bg-[#FCE4EC]/50 transition-colors flex items-center gap-2.5 text-xs font-bold text-[#0D3823] border-b border-slate-100"
                >
                  {isInstalled ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>App instalado</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-[#D81B60]" />
                      <span>{isInstallable ? 'Instalar aplicativo' : 'Como instalar'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleSound();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-[#FCE4EC]/50 transition-colors flex items-center gap-2.5 text-xs font-bold text-[#0D3823] border-b border-slate-100"
                >
                  {soundEnabled ? (
                    <>
                      <Volume2 className="w-4 h-4 text-[#0D3823]" />
                      <span>Silenciar sons</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4 text-slate-400" />
                      <span>Ativar sons</span>
                    </>
                  )}
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      sound.playScanBeep();
                      onLogout();
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-center gap-2.5 text-xs font-bold text-red-700"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da conta</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
