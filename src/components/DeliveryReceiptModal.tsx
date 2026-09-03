import React from 'react';
import { PackageItem, Unit } from '../types';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import {
  CheckCircle2,
  Printer,
  Share2,
  X,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Package,
  FileCheck,
  Building,
  Camera,
  PenTool,
  QrCode
} from 'lucide-react';
import { sound } from '../utils/audio';

interface DeliveryReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: PackageItem | null;
  unit?: Unit;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const DeliveryReceiptModal: React.FC<DeliveryReceiptModalProps> = ({
  isOpen,
  onClose,
  pkg,
  unit,
  onShowToast
}) => {
  if (!isOpen || !pkg) return null;

  const protocolNumber = pkg.receiptProtocol || `REC-VA-${pkg.id.replace(/\D/g, '').slice(-8) || '20260829'}`;
  const arrivalDate = pkg.receivedAt ? new Date(pkg.receivedAt) : new Date();
  const pickupDate = pkg.pickedUpAt ? new Date(pkg.pickedUpAt) : new Date();

  const formattedArrival = `${arrivalDate.toLocaleDateString('pt-BR')} às ${arrivalDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const formattedPickup = `${pickupDate.toLocaleDateString('pt-BR')} às ${pickupDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const handlePrint = () => {
    sound.playScanBeep();
    window.print();
  };

  const handleShare = () => {
    sound.playSuccess();
    const shareText = `*Comprovante Digital de Retirada - Village Azaleia*\nProtocolo: ${protocolNumber}\nUnidade: Bloco ${pkg.block} - Apt ${pkg.apartment}\nMorador: ${pkg.residentName}\nRetirado por: ${pkg.pickedUpBy || pkg.residentName}\nData: ${formattedPickup}\nCódigo: ${pkg.trackingCode}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      onShowToast?.('Dados do comprovante copiados para a área de transferência!', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#061D12]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-3xl border-2 border-[#D4AF37] max-w-2xl w-full shadow-2xl overflow-hidden my-auto text-[#1A2E22] animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Control Bar (Hidden on print) */}
        <div className="bg-[#061D12] px-5 py-3 text-white border-b border-[#D4AF37]/50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#D4AF37]" />
            <span className="font-bold text-xs uppercase tracking-wider text-[#FFF2B2]">
              Comprovante Oficial de Retirada
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              title="Copiar texto do comprovante"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#c49f2b] text-[#0D3823] font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              title="Imprimir ou Salvar PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div id="printable-receipt" className="p-6 sm:p-8 overflow-y-auto space-y-6 print:p-4">
          
          {/* Header */}
          <div className="border-b-2 border-[#D4AF37] pb-5 text-center space-y-2">
            <div className="flex justify-center">
              <VillageAzaleiaLogo size="md" variant="full" />
            </div>
            <div className="pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] text-[11px] font-black uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Recibo de Entrega Concluída com Sucesso</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Protocolo nº <strong className="text-[#0D3823] font-bold text-sm">{protocolNumber}</strong>
            </p>
          </div>

          {/* Unit and Recipient Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Box 1: Unit & Resident */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Destinatário / Unidade
              </span>
              <div className="text-sm font-black text-[#0D3823]">
                Bloco {pkg.block} — Apartamento {pkg.apartment}
              </div>
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#D81B60]" />
                <span>Titular: {pkg.residentName}</span>
              </div>
              {unit?.residentEmail && (
                <div className="text-[11px] text-slate-500">
                  E-mail: {unit.residentEmail}
                </div>
              )}
            </div>

            {/* Box 2: Pickup details */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Dados da Retirada
              </span>
              <div className="text-xs text-slate-700">
                <strong className="text-[#0D3823]">Retirado por:</strong> {pkg.pickedUpBy || pkg.residentName}
              </div>
              <div className="text-xs text-slate-700">
                <strong className="text-[#0D3823]">Operador da Portaria:</strong> {pkg.operatorName || 'Portaria Central'}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>{formattedPickup}</span>
              </div>
            </div>
          </div>

          {/* Package Details */}
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Transportadora / Origem:</span>
              <span className="font-extrabold text-[#0D3823]">{pkg.carrier}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Código de Rastreio:</span>
              <span className="font-mono font-bold text-slate-800">{pkg.trackingCode}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-medium">Chegada na Portaria:</span>
              <span className="font-medium text-slate-700">{formattedArrival}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Localização física guardada:</span>
              <span className="font-bold text-[#D81B60]">Estante {pkg.shelf.shelf} • Prateleira {pkg.shelf.level}</span>
            </div>
          </div>

          {/* Proof Section: Handover Photo + Digital Signature */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#0D3823] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>Evidências de Entrega & Autenticidade</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Photo */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center space-y-2 min-h-[160px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-[#D81B60]" />
                  <span>Foto de Comprovação</span>
                </span>
                {pkg.handoverPhotoUrl || pkg.photoUrl ? (
                  <img
                    src={pkg.handoverPhotoUrl || pkg.photoUrl}
                    alt="Comprovação de Entrega"
                    className="max-h-32 w-full object-cover rounded-xl border border-slate-300 shadow-xs"
                  />
                ) : (
                  <div className="text-slate-400 text-xs italic p-4 text-center">
                    Foto não anexada no momento da entrega
                  </div>
                )}
                <span className="text-[9px] text-slate-400">
                  {pkg.handoverPhotoUrl ? 'Foto registrada no ato da entrega' : 'Foto do registro de entrada'}
                </span>
              </div>

              {/* Digital Signature */}
              <div className="p-3 rounded-2xl bg-white border-2 border-dashed border-[#D4AF37] flex flex-col items-center justify-between space-y-2 min-h-[160px]">
                <span className="text-[10px] font-bold text-[#0D3823] uppercase tracking-wider flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5 text-[#D81B60]" />
                  <span>Assinatura Digital Coletada</span>
                </span>
                
                {pkg.signatureUrl ? (
                  <div className="w-full flex items-center justify-center bg-slate-50 rounded-xl p-2 border border-slate-200">
                    <img
                      src={pkg.signatureUrl}
                      alt="Assinatura Digital do Morador"
                      className="max-h-24 object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center w-full">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                    <span className="text-xs font-bold text-emerald-900 block">Validação Eletrônica QR Code</span>
                    <span className="text-[10px] text-emerald-700">Token: {pkg.qrToken}</span>
                  </div>
                )}

                <div className="text-center">
                  <span className="text-[10px] font-extrabold text-[#0D3823] block">
                    {pkg.pickedUpBy || pkg.residentName}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Assinado digitalmente na portaria • {formattedPickup}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Compliance Footer & Hash */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-500">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="font-semibold text-slate-700">
                Documento emitido eletronicamente pelo Sistema de Gestão Village Azaleia.
              </p>
              <p>
                Validade e integridade garantidas pela Medida Provisória nº 2.200-2/2001 e Lei 14.063/2020.
              </p>
              <p className="font-mono text-[9px] text-slate-400">
                HASH: SHA256-{protocolNumber.toLowerCase()}-{pkg.qrToken.toLowerCase()}
              </p>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 flex items-center gap-2">
              <QrCode className="w-8 h-8 text-[#0D3823]" />
              <div className="text-[9px] leading-tight">
                <span className="font-bold text-[#0D3823] block">Autenticidade</span>
                <span className="text-slate-400">Verificado</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Action Buttons (Hidden on print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0D3823] to-[#15462D] hover:from-[#15462D] hover:to-[#061D12] text-[#FFF2B2] font-black text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 border border-[#D4AF37]"
          >
            <Printer className="w-4 h-4 text-[#D4AF37]" />
            <span>Imprimir / Exportar Recibo PDF</span>
          </button>
        </div>

      </div>
    </div>
  );
};
