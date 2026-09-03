import React from 'react';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { ShieldCheck, Lock, FileText, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';

interface LGPDTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptAndClose?: () => void;
}

export const LGPDTermsModal: React.FC<LGPDTermsModalProps> = ({
  isOpen,
  onClose,
  onAcceptAndClose
}) => {
  if (!isOpen) return null;

  const handleAccept = () => {
    sound.playSuccess();
    if (onAcceptAndClose) {
      onAcceptAndClose();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#061D12]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border-2 border-[#D4AF37] max-w-2xl w-full shadow-2xl overflow-hidden my-auto text-[#1A2E22] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] p-5 text-white border-b-2 border-[#D4AF37] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 border border-[#D4AF37]/40 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-[#FFF2B2]" />
            </div>
            <div>
              <span className="text-[10px] font-brand font-black text-[#FFF2B2] uppercase tracking-wider block">
                Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Termos de Privacidade & Tratamento de Dados
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

        {/* Legal Text Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="p-3 rounded-2xl bg-[#E8F5E9] border border-[#A5D6A7] flex items-start gap-2.5 text-[#0D3823]">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#0D3823]" />
            <p className="font-semibold text-[11px]">
              O <strong>Condomínio Residencial Village Azaleia</strong> zela pela estrita privacidade e segurança dos dados dos moradores, garantindo tratamento exclusivo para as rotinas operacionais de segurança condominial e controle de correspondências.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-black text-sm text-[#0D3823] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#D81B60]" />
              <span>1. Finalidade do Tratamento dos Dados</span>
            </h4>
            <p>
              Os dados pessoais fornecidos (Nome Completo, E-mail, Telefones/WhatsApp da Unidade, Foto da Encomenda, Foto de Entrega e Assinatura Digital) serão coletados e tratados estritamente para:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Identificação da unidade de destino (Bloco e Apartamento) e conferência de moradores;</li>
              <li>Envio de notificações transacionais em tempo real sobre chegada e armazenamento de encomendas via <strong>WhatsApp (Evolution API)</strong>, <strong>E-mail (Resend)</strong> e <strong>Notificação no Aplicativo</strong>;</li>
              <li>Emissão de Comprovantes Digitais de Retirada com assinatura biométrica na tela e rastreabilidade jurídica;</li>
              <li>Prevenção a extravios, fraudes e garantia de segurança do patrimônio comum do condomínio.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-black text-sm text-[#0D3823] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#D81B60]" />
              <span>2. Base Legal (LGPD)</span>
            </h4>
            <p>
              O tratamento é respaldado pelo <strong>Art. 7º, Inciso I (Consentimento do Titular)</strong> e <strong>Inciso IX (Legítimo Interesse)</strong> da Lei nº 13.709/2018, para a proteção à segurança física e patrimonial de moradores e visitantes no recinto condominial.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-black text-sm text-[#0D3823] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#D81B60]" />
              <span>3. Não Compartilhamento com Terceiros Comerciais</span>
            </h4>
            <p>
              É expressamente vedada a comercialização, cessão ou compartilhamento de quaisquer dados cadastrais com terceiros para fins de publicidade, televendas ou marketing não autorizado. Os dados são acessíveis unicamente pela Administração do Condomínio e operadores autorizados da Portaria.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-black text-sm text-[#0D3823] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#D81B60]" />
              <span>4. Direitos do Titular (Morador)</span>
            </h4>
            <p>
              O titular poderá, a qualquer tempo, solicitar a atualização, retificação ou exclusão de seus telefones adicionais diretamente através do aplicativo ou junto à Administração do condomínio quando houver desocupação ou venda da unidade.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 text-[11px]">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Ao clicar em concordar, o sistema registrará seu consentimento formal e enviará automaticamente uma mensagem de confirmação de cadastro e boas-vindas para seu WhatsApp e E-mail.
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={handleAccept}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0D3823] to-[#15462D] hover:from-[#15462D] hover:to-[#061D12] text-[#FFF2B2] font-black text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 border border-[#D4AF37]"
          >
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            <span>Compreendi & Aceito os Termos LGPD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
