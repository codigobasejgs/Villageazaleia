import React from 'react';
import { Smartphone, Shield, Truck, ChevronRight } from 'lucide-react';
import { VillageAzaleiaLogo } from '../VillageAzaleiaLogo';
import { sound } from '../../utils/audio';

interface LandingScreenProps {
  onSelect: (target: 'morador' | 'staff' | 'totem') => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onSelect }) => {
  const handleSelect = (target: 'morador' | 'staff' | 'totem') => {
    sound.playScanBeep();
    onSelect(target);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#061D12] via-[#0D3823] to-[#15462D] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-white/95 rounded-3xl border-2 border-[#D4AF37] shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center space-y-2">
          <VillageAzaleiaLogo variant="full" size="lg" />
          <p className="text-xs text-slate-500 font-medium pt-1">
            Sistema Inteligente de Gestão de Encomendas
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSelect('morador')}
            className="w-full p-4 rounded-2xl bg-white hover:bg-[#FCE4EC]/40 border-2 border-[#D4AF37]/50 hover:border-[#D81B60] shadow-lg flex items-center justify-between gap-3 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FCE4EC] text-[#D81B60] border border-[#F48FB1] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-[#0D3823]">Sou Morador</div>
                <div className="text-[11px] text-slate-500 font-medium">Entrar ou cadastrar minha unidade</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#D4AF37] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect('staff')}
            className="w-full p-4 rounded-2xl bg-white hover:bg-[#E8F5E9]/60 border-2 border-[#D4AF37]/50 hover:border-[#0D3823] shadow-lg flex items-center justify-between gap-3 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-[#0D3823]">Sou Portaria / Síndico</div>
                <div className="text-[11px] text-slate-500 font-medium">Login com minha conta de funcionário</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#D4AF37] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect('totem')}
            className="w-full p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-[#D4AF37]/30 flex items-center justify-center gap-2 transition-all text-[#FFF2B2]"
          >
            <Truck className="w-4 h-4" />
            <span className="text-xs font-bold">Modo Totem (Entregador) — Autoatendimento sem login</span>
          </button>
        </div>
      </div>
    </div>
  );
};
