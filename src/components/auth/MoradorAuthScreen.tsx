import React, { useState } from 'react';
import { ArrowLeft, Mail, KeyRound, AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { Unit } from '../../types';
import { VillageAzaleiaLogo } from '../VillageAzaleiaLogo';
import { MoradorRegistrationModal } from '../MoradorRegistrationModal';
import { loginMorador } from '../../services/auth.service';
import { sound } from '../../utils/audio';

interface MoradorAuthScreenProps {
  units: Unit[];
  onBack: () => void;
  onSaveUnit: (unit: Unit) => void;
  onAuthSuccess: (unit: Unit) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const MoradorAuthScreen: React.FC<MoradorAuthScreenProps> = ({
  units,
  onBack,
  onSaveUnit,
  onAuthSuccess,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'entrar' | 'cadastrar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const unit = await loginMorador(email, password, units);
      if (!unit) {
        sound.playError();
        setError('E-mail ou senha inválidos. Ainda não tem conta? Use a aba Cadastrar.');
        return;
      }
      sound.playSuccess();
      onAuthSuccess(unit);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registration happens via the existing MoradorRegistrationModal (mode="register").
  // Saving the unit both persists it globally and logs the resident in.
  const handleRegisterSave = (unit: Unit) => {
    onSaveUnit(unit);
    onAuthSuccess(unit);
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
            <VillageAzaleiaLogo variant="icon" size="md" />
            <h2 className="text-base font-black text-white">PWA do Morador</h2>
            <p className="text-[11px] text-white/70 font-medium">Acompanhe suas encomendas em tempo real</p>
          </div>

          <div className="grid grid-cols-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('entrar')}
              className={`py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'entrar' ? 'text-[#D81B60] border-b-2 border-[#D81B60]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cadastrar')}
              className={`py-3 text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'cadastrar' ? 'text-[#D81B60] border-b-2 border-[#D81B60]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Cadastrar</span>
            </button>
          </div>

          {activeTab === 'entrar' && (
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">E-mail:</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@email.com"
                    required
                    autoComplete="username"
                    className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-[#0D3823] focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
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
                    className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-[#0D3823] focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D81B60] via-[#E91E63] to-[#AD1457] hover:from-[#AD1457] hover:to-[#880E4F] text-white font-black text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {activeTab === 'cadastrar' && (
            <div className="p-6 text-center">
              <p className="text-xs text-slate-500">
                Cadastre sua unidade, crie uma senha e aceite os termos LGPD para ativar as notificações.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* The registration modal doubles as the "Cadastrar" screen — reused as-is, in register mode */}
      <MoradorRegistrationModal
        isOpen={activeTab === 'cadastrar'}
        onClose={() => setActiveTab('entrar')}
        units={units}
        onSaveUnit={handleRegisterSave}
        onShowToast={onShowToast}
        mode="register"
      />
    </div>
  );
};
