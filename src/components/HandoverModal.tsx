import React, { useState, useRef } from 'react';
import { PackageItem, Unit } from '../types';
import { SignaturePad } from './SignaturePad';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { storageService } from '../services/storage.service';
import { sound } from '../utils/audio';
import {
  CheckCircle2,
  Camera,
  PenTool,
  User,
  ShieldCheck,
  Package,
  X,
  Sparkles,
  AlertCircle,
  FileCheck,
  Upload,
  RefreshCw
} from 'lucide-react';

interface HandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: PackageItem | null;
  unit?: Unit;
  operatorName: string;
  onConfirmHandover: (
    pkgId: string,
    pickedUpBy: string,
    operatorName: string,
    signatureUrl: string | null,
    handoverPhotoUrl: string | null
  ) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const HandoverModal: React.FC<HandoverModalProps> = ({
  isOpen,
  onClose,
  pkg,
  unit,
  operatorName,
  onConfirmHandover,
  onShowToast
}) => {
  if (!isOpen || !pkg) return null;

  const [pickedUpBy, setPickedUpBy] = useState<string>(pkg.residentName || '');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [handoverPhoto, setHandoverPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [operator, setOperator] = useState<string>(operatorName || 'Silvio Portaria');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle Photo Capture from device camera or file upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sound.playScanBeep();
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setHandoverPhoto(event.target.result as string);
          onShowToast('Foto de comprovação capturada com sucesso!', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Simulated rapid handover snapshot
  const handleSimulateQuickSnapshot = () => {
    sound.playScanBeep();
    // Use an authentic handover snapshot
    const simulatedPhotos = [
      'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=400&q=80'
    ];
    const picked = simulatedPhotos[Math.floor(Math.random() * simulatedPhotos.length)];
    setHandoverPhoto(picked);
    onShowToast('Foto do momento da entrega registrada!', 'info');
  };

  const handleConfirm = async () => {
    if (!pickedUpBy.trim()) {
      sound.playError();
      onShowToast('Por favor, informe o nome de quem está retirando.', 'warning');
      return;
    }

    if (!signatureDataUrl) {
      sound.playError();
      onShowToast('A assinatura digital do morador/retirante é obrigatória.', 'warning');
      return;
    }

    setIsSubmitting(true);
    sound.playSuccess();

    try {
      // Upload signature & handover photo to Supabase Storage Bucket in parallel
      const [finalSignatureUrl, finalPhotoUrl] = await Promise.all([
        signatureDataUrl ? storageService.uploadFile('signatures', signatureDataUrl) : Promise.resolve(null),
        handoverPhoto ? storageService.uploadFile('handovers', handoverPhoto) : Promise.resolve(null)
      ]);

      onConfirmHandover(
        pkg.id,
        pickedUpBy.trim(),
        operator.trim() || 'Portaria',
        finalSignatureUrl || signatureDataUrl,
        finalPhotoUrl || handoverPhoto
      );
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#061D12]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border-2 border-[#D4AF37] max-w-xl w-full shadow-2xl overflow-hidden my-auto text-[#1A2E22] animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] p-5 text-white border-b-2 border-[#D4AF37] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#D81B60] text-white border border-[#D4AF37] shadow-md">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black text-[#FFF2B2] uppercase tracking-wider block font-brand">
                Etapa 5 • Comprovação Máxima de Entrega
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Confirmação & Assinatura de Retirada
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Package Summary Card */}
          <div className="p-4 rounded-2xl bg-[#E8F5E9] border border-[#A5D6A7] flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0D3823] text-[#FFF2B2] border border-[#D4AF37]/50 flex items-center justify-center font-black text-base shadow-sm shrink-0">
                B{pkg.block}
              </div>
              <div>
                <div className="text-xs font-black text-[#0D3823]">
                  Bloco {pkg.block} — Apartamento {pkg.apartment}
                </div>
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-[#D81B60]" />
                  <span>{pkg.residentName}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {pkg.carrier} • {pkg.trackingCode} • Estante {pkg.shelf.shelf}{pkg.shelf.level}
                </div>
              </div>
            </div>

            {pkg.photoUrl && (
              <img
                src={pkg.photoUrl}
                alt="Pacote"
                className="w-14 h-14 rounded-xl object-cover border border-[#A5D6A7] shrink-0"
              />
            )}
          </div>

          {/* Form Fields: Receiver Name and Operator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-[#0D3823] uppercase tracking-wider">
                Nome de quem está retirando *
              </label>
              <input
                type="text"
                value={pickedUpBy}
                onChange={(e) => setPickedUpBy(e.target.value)}
                placeholder="Ex: Beatriz Lima (Titular)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0D3823] focus:ring-2 focus:ring-[#0D3823]/20 text-xs font-bold text-slate-800 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-black text-[#0D3823] uppercase tracking-wider">
                Operador / Porteiro Responsável *
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Ex: Silvio Portaria"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0D3823] focus:ring-2 focus:ring-[#0D3823]/20 text-xs font-bold text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Handover Photo Capture */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black text-[#0D3823] uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#D81B60]" />
                <span>Foto de Comprovação da Entrega (Opcional/Recomendado)</span>
              </label>
              {handoverPhoto && (
                <button
                  type="button"
                  onClick={() => setHandoverPhoto(null)}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline"
                >
                  Remover foto
                </button>
              )}
            </div>

            {handoverPhoto ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-100 max-h-36 flex items-center justify-center">
                <img
                  src={handoverPhoto}
                  alt="Momento da Entrega"
                  className="w-full h-36 object-cover"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-900/90 text-[#FFF2B2] text-[10px] font-bold">
                  ✓ Foto Anexada
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0D3823] bg-slate-50 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-1 text-slate-600 transition-colors"
                >
                  <Camera className="w-5 h-5 text-[#0D3823]" />
                  <span className="text-[11px] font-bold">Tirar Foto / Câmera</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateQuickSnapshot}
                  className="p-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#D81B60] bg-slate-50 hover:bg-pink-50/50 flex flex-col items-center justify-center gap-1 text-slate-600 transition-colors"
                >
                  <Sparkles className="w-5 h-5 text-[#D81B60]" />
                  <span className="text-[11px] font-bold">Captura Rápida (Demo)</span>
                </button>
              </div>
            )}
          </div>

          {/* Digital Signature Pad */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black text-[#0D3823] uppercase tracking-wider flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-[#D81B60]" />
                <span>Assinatura Digital do Morador *</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                Toque na tela para assinar
              </span>
            </div>

            <SignaturePad
              onSignatureChange={(dataUrl) => setSignatureDataUrl(dataUrl)}
              height={160}
            />
          </div>

          {/* Legal Compliance Notice */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block">
                Disparo Automático do Recibo Digital:
              </span>
              <span>
                Ao confirmar, o sistema gerará o protocolo oficial com fotos e assinatura, enviando uma cópia imediatamente via WhatsApp e E-mail para o morador e arquivando no histórico jurídico da portaria.
              </span>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !signatureDataUrl}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0D3823] to-[#15462D] hover:from-[#15462D] hover:to-[#061D12] text-[#FFF2B2] font-black text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 border border-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            <span>Confirmar Retirada & Emitir Recibo</span>
          </button>
        </div>

      </div>
    </div>
  );
};
