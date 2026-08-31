import React, { useState } from 'react';
import { ArrowLeft, Mail, KeyRound, AlertCircle, Shield } from 'lucide-react';
import { StaffAccount } from '../../types';
import { VillageAzaleiaLogo } from '../VillageAzaleiaLogo';
import { loginStaff } from '../../services/auth.service';
import { sound } from '../../utils/audio';

interface StaffLoginScreenProps {
  staff: StaffAccount[];
  onBack: () => void;
  onAuthSuccess: (staff: StaffAccount) => void;
}

export const StaffLoginScreen: React.FC<StaffLoginScreenProps> = ({ staff, onBack, onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const account = await loginStaff(email, password, staff);
      if (!account) {
        sound.playError();
        setError('E-mail ou senha inválidos. Confira suas credenciais de funcionário.');
        return;
      }
      sound.playSuccess();
      onAuthSuccess(account);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#061D12] via-[#0D3823] to-[#15462D] px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#FFF2B2] text-xs font-bold hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="bg-white rounded-3xl border-2 border-[#D4AF37] shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] p-6 flex flex-col items-center text-center gap-1.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0D3823] border border-[#D4AF37]/50 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h2 className="text-base font-black text-white">Portaria / Síndico</h2>
            <p className="text-[11px] text-white/70 font-medium">Acesso restrito à equipe do condomínio</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">E-mail funcional:</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.nome@villageazaleia.com.br"
                  required
                  autoComplete="username"
                  className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-[#0D3823] focus:border-[#0D3823] focus:ring-2 focus:ring-[#0D3823]/20"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Senha:</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-[#0D3823] focus:border-[#0D3823] focus:ring-2 focus:ring-[#0D3823]/20"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0D3823] via-[#15462D] to-[#0D3823] hover:from-[#15462D] hover:to-[#061D12] text-[#FFF2B2] font-black text-xs shadow-lg border border-[#D4AF37] transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
