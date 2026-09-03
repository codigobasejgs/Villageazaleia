import React, { useState, useEffect, useMemo } from 'react';
import { PackageItem, Unit, Carrier, StorageLocation } from '../types';
import { CARRIER_CONFIG, SAMPLE_PACKAGE_PHOTOS } from '../data/mockData';
import { RotateCcw, CheckCircle2, Camera, ChevronDown, ChevronUp, Zap, AlertCircle, Clock, PauseCircle, PlayCircle, Pencil } from 'lucide-react';
import { sound } from '../utils/audio';
import { BarcodeDisplay } from './VisualCodes';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { PackageScannerOCR } from './PackageScannerOCR';
import { ExtractedLabelData } from '../services/ocr-parser.service';
import { shelfAllocatorService } from '../services/shelf-allocator.service';
import { storageService } from '../services/storage.service';
import { PackageIntakePayload } from './PackageIntakeFlow';

interface TotemViewProps {
  units: Unit[];
  packages: PackageItem[];
  onAddPackage: (pkg: PackageIntakePayload) => Promise<boolean>;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

interface RegisteredTicket {
  protocol: string;
  block: string;
  apartment: number;
  residentName: string;
  carrier: Carrier;
  trackingCode: string;
  shelf: StorageLocation;
  hasContact: boolean;
}

const AUTO_CONFIRM_SECONDS = 2;

/**
 * Totem do entregador: só o nome do entregador é digitado. Bloco e apartamento vêm da
 * leitura automática da etiqueta (Gemini Vision) — quando a leitura acha uma unidade real,
 * confirma sozinho após uma contagem de 2s (cancelável). Se a etiqueta não tiver bloco/apto
 * legíveis, ou não bater com nenhuma unidade cadastrada, abre a correção manual como EXCEÇÃO,
 * não como regra — decisão do dono do sistema.
 */
export const TotemView: React.FC<TotemViewProps> = ({ units, packages, onAddPackage, onShowToast }) => {
  const [deliveryGuyName, setDeliveryGuyName] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(true);
  const [carrier, setCarrier] = useState<Carrier>('Mercado Livre');
  const [trackingInput, setTrackingInput] = useState('');
  const [scannedPhoto, setScannedPhoto] = useState<string | null>(null);
  const [blockInput, setBlockInput] = useState('');
  const [apartmentInput, setApartmentInput] = useState('');
  const [ticket, setTicket] = useState<RegisteredTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preenchidos automaticamente pela leitura da etiqueta. So aparecem editaveis quando a
  // leitura falha (excecao) ou quando o entregador pede pra corrigir manualmente.
  const [manualOverride, setManualOverride] = useState(false);
  const [autoConfirmCountdown, setAutoConfirmCountdown] = useState<number | null>(null);
  const [isCountdownPaused, setIsCountdownPaused] = useState(false);

  // Correspondência exata (sem sugestão/fuzzy) — só acha quando bloco+apto batem certinho.
  // Bloco é texto livre (pode ter letra, ex: "12B"), comparado sem diferenciar maiúsculas.
  const matchedUnit = useMemo(() => {
    const block = blockInput.trim().toLowerCase();
    const apartment = parseInt(apartmentInput, 10);
    if (!block || !apartment) return null;
    return units.find((u) => String(u.block || '').trim().toLowerCase() === block && u.apartment === apartment) || null;
  }, [blockInput, apartmentInput, units]);

  const hasUnitTypo = blockInput.trim() !== '' && apartmentInput.trim() !== '' && !matchedUnit;

  // Escaneou a etiqueta: transportadora, rastreio, foto E bloco/apto — tudo automático.
  // Só entra em modo manual (excecao) se a etiqueta nao tiver unidade legivel/valida.
  const handleScanComplete = (extracted: ExtractedLabelData, capturedPhotoUrl: string) => {
    if (!deliveryGuyName.trim()) {
      onShowToast('Informe seu nome antes de escanear a etiqueta.', 'warning');
      return;
    }

    setCarrier(extracted.carrier);
    setScannedPhoto(capturedPhotoUrl);
    if (extracted.trackingCode) {
      setTrackingInput(extracted.trackingCode);
    }

    if (extracted.block && extracted.apartment) {
      const targetBlock = String(extracted.block).trim().toLowerCase();
      const found = units.find(
        (u) => String(u.block || '').trim().toLowerCase() === targetBlock && u.apartment === extracted.apartment
      );
      setBlockInput(extracted.block);
      setApartmentInput(String(extracted.apartment));

      if (found) {
        setManualOverride(false);
        setIsCountdownPaused(false);
        setAutoConfirmCountdown(AUTO_CONFIRM_SECONDS);
        onShowToast(`Unidade identificada: Bloco ${found.block} Apto ${found.apartment} (${found.residentName})`, 'success');
        return;
      }
    }

    // Etiqueta lida, mas sem bloco/apto legivel ou sem unidade correspondente — excecao.
    setAutoConfirmCountdown(null);
    setManualOverride(true);
    onShowToast('Não foi possível identificar a unidade automaticamente. Confira ou corrija o bloco/apartamento abaixo.', 'warning');
  };

  const handleGenerateTracking = () => {
    sound.playScanBeep();
    const randNum = Math.floor(100000000 + Math.random() * 900000000);
    setTrackingInput(`${carrier.slice(0, 3).toUpperCase()}-${randNum}`);
  };

  const handleConfirmDelivery = async () => {
    if (isSubmitting) return; // trava contra duplo toque
    if (!deliveryGuyName.trim()) {
      onShowToast('Informe seu nome ou a transportadora antes de confirmar.', 'warning');
      return;
    }
    const block = blockInput.trim();
    const apartment = parseInt(apartmentInput, 10);
    if (!block || !apartment) {
      onShowToast('Escaneie a etiqueta ou informe o Bloco e o Apartamento de destino.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const tracking = trackingInput.trim() || `PKG-${Date.now().toString().slice(-6)}`;
      const shelf = shelfAllocatorService.allocateBestSlot(packages, carrier);

      // Upload scanned photo to Supabase Storage if present
      let finalPhotoUrl = scannedPhoto || SAMPLE_PACKAGE_PHOTOS[0];
      if (scannedPhoto && scannedPhoto.startsWith('data:')) {
        finalPhotoUrl = await storageService.uploadFile('packages', scannedPhoto);
      }

      const residentName = matchedUnit?.residentName || `Morador Bloco ${block} Apto ${apartment}`;
      const unitId = matchedUnit?.id || `B${String(block).padStart(2, '0')}-A${apartment}`;

      // AGUARDA o resultado real do banco (BUG-004) — sem isso o ticket de "sucesso"
      // aparecia mesmo quando a gravacao falhava silenciosamente (ex: sem sessao valida).
      const ok = await onAddPackage({
        trackingCode: tracking,
        unitId,
        block,
        apartment,
        residentName,
        carrier,
        shelf,
        photoUrl: finalPhotoUrl,
        registeredVia: 'TOTEM_ENTREGADOR',
        deliveryGuyName: deliveryGuyName.trim(),
        operatorName: 'Totem Central de Autoatendimento'
      });

      if (!ok) {
        onShowToast('Não foi possível registrar a entrega. Chame a portaria.', 'warning');
        return;
      }

      setTicket({
        protocol: `PROT-VA-${Math.floor(100000 + Math.random() * 900000)}`,
        block,
        apartment,
        residentName,
        carrier,
        trackingCode: tracking,
        shelf,
        hasContact: !!matchedUnit
      });
      sound.playCheckout();
    } finally {
      setIsSubmitting(false);
      setAutoConfirmCountdown(null);
    }
  };

  // Contagem de 2s antes da confirmacao automatica — mesmo padrao ja usado na Portaria
  // (PackageIntakeFlow), cancelavel com 1 toque se o entregador notar algo errado.
  useEffect(() => {
    if (autoConfirmCountdown === null || isCountdownPaused) return;

    if (autoConfirmCountdown <= 0) {
      handleConfirmDelivery();
      setAutoConfirmCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      sound.playScanBeep();
      setAutoConfirmCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConfirmCountdown, isCountdownPaused]);

  // Reset completo (botão do cabeçalho) — encerra o atendimento deste entregador
  const handleFullReset = () => {
    sound.playScanBeep();
    setDeliveryGuyName('');
    setCarrier('Mercado Livre');
    setTrackingInput('');
    setScannedPhoto(null);
    setBlockInput('');
    setApartmentInput('');
    setTicket(null);
    setManualOverride(false);
    setAutoConfirmCountdown(null);
    setIsCountdownPaused(false);
  };

  // Reset leve (botão pós-ticket) — mesmo entregador pode deixar outra encomenda em seguida
  const handleNewDropOff = () => {
    sound.playScanBeep();
    setCarrier('Mercado Livre');
    setTrackingInput('');
    setScannedPhoto(null);
    setBlockInput('');
    setApartmentInput('');
    setTicket(null);
    setManualOverride(false);
    setAutoConfirmCountdown(null);
    setIsCountdownPaused(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 text-[#1A2E22]">
      {/* Totem Header Banner with Azaleia Branding */}
      <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] rounded-3xl border border-[#D4AF37]/50 p-6 shadow-2xl flex items-center justify-between text-white relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#D81B60]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-[#D4AF37]/40 shadow-inner flex items-center justify-center">
            <VillageAzaleiaLogo variant="icon" size="md" />
          </div>
          <div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#D81B60]/30 text-[#FFF2B2] font-bold border border-[#D81B60]/50 uppercase tracking-wider">
              Totem de Autoatendimento
            </span>
            <h2 className="text-xl font-black text-white tracking-tight font-brand mt-1">
              Residencial Village Azaleia
            </h2>
          </div>
        </div>

        <button
          onClick={handleFullReset}
          title="Reiniciar Totem"
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20 flex items-center gap-1.5 text-xs font-extrabold shadow-sm shrink-0"
        >
          <RotateCcw className="w-4 h-4 text-[#FFF2B2]" />
          <span className="hidden sm:inline">Nova Entrada</span>
        </button>
      </div>

      {ticket ? (
        /* RECEIPT AFTER CONFIRMATION */
        <div className="bg-white rounded-3xl border border-[#D4AF37]/35 p-6 sm:p-8 shadow-xl text-center space-y-6 py-4">
          <div className="w-16 h-16 rounded-full bg-[#E8F5E9] text-[#0D3823] border-2 border-[#A5D6A7] flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 className="w-9 h-9 text-[#0D3823]" />
          </div>

          <div>
            <span className="font-brand font-bold text-xs tracking-wider text-[#D81B60] uppercase">Depósito Finalizado</span>
            <h3 className="text-2xl font-black text-[#0D3823]">Depósito Realizado com Sucesso!</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {ticket.hasContact
                ? 'O morador já foi notificado automaticamente via WhatsApp e E-mail.'
                : 'Morador sem cadastro de WhatsApp/e-mail — a Portaria fará a entrega manualmente.'}
            </p>
          </div>

          <div className="max-w-md mx-auto bg-white text-slate-900 p-6 rounded-2xl shadow-xl text-left space-y-3 font-mono text-xs border-2 border-dashed border-[#D4AF37]">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-center mb-1">
                <VillageAzaleiaLogo variant="badge" size="sm" />
              </div>
              <div className="font-extrabold text-sm text-[#0D3823] font-sans">RESIDENCIAL VILLAGE AZALEIA</div>
              <div className="text-[10px] text-slate-500 font-sans">TOTEM DE AUTOATENDIMENTO DE ENTRADA</div>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Protocolo:</span>
                <span className="font-bold text-[#D81B60]">{ticket.protocol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transportadora:</span>
                <span className="font-bold text-[#0D3823]">{ticket.carrier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destino:</span>
                <span className="font-bold text-[#0D3823]">Bloco {ticket.block} - Apt {ticket.apartment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Morador:</span>
                <span className="text-[#0D3823] font-medium">{ticket.residentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estante:</span>
                <span className="font-bold text-[#0D3823]">{ticket.shelf.shelf}{ticket.shelf.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rastreio:</span>
                <span className="font-bold text-[#0D3823]">{ticket.trackingCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data e Hora:</span>
                <span className="text-slate-700">{new Date().toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-3 flex justify-center">
              <BarcodeDisplay value={ticket.protocol} height={30} />
            </div>
          </div>

          <button
            onClick={handleNewDropOff}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#D81B60] to-[#AD1457] hover:from-[#AD1457] hover:to-[#880E4F] text-white font-extrabold text-sm shadow-lg inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4 text-[#FFF2B2]" />
            <span>Deixar Outra Encomenda</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. Identificação do Entregador — único campo sempre manual */}
          <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-4 shadow-md">
            <label className="block text-xs font-bold text-[#0D3823] uppercase tracking-wider mb-1.5">
              1. Seu nome ou a transportadora *
            </label>
            <input
              type="text"
              value={deliveryGuyName}
              onChange={(e) => setDeliveryGuyName(e.target.value)}
              placeholder="Ex: Lucas Motoboy / Entregador Shopee"
              className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-[#0D3823] font-semibold focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
            />
          </div>

          {/* 2. Escanear etiqueta — le transportadora, rastreio E bloco/apto automaticamente */}
          <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0D3823] uppercase tracking-wider">
                2. Escaneie a Etiqueta
              </label>
              <button
                type="button"
                onClick={() => setIsScannerOpen(!isScannerOpen)}
                className="px-3 py-1.5 rounded-lg bg-[#0D3823] hover:bg-[#15462D] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{isScannerOpen ? 'Recolher Câmera' : 'Abrir Câmera'}</span>
                {isScannerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {isScannerOpen && (
              <PackageScannerOCR onScanComplete={handleScanComplete} onClose={() => setIsScannerOpen(false)} />
            )}

            {/* Carrier + Tracking — auto-preenchidos pelo scan, editáveis */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {(['Mercado Livre', 'Amazon', 'Correios', 'Shopee', 'Loggi', 'Outra'] as Carrier[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCarrier(c)}
                  className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 text-[11px] font-semibold ${
                    carrier === c
                      ? 'bg-[#FCE4EC] border-[#D81B60] text-[#AD1457] ring-2 ring-[#D81B60]/30'
                      : 'bg-[#F8F9FA] border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">{CARRIER_CONFIG[c].icon}</span>
                  <span className="truncate w-full">{c}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="Código de rastreio"
                className="flex-1 bg-[#F8F9FA] border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-[#0D3823] font-mono font-bold focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
              />
              <button
                type="button"
                onClick={handleGenerateTracking}
                className="px-3.5 py-2.5 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-white font-semibold text-xs flex items-center gap-1.5 border border-[#D4AF37]/40 shrink-0"
              >
                <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">Gerar</span>
              </button>
            </div>
          </div>

          {/* 3. Unidade — identificada automaticamente pela etiqueta. Correção manual só
              aparece como exceção (leitura falhou) ou se o entregador pedir pra corrigir. */}
          {autoConfirmCountdown !== null && matchedUnit && !manualOverride ? (
            <div className="bg-white rounded-2xl border-2 border-[#A5D6A7] p-4 shadow-md space-y-3">
              <div className="p-3 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-[#0D3823] shrink-0" />
                <span className="text-[#0D3823] font-bold">
                  Unidade identificada: Bloco {matchedUnit.block} Apto {matchedUnit.apartment} — {matchedUnit.residentName}
                </span>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-slate-200/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-100 font-semibold">
                    <Clock className="w-4 h-4 text-[#D4AF37] animate-spin" />
                    <span>
                      {isCountdownPaused
                        ? 'Pausado — toque em Retomar pra confirmar'
                        : `Confirmando e avisando o morador em: ${autoConfirmCountdown}s...`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCountdownPaused(!isCountdownPaused);
                      sound.playScanBeep();
                    }}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {isCountdownPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                    <span>{isCountdownPaused ? 'Retomar' : 'Pausar'}</span>
                  </button>
                </div>
                {!isCountdownPaused && (
                  <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#D4AF37] to-[#D81B60] transition-all duration-1000 ease-linear"
                      style={{ width: `${(autoConfirmCountdown / AUTO_CONFIRM_SECONDS) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setAutoConfirmCountdown(null);
                  setManualOverride(true);
                }}
                className="w-full py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Algo errado? Corrigir manualmente</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-4 shadow-md space-y-3">
              <label className="block text-xs font-bold text-[#0D3823] uppercase tracking-wider">
                3. Bloco e Apartamento de Destino
                {!manualOverride && (
                  <span className="block text-[10px] font-medium text-slate-400 normal-case mt-0.5">
                    Preenchido automaticamente ao escanear a etiqueta
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={blockInput}
                  onChange={(e) => {
                    setBlockInput(e.target.value);
                    setAutoConfirmCountdown(null);
                  }}
                  placeholder="Bloco (Ex: 3 ou 12B)"
                  className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl px-4 py-3 text-base text-[#0D3823] font-bold text-center focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={apartmentInput}
                  onChange={(e) => {
                    setApartmentInput(e.target.value);
                    setAutoConfirmCountdown(null);
                  }}
                  placeholder="Apartamento (Ex: 102)"
                  className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl px-4 py-3 text-base text-[#0D3823] font-bold text-center focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
                />
              </div>

              {matchedUnit && (
                <div className="p-3 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#0D3823] shrink-0" />
                  <span className="text-[#0D3823] font-bold">
                    Confirmar entrega para: {matchedUnit.residentName}
                  </span>
                </div>
              )}
              {hasUnitTypo && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-amber-800 font-semibold">Unidade não encontrada. Confira o bloco e o apartamento.</span>
                </div>
              )}
            </div>
          )}

          {/* Confirm — some quando o auto-confirm nao esta ativo (fluxo manual/excecao) */}
          {autoConfirmCountdown === null && (
            <button
              type="button"
              onClick={handleConfirmDelivery}
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#D81B60] via-[#E91E63] to-[#AD1457] hover:from-[#AD1457] hover:to-[#880E4F] text-white font-black text-base shadow-xl shadow-[#D81B60]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-5 h-5 text-[#FFF2B2]" />
              <span>{isSubmitting ? 'Registrando...' : 'Confirmar Entrega & Avisar Morador'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
