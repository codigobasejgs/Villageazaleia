import React from 'react';
import { AppRole, Unit } from '../types';
import { Shield, Smartphone, Box, BarChart3, Volume2, VolumeX, RotateCcw, Download, Check, LogOut, ArrowRightLeft } from 'lucide-react';
import { sound } from '../utils/audio';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { usePwaInstall } from '../hooks/usePwaInstall';

const ROLE_META: Record<AppRole, { label: string; icon: React.ReactNode }> = {
  portaria: { label: 'Portaria / Recepção', icon: <Shield className="w-4 h-4" /> },
  morador: { label: 'PWA Morador', icon: <Smartphone className="w-4 h-4" /> },
  totem: { label: 'Totem Entregador', icon: <Box className="w-4 h-4" /> },
  sindico: { label: 'Painel Síndico', icon: <BarChart3 className="w-4 h-4" /> }
};

interface AppHeaderProps {
  role: AppRole;
  displayName: string;
  pendingCount?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onResetData: () => void;
  /** Omit for unauthenticated kiosk mode (Totem) — hides the "Sair" action. */
  onLogout?: () => void;
  /** Fast Role Switcher for QA / Dev testing */
  onSwitchRole?: (role: AppRole) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  role,
  displayName,
  pendingCount = 0,
  soundEnabled,
  onToggleSound,
  onResetData,
  onLogout,
  onSwitchRole
}) => {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const meta = ROLE_META[role];

  const handleInstallClick = async () => {
    if (!isInstallable) return;
    sound.playScanBeep();
    const outcome = await promptInstall();
    if (outcome === 'accepted') sound.playSuccess();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#061D12]/95 backdrop-blur-md border-b border-[#D4AF37]/30 shadow-xl">
      {/* Top micro-bar with official identity + utility actions */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100/70 border-b border-[#0D3823]/90">
        <div className="flex items-center gap-3">
          <VillageAzaleiaLogo variant="horizontal" size="sm" />
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-[#D4AF37]/30">
            <span className="px-2.5 py-0.5 rounded-full bg-[#0D3823] text-[11px] text-[#FFF2B2] border border-[#D4AF37]/30 font-medium">
              360 Unidades • 12 Blocos • Portaria Central
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* QA Quick Role Switcher */}
          {onSwitchRole && (
            <div className="flex items-center gap-1 bg-[#0D3823] p-1 rounded-xl border border-[#D4AF37]/30">
              <span className="text-[10px] font-bold text-[#FFF2B2] px-1.5 hidden md:inline">Ambiente:</span>
              <button
                type="button"
                onClick={() => {
                  sound.playScanBeep();
                  onSwitchRole('portaria');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  role === 'portaria'
                    ? 'bg-[#D81B60] text-white shadow-sm'
                    : 'text-emerald-200 hover:text-white hover:bg-white/5'
                }`}
                title="Visão da Portaria / Entregas"
              >
                Portaria
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playScanBeep();
                  onSwitchRole('morador');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  role === 'morador'
                    ? 'bg-[#D81B60] text-white shadow-sm'
                    : 'text-emerald-200 hover:text-white hover:bg-white/5'
                }`}
                title="PWA do Morador"
              >
                Morador
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playScanBeep();
                  onSwitchRole('totem');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  role === 'totem'
                    ? 'bg-[#D81B60] text-white shadow-sm'
                    : 'text-emerald-200 hover:text-white hover:bg-white/5'
                }`}
                title="Totem Entregador"
              >
                Totem
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playScanBeep();
                  onSwitchRole('sindico');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  role === 'sindico'
                    ? 'bg-[#D81B60] text-white shadow-sm'
                    : 'text-emerald-200 hover:text-white hover:bg-white/5'
                }`}
                title="Painel do Síndico"
              >
                Síndico
              </button>
            </div>
          )}

          {isInstalled ? (
            <span className="px-2 py-1 rounded-xl bg-[#0D3823] text-emerald-200 border border-[#D4AF37]/20 flex items-center gap-1.5 text-xs shadow-sm">
              <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline text-[11px] font-medium">Instalado</span>
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
              className="px-2.5 py-1 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] text-white border border-[#FFF2B2]/20 transition-all flex items-center gap-1.5 text-xs shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#FFF2B2]" />
              <span className="hidden sm:inline text-[11px] font-bold">
                {isInstallable ? 'Instalar' : 'PWA'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Silenciar efeitos sonoros' : 'Ativar efeitos sonoros'}
            className="p-1.5 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-emerald-100 border border-[#D4AF37]/20 transition-all flex items-center shadow-sm"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" /> : <VolumeX className="w-3.5 h-3.5 text-emerald-300/50" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Deseja restaurar as encomendas e configurações de demonstração iniciais?')) {
                onResetData();
                sound.playSuccess();
              }
            }}
            title="Restaurar dados de demonstração (QA)"
            className="p-1.5 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-emerald-100 hover:text-white border border-[#D4AF37]/20 transition-all flex items-center shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#D4AF37]" />
          </button>
        </div>
      </div>

      {/* Logged-in identity strip */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-2 px-3 py-1 rounded-xl bg-gradient-to-r from-[#D81B60] via-[#E91E63] to-[#AD1457] text-white shadow-md ring-1 ring-[#FFF2B2]/40 text-xs font-semibold">
            <span className="text-white">{meta.icon}</span>
            <span>{meta.label}</span>
            {pendingCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-white text-[#AD1457] shadow-sm">
                {pendingCount}
              </span>
            )}
          </span>
          <span className="text-xs text-emerald-100/90 font-medium truncate max-w-[200px] sm:max-w-none">
            Olá, <strong className="text-white">{displayName}</strong>
          </span>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={() => {
              sound.playScanBeep();
              onLogout();
            }}
            className="px-3 py-1 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-emerald-100 hover:text-white border border-[#D4AF37]/25 hover:border-[#D4AF37]/50 transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Sair</span>
          </button>
        )}
      </div>
    </header>
  );
};
