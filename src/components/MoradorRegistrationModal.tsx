import React, { useState } from 'react';
import { Unit, ResidentPhoneContact } from '../types';
import { sound } from '../utils/audio';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { LGPDTermsModal } from './LGPDTermsModal';
import { multichannelService } from '../services/notifications/multichannel.service';
import { loginMorador } from '../services/auth.service';
import {
  User,
  Mail,
  Phone,
  Building,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Sparkles,
  Smartphone,
  ShieldCheck,
  MessageSquare,
  AlertCircle,
  Lock,
  ExternalLink,
  KeyRound
} from 'lucide-react';

interface MoradorRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUnit?: Unit;
  onSaveUnit: (updatedUnit: Unit, skipDbSync?: boolean) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  /** 'register' pede e valida senha (novo cadastro / criação de conta). 'edit' (padrão) mantém o comportamento atual. */
  mode?: 'register' | 'edit';
}

const PHONE_LABELS = ['Titular', 'Cônjuge', 'Filho(a)', 'Familiar', 'Outro'];

export const MoradorRegistrationModal: React.FC<MoradorRegistrationModalProps> = ({
  isOpen,
  onClose,
  currentUnit,
  onSaveUnit,
  onShowToast,
  mode = 'edit'
}) => {
  if (!isOpen) return null;
  const isRegister = mode === 'register';

  // Bloco & Apartamento — sempre digitados pelo morador, sem valor sugerido/pré-selecionado
  const [blockInput, setBlockInput] = useState<string>(currentUnit ? String(currentUnit.block) : '');
  const [apartmentInput, setApartmentInput] = useState<string>(currentUnit ? String(currentUnit.apartment) : '');

  // Resident Name & Email
  const [residentName, setResidentName] = useState<string>(currentUnit?.residentName || '');
  const [residentEmail, setResidentEmail] = useState<string>(currentUnit?.residentEmail || '');

  // Login password (only required/shown in 'register' mode)
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Dynamic list of up to 5 contact phones
  const [phones, setPhones] = useState<ResidentPhoneContact[]>(() => {
    if (currentUnit?.residentPhones && currentUnit.residentPhones.length > 0) {
      return [...currentUnit.residentPhones];
    }
    return [
      {
        id: `phone-${Date.now()}-1`,
        label: 'Titular',
        number: currentUnit?.residentPhone || '',
        isWhatsapp: true
      }
    ];
  });

  // LGPD consent states — nasce DESMARCADO em cadastro novo (consentimento é opt-in,
  // nunca presumido). Em edição, reflete o que já foi aceito anteriormente.
  const [lgpdAccepted, setLgpdAccepted] = useState<boolean>(
    currentUnit?.lgpdAccepted !== undefined ? currentUnit.lgpdAccepted : false
  );
  const [isLGPDModalOpen, setIsLGPDModalOpen] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);


  // Add phone number (up to 5)
  const handleAddPhone = () => {
    if (phones.length >= 5) {
      onShowToast('Limite máximo de 5 números por unidade atingido.', 'warning');
      return;
    }

    sound.playScanBeep();
    const nextLabel = PHONE_LABELS[phones.length % PHONE_LABELS.length];
    setPhones([
      ...phones,
      {
        id: `phone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: nextLabel,
        number: '',
        isWhatsapp: true
      }
    ]);
  };

  // Remove phone number
  const handleRemovePhone = (id: string) => {
    if (phones.length <= 1) {
      onShowToast('É necessário manter pelo menos 1 telefone principal.', 'warning');
      return;
    }
    sound.playScanBeep();
    setPhones(phones.filter((p) => p.id !== id));
  };

  // Update specific phone field
  const handleUpdatePhone = (id: string, field: keyof ResidentPhoneContact, value: any) => {
    setPhones(
      phones.map((p) => {
        if (p.id === id) {
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  // Format Brazilian phone input
  const formatPhoneMask = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  // Submit & Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const selectedBlock = blockInput.trim();
    const selectedApartment = parseInt(apartmentInput, 10);
    if (!selectedBlock) {
      setFormError('Informe o Bloco (ex: 3 ou 12B).');
      sound.playError();
      return;
    }
    if (!selectedApartment) {
      setFormError('Informe o número do Apartamento.');
      sound.playError();
      return;
    }

    if (!residentName.trim()) {
      setFormError('Por favor, informe o Nome Completo do morador.');
      sound.playError();
      return;
    }

    if (!residentEmail.trim() || !residentEmail.includes('@')) {
      setFormError('Por favor, informe um E-mail válido para notificações via Resend.');
      sound.playError();
      return;
    }

    const temTelefoneValido = phones.some((p) => p.number.replace(/\D/g, '').length >= 10);
    if (!temTelefoneValido) {
      setFormError('Informe ao menos um telefone válido com DDD para receber avisos via WhatsApp.');
      sound.playError();
      return;
    }

    if (!lgpdAccepted) {
      setFormError('O consentimento formal dos termos da LGPD é obrigatório para ativação do cadastro.');
      sound.playError();
      return;
    }

    if (isRegister) {
      if (password.length < 8) {
        setFormError('A senha precisa ter no mínimo 8 caracteres.');
        sound.playError();
        return;
      }
      if (password !== confirmPassword) {
        setFormError('As senhas não coincidem.');
        sound.playError();
        return;
      }
    }

    // Filtra numeros vazios e placeholders (BUG-012)
    const validPhones = phones
      .map((p) => ({ ...p, number: p.number.trim() }))
      .filter((p) => {
        const clean = p.number.replace(/\D/g, '');
        return clean.length >= 10 && !clean.includes('999990000');
      });

    const unitId = `B${String(selectedBlock).padStart(2, '0')}-A${selectedApartment}`;
    const nowIso = new Date().toISOString();

    const updatedUnit: Unit = {
      id: unitId,
      block: selectedBlock,
      apartment: selectedApartment,
      residentName: residentName.trim(),
      residentPhone: validPhones[0]?.number || '',
      residentPhones: validPhones,
      residentEmail: residentEmail.trim(),
      pwaInstalled: true,
      pushEnabled: true,
      registeredAt: nowIso,
      lgpdAccepted: true,
      lgpdAcceptedAt: nowIso
    };

    if (isRegister) {
      // Cadastro seguro via backend: valida se a unidade esta livre antes de criar (BUG-007)
      try {
        const claimRes = await fetch('/api/units/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block: selectedBlock,
            apartment: selectedApartment,
            residentName: residentName.trim(),
            residentEmail: residentEmail.trim(),
            residentPhone: validPhones[0]?.number || '',
            residentPhones: validPhones,
            password,
            lgpdAccepted: true
          }),
          // Sem isso, o botao "carrega pra sempre" se o servidor nao responder
          // (mesmo padrao de bug ja visto no QR do WhatsApp) — agora falha visivel em 25s.
          signal: AbortSignal.timeout(25000)
        });

        const claimData = await claimRes.json();
        if (!claimRes.ok || !claimData.ok) {
          setFormError(claimData.error || 'Falha ao registrar unidade.');
          sound.playError();
          return;
        }

        // Login automatico apos o cadastro
        await loginMorador(residentEmail.trim(), password);
      } catch (err: any) {
        setFormError('Erro de comunicacao com o servidor: ' + (err?.message || ''));
        sound.playError();
        return;
      }
    }

    // No cadastro, a unidade ja foi criada no banco via /api/units/claim
    // (com service_role) — nao repetir o upsert pelo cliente (RLS bloquearia).
    onSaveUnit(updatedUnit, isRegister);
    sound.playSuccess();

    // Dispara e-mail de boas-vindas com termo LGPD
    try {
      multichannelService.dispatchWelcomeRegistration(updatedUnit);
    } catch (err) {
      console.warn('[Welcome Registration Dispatch Error]', err);
    }

    // Feedback honesto: boas-vindas sao enviadas por e-mail (BUG-010/BUG-012)
    onShowToast(`Cadastro do Bloco ${selectedBlock} Apt ${selectedApartment} ativado com consentimento LGPD! Boas-vindas enviadas por e-mail!`, 'success');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#061D12]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl border-2 border-[#D4AF37] max-w-lg w-full shadow-2xl overflow-hidden my-auto text-[#1A2E22] animate-in zoom-in-95 duration-200">
          {/* Header with Village Azaleia Branding */}
          <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] p-5 text-white border-b-2 border-[#D4AF37] relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10 border border-[#D4AF37]/40 shadow-inner">
                  <VillageAzaleiaLogo variant="icon" size="sm" />
                </div>
                <div>
                  <span className="text-[10px] font-brand font-black text-[#FFF2B2] uppercase tracking-wider block">
                    PWA Residencial Village Azaleia
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {isRegister ? 'Criar Minha Conta de Morador' : 'Auto-Cadastro & Gestão da Unidade'}
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-white/80 mt-2 font-medium">
              {isRegister
                ? 'Cadastre sua unidade, crie uma senha e até 5 números de WhatsApp para receber avisos instantâneos de encomendas.'
                : 'Cadastre seus dados e até 5 números de WhatsApp para receber avisos instantâneos de encomendas na portaria.'}
            </p>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Unit Selection (Block & Apartment) */}
            <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-[#0D3823]">
                <Building className="w-4 h-4 text-[#D81B60]" />
                <span>1. Identificação da Unidade</span>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1.5">
                Digite o bloco e o apartamento — sem sugestão automática, confira antes de enviar.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Bloco:
                  </label>
                  <input
                    type="text"
                    value={blockInput}
                    onChange={(e) => setBlockInput(e.target.value)}
                    placeholder="Ex: 3 ou 12B"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0D3823] text-center focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Apartamento:
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={apartmentInput}
                    onChange={(e) => setApartmentInput(e.target.value)}
                    placeholder="Ex: 102"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0D3823] text-center focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
                  />
                </div>
              </div>
            </div>

            {/* 2. Resident Name & Email */}
            <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-[#0D3823]">
                <User className="w-4 h-4 text-[#D81B60]" />
                <span>2. Dados do Titular da Unidade</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nome Completo:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={residentName}
                    onChange={(e) => setResidentName(e.target.value)}
                    placeholder="Ex: Beatriz Lima"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0D3823] focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  E-mail para Notificações Transacionais (Resend):
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={residentEmail}
                    onChange={(e) => setResidentEmail(e.target.value)}
                    placeholder="Ex: beatriz.lima@email.com"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0D3823] focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {isRegister && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Senha (mín. 6 caracteres):</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0D3823] focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
                      />
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Confirmar Senha:</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0D3823] focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20"
                      />
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Dynamic Phone Contacts (Up to 5) */}
            <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-[#0D3823]">
                  <MessageSquare className="w-4 h-4 text-[#D81B60]" />
                  <span>3. Telefones / WhatsApp da Família ({phones.length}/5)</span>
                </div>

                {phones.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddPhone}
                    className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#A5D6A7] text-[#0D3823] text-[11px] font-extrabold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                Todos os contatos cadastrados receberão mensagens automáticas via <strong>Evolution API (WhatsApp)</strong> quando sua encomenda chegar.
              </p>

              <div className="space-y-2.5">
                {phones.map((phone, idx) => (
                  <div
                    key={phone.id}
                    className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-5 h-5 rounded-full bg-[#D81B60] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <select
                          value={phone.label}
                          onChange={(e) => handleUpdatePhone(phone.id, 'label', e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-[#0D3823] focus:border-[#D81B60]"
                        >
                          {PHONE_LABELS.map((lbl) => (
                            <option key={lbl} value={lbl}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={phone.isWhatsapp}
                            onChange={(e) => handleUpdatePhone(phone.id, 'isWhatsapp', e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-0 w-3 h-3"
                          />
                          <span>WhatsApp</span>
                        </label>

                        {phones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhone(phone.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remover telefone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={phone.number}
                        onChange={(e) => handleUpdatePhone(phone.id, 'number', formatPhoneMask(e.target.value))}
                        placeholder="(11) 98765-4321"
                        required
                        className="w-full bg-[#F8F9FA] border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-[#0D3823] focus:border-[#D81B60] focus:ring-1 focus:ring-[#D81B60]"
                      />
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Mandatory LGPD Compliance Section */}
            <div className="p-4 rounded-2xl bg-[#E8F5E9] border-2 border-[#A5D6A7] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-[#0D3823]">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>4. Conformidade com a LGPD (Lei nº 13.709/2018)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLGPDModalOpen(true)}
                  className="text-[11px] font-extrabold text-[#D81B60] hover:text-[#AD1457] underline flex items-center gap-1"
                >
                  <span>Ler Termos Completos</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer bg-white p-3 rounded-xl border border-[#A5D6A7] shadow-xs">
                <input
                  type="checkbox"
                  checked={lgpdAccepted}
                  onChange={(e) => setLgpdAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-[#0D3823] focus:ring-0 w-4 h-4"
                />
                <span className="text-[11px] text-slate-700 leading-snug font-medium">
                  <strong>Li e concordo com os Termos de Uso e Política de Privacidade</strong> para tratamento dos meus dados cadastrais e recebimento de avisos automáticos de encomendas via <strong>WhatsApp</strong>, <strong>E-mail</strong> e <strong>Push Notification</strong>.
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 font-medium">
                <Lock className="w-3 h-3 text-emerald-700" />
                <span>Dados protegidos e tratados exclusivamente para segurança e controle condominial.</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!lgpdAccepted}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-[#0D3823] via-[#15462D] to-[#0D3823] hover:from-[#15462D] hover:to-[#061D12] text-[#FFF2B2] font-black text-xs shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-1.5 border border-[#D4AF37] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                <span>{isRegister ? 'Criar Conta & Ativar Notificações' : 'Salvar & Ativar Notificações'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Full LGPD Terms Modal */}
      <LGPDTermsModal
        isOpen={isLGPDModalOpen}
        onClose={() => setIsLGPDModalOpen(false)}
        onAcceptAndClose={() => {
          setLgpdAccepted(true);
          setIsLGPDModalOpen(false);
          onShowToast('Termos de Privacidade LGPD aceitos!', 'success');
        }}
      />
    </>
  );
};
