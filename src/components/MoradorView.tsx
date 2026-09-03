import React, { useState, useMemo, useEffect } from 'react';
import { PackageItem, Unit, PushNotification } from '../types';
import { CARRIER_CONFIG } from '../data/mockData';
import { QRCodeDisplay } from './VisualCodes';
import { MoradorRegistrationModal } from './MoradorRegistrationModal';
import { DeliveryReceiptModal } from './DeliveryReceiptModal';
import { webPushService } from '../services/notifications/web-push';
import {
  Package,
  Clock,
  User,
  BellRing,
  Download,
  Edit3,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  QrCode,
  X,
  Copy,
  Check,
  ShieldCheck,
  MapPin,
  Calendar
} from 'lucide-react';
import { sound } from '../utils/audio';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface MoradorViewProps {
  packages: PackageItem[];
  units: Unit[];
  /** Unidade do morador logado (vem da sessão — ver src/services/auth.service.ts) */
  activeUnitId: string;
  /** Nome pessoal do morador que está navegando (ex: "Giuliana" ou "Jefferson") */
  residentDisplayName?: string;
  onUpdateUnit?: (updatedUnit: Unit) => void;
  notifications?: PushNotification[];
  onTriggerTestPush?: (unit: Unit) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const MoradorView: React.FC<MoradorViewProps> = ({
  packages,
  units,
  activeUnitId,
  residentDisplayName,
  onUpdateUnit,
  notifications = [],
  onShowToast
}) => {
  const { isInstallable, isInstalled: isInstalledPwa, promptInstall } = usePwaInstall();
  const [activeTab, setActiveTab] = useState<'disponiveis' | 'historico' | 'perfil'>('disponiveis');
  const [fullscreenQrPackage, setFullscreenQrPackage] = useState<PackageItem | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PackageItem | null>(null);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Current unit data — definida pela sessão logada
  const currentUnit = useMemo(() => {
    return units.find((u) => u.id === activeUnitId) || units[0];
  }, [units, activeUnitId]);

  // Packages for this unit — case-insensitive no bloco (12B e 12b são o mesmo prédio)
  // e numérico no apartamento. Assim, todos os moradores da mesma residência
  // (mesmo com contas de login separadas) vêem as MESMAS encomendas unificadas.
  const myPackages = useMemo(() => {
    if (!currentUnit) return [];
    const unitBlock = String(currentUnit.block || '').trim().toLowerCase();
    return packages.filter(
      (p) => String(p.block || '').trim().toLowerCase() === unitBlock && Number(p.apartment) === Number(currentUnit.apartment)
    );
  }, [packages, currentUnit]);

  const availablePackages = useMemo(() => {
    return myPackages.filter((p) => p.status !== 'RETIRADA');
  }, [myPackages]);

  const pickedUpPackages = useMemo(() => {
    return myPackages.filter((p) => p.status === 'RETIRADA');
  }, [myPackages]);

  // Filter push notifications for this unit (mesma lógica case-insensitive)
  const myNotifications = useMemo(() => {
    if (!currentUnit) return [];
    const unitBlock = String(currentUnit.block || '').trim().toLowerCase();
    return notifications.filter(
      (n) => String(n.block || '').trim().toLowerCase() === unitBlock && Number(n.apartment) === Number(currentUnit.apartment)
    );
  }, [notifications, currentUnit]);

  const handleInstallPWA = async () => {
    sound.playScanBeep();
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      sound.playSuccess();
      onShowToast('Village Azaleia adicionado à Tela de Início!', 'success');
    } else if (outcome === 'unavailable') {
      onShowToast(
        'Para instalar no iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".',
        'info'
      );
    }
  };

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      sound.playScanBeep();
      onShowToast('Código de rastreio copiado!', 'info');
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // Unidade ainda nao chegou do banco (ex: logo apos cadastro, fetch em andamento).
  // Sem isso a JSX abaixo quebra em currentUnit.block/.residentName -> tela branca.
  if (!currentUnit) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-[#0D3823]/20 border-t-[#0D3823] animate-spin" />
          <p className="text-xs font-bold text-slate-500">Carregando sua unidade...</p>
        </div>
      </div>
    );
  }

  const phonesForDisplay =
    currentUnit.residentPhones && currentUnit.residentPhones.length > 0
      ? currentUnit.residentPhones
      : currentUnit.residentPhone
        ? [{ id: 'p1', label: 'Titular', number: currentUnit.residentPhone, isWhatsapp: true }]
        : [];

  return (
    <div className="min-h-[calc(100dvh-4rem)] pb-24 sm:pb-12 bg-slate-50 text-[#1A2E22]">
      {/* Top Banner / Hero Profile Card */}
      <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] text-white border-b border-[#D4AF37]/30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 border-2 border-[#D4AF37]/50 flex items-center justify-center shadow-md shrink-0">
                <VillageAzaleiaLogo variant="icon" size="sm" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-brand font-black text-[10px] sm:text-xs tracking-wider text-[#FFF2B2] uppercase">
                    Morador
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                  <span className="text-[10px] sm:text-xs text-white/80 font-medium">Condomínio Village Azaleia</span>
                </div>
                <h1 className="text-lg sm:text-2xl font-black text-white leading-tight">
                  Olá, {residentDisplayName || currentUnit.residentName}
                </h1>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-emerald-100/90 font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15">
                    Bloco {currentUnit.block} • Apto {currentUnit.apartment}
                  </span>
                  <span className="hidden sm:inline text-white/60">•</span>
                  <span className="hidden sm:inline font-normal text-white/80">{currentUnit.residentEmail}</span>
                </div>
              </div>
            </div>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowNotificationDrawer(true);
                  sound.playScanBeep();
                }}
                className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                title="Central de Notificações"
              >
                <BellRing className="w-4 h-4 text-[#FFF2B2]" />
                {myNotifications.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#D81B60] text-white text-[10px] font-black animate-pulse">
                    {myNotifications.length}
                  </span>
                )}
                <span className="hidden md:inline">Notificações</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRegistrationModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all border border-[#FFF2B2]/30 active:scale-95 whitespace-nowrap"
                title="Editar telefones de WhatsApp e dados da unidade"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#FFF2B2]" />
                <span>Editar Cadastro</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tab Navigation (Desktop & Tablet pills) */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm grid grid-cols-3 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('disponiveis');
              sound.playScanBeep();
            }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'disponiveis'
                ? 'bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md font-black'
                : 'text-slate-600 hover:text-[#0D3823] hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Pendentes para Retirada</span>
            {availablePackages.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'disponiveis' ? 'bg-white text-[#AD1457]' : 'bg-[#D81B60] text-white'
                }`}
              >
                {availablePackages.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('historico');
              sound.playScanBeep();
            }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'historico'
                ? 'bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md font-black'
                : 'text-slate-600 hover:text-[#0D3823] hover:bg-slate-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Histórico de Entregas</span>
            {pickedUpPackages.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'historico' ? 'bg-white text-[#AD1457]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pickedUpPackages.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('perfil');
              sound.playScanBeep();
            }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'perfil'
                ? 'bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md font-black'
                : 'text-slate-600 hover:text-[#0D3823] hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Meu Cadastro & Telefones</span>
          </button>
        </div>

        {/* Tab 1: Disponíveis / Pendentes */}
        {activeTab === 'disponiveis' && (
          <div className="space-y-4">
            {availablePackages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePackages.map((pkg) => {
                  const cfg = CARRIER_CONFIG[pkg.carrier] || { icon: '📦', color: '#D81B60' };
                  const arrivalDate = new Date(pkg.receivedAt);
                  const formattedArrival = `${arrivalDate.toLocaleDateString('pt-BR')} às ${arrivalDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

                  return (
                    <div
                      key={pkg.id}
                      className="bg-white rounded-2xl border-2 border-[#D4AF37]/50 p-5 space-y-4 shadow-lg hover:shadow-xl transition-all relative overflow-hidden ring-1 ring-[#D81B60]/20 flex flex-col justify-between"
                    >
                      {/* Top Header Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FCE4EC] text-[#AD1457] border border-[#F48FB1] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#D81B60] animate-ping" />
                          <span>Disponível para Retirada</span>
                        </span>

                        <span className="text-xs font-extrabold text-[#0D3823] flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          <span>{cfg.icon}</span>
                          <span>{pkg.carrier}</span>
                        </span>
                      </div>

                      {/* Destinatário impresso na etiqueta (relevante quando mais de 1 pessoa mora na mesma unidade) */}
                      {pkg.residentName && (
                        <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Destinatário na etiqueta:</span>
                          <span className="font-extrabold text-[#0D3823] flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#D81B60]" />
                            <span>{pkg.residentName}</span>
                          </span>
                        </div>
                      )}

                      {/* Package Photo & Shelf Info */}
                      <div className="flex gap-4 items-center">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-slate-200 shrink-0 bg-slate-100 shadow-inner">
                          <img
                            src={pkg.photoUrl || 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=400&q=80'}
                            alt={pkg.carrier}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                            Localização Física na Portaria
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] font-black text-sm shadow-sm">
                            <MapPin className="w-4 h-4 text-[#0D3823]" />
                            <span>Estante {pkg.shelf.shelf}, Nível {pkg.shelf.level}</span>
                          </div>
                          <div className="text-xs text-slate-600 font-medium flex items-center gap-1 pt-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Chegou: {formattedArrival}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tracking Code */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-slate-500 font-bold block">Código de Rastreio</span>
                          <span className="font-mono font-bold text-slate-800 truncate block">{pkg.trackingCode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(pkg.trackingCode)}
                          className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-sm transition-colors shrink-0"
                          title="Copiar código"
                        >
                          {copiedCode === pkg.trackingCode ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Action Button: Present QR Code */}
                      <button
                        type="button"
                        onClick={() => {
                          setFullscreenQrPackage(pkg);
                          sound.playScanBeep();
                        }}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D81B60] to-[#AD1457] hover:from-[#AD1457] hover:to-[#880E4F] text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all border border-[#FFF2B2]/30 active:scale-[0.98]"
                      >
                        <QrCode className="w-5 h-5 text-[#FFF2B2]" />
                        <span>Apresentar QR Code para Retirada</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-3xl bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-[#0D3823]">
                    Nenhuma encomenda pendente no momento!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Assim que uma nova encomenda for recebida pela Portaria ou Totem para o Bloco {currentUnit.block}, Apto {currentUnit.apartment}, você receberá um aviso no seu WhatsApp com o QR Code para retirada.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Histórico de Entregas */}
        {activeTab === 'historico' && (
          <div className="space-y-3">
            {pickedUpPackages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pickedUpPackages.map((pkg) => {
                  const arrivedAt = new Date(pkg.receivedAt);
                  const pickedAt = pkg.pickedUpAt ? new Date(pkg.pickedUpAt) : new Date();
                  const fmt = (d: Date) =>
                    `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

                  return (
                    <div
                      key={pkg.id}
                      onClick={() => {
                        setSelectedReceipt(pkg);
                        sound.playScanBeep();
                      }}
                      className="p-5 rounded-2xl bg-white hover:bg-[#FCE4EC]/30 border border-slate-200 hover:border-[#D81B60]/40 transition-all cursor-pointer space-y-3 text-xs shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] flex items-center justify-center shrink-0">
                            <Check className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-sm text-[#0D3823]">{pkg.carrier}</div>
                            <div className="text-xs text-slate-500 font-mono truncate">{pkg.trackingCode}</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] text-[11px] font-black shrink-0">
                          Entregue
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs text-slate-600">
                        <div>
                          Chegou em: <strong className="text-slate-800">{fmt(arrivedAt)}</strong>
                        </div>
                        <div>
                          Retirado em: <strong className="text-slate-800">{fmt(pickedAt)}</strong>
                        </div>
                        <div>
                          Retirado por: <strong className="text-[#0D3823]">{pkg.pickedUpBy || pkg.residentName}</strong>
                        </div>
                        {pkg.receiptProtocol && (
                          <div className="text-[11px] font-mono text-[#D81B60] pt-0.5">
                            Protocolo: <strong>{pkg.receiptProtocol}</strong>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[#D81B60] font-black text-xs pt-1 border-t border-slate-100">
                        <span>Ver Comprovante com Assinatura Digital</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-3 shadow-sm">
                <Clock className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-black text-[#0D3823]">
                  Nenhum histórico de retirada registrado ainda
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Assim que você retirar pacotes na Portaria, seus comprovantes oficiais com assinatura digital ficarão arquivados aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Meu Cadastro & Telefones */}
        {activeTab === 'perfil' && (
          <div className="space-y-4">
            {/* Instalar app — só aparece pra quem ainda não instalou */}
            {!isInstalledPwa && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0D3823] to-[#15462D] border border-[#D4AF37]/50 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#D81B60] text-white shadow-sm shrink-0">
                    <Download className="w-5 h-5 text-[#FFF2B2]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Instale o App Village Azaleia no Celular</h4>
                    <p className="text-xs text-[#FFF2B2]/90 font-medium">
                      {isInstallable
                        ? 'Receba alertas instantâneos na tela do celular e apresente seu QR Code com 1 toque.'
                        : 'No iPhone/Safari: toque no botão Compartilhar e selecione "Adicionar à Tela de Início".'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInstallPWA}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] hover:from-[#C5A059] hover:to-[#B38F48] text-[#061D12] text-xs font-extrabold transition-all shadow-md active:scale-95 whitespace-nowrap self-stretch sm:self-auto"
                >
                  {isInstallable ? 'Instalar Aplicativo' : 'Como Instalar'}
                </button>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0D3823] text-white flex items-center justify-center font-black text-lg border border-[#D4AF37]">
                    {currentUnit.residentName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#0D3823]">{currentUnit.residentName}</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Unidade Cadastrada: Bloco {currentUnit.block} • Apto {currentUnit.apartment}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRegistrationModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#FFF2B2]" />
                  <span>Editar Cadastro</span>
                </button>
              </div>

              {/* Family WhatsApp List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#0D3823] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Telefones da Família que recebem aviso no WhatsApp ({phonesForDisplay.length}/5)</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {phonesForDisplay.length === 0 ? (
                    <p className="col-span-full text-xs text-slate-500 italic p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                      Nenhum telefone cadastrado. Clique em "Editar Cadastro" para adicionar.
                    </p>
                  ) : (
                    phonesForDisplay.map((p, i) => (
                      <div
                        key={p.id || i}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                            {p.label}
                          </span>
                          <span className="font-mono text-slate-800 font-bold text-xs">{p.number}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">✓ WhatsApp Ativo</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* E-mail */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-bold block text-[11px]">E-mail para Notificações</span>
                  <span className="font-bold text-[#0D3823] text-xs">{currentUnit.residentEmail}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  Notificações Ativas
                </span>
              </div>

              {/* LGPD Status */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#0D3823]" />
                  <div>
                    <span className="font-bold text-[#0D3823] block">Termo LGPD & Privacidade</span>
                    <span className="text-slate-500 text-[11px]">
                      {currentUnit.lgpdAcceptedAt
                        ? `Aceito formalmente em ${new Date(currentUnit.lgpdAcceptedAt).toLocaleDateString('pt-BR')}`
                        : 'Termo aceito e em conformidade com a Lei nº 13.709/2018'}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 shrink-0">
                  Em Conformidade
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 sm:hidden z-30 px-3 py-2 flex items-center justify-around text-[10px] shadow-lg">
        <button
          type="button"
          onClick={() => {
            setActiveTab('disponiveis');
            sound.playScanBeep();
          }}
          className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-3 rounded-lg ${
            activeTab === 'disponiveis' ? 'text-[#D81B60] font-black' : 'text-slate-500 hover:text-[#0D3823]'
          }`}
        >
          <Package className="w-5 h-5" />
          <span>Pendentes</span>
          {availablePackages.length > 0 && (
            <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-[#D81B60] text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
              {availablePackages.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('historico');
            sound.playScanBeep();
          }}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-3 rounded-lg ${
            activeTab === 'historico' ? 'text-[#D81B60] font-black' : 'text-slate-500 hover:text-[#0D3823]'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span>Histórico</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('perfil');
            sound.playScanBeep();
          }}
          className={`flex flex-col items-center gap-1 transition-colors py-1 px-3 rounded-lg ${
            activeTab === 'perfil' ? 'text-[#D81B60] font-black' : 'text-slate-500 hover:text-[#0D3823]'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Cadastro</span>
        </button>
      </div>

      {/* Fullscreen QR Code Modal (para apresentar na portaria) */}
      {fullscreenQrPackage && (
        <div className="fixed inset-0 z-50 bg-[#061D12]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border-2 border-[#D4AF37] max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setFullscreenQrPackage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="pt-2">
              <VillageAzaleiaLogo variant="icon" size="sm" />
              <h3 className="text-base font-black text-[#0D3823] mt-2">Apresente na Portaria</h3>
              <p className="text-xs text-slate-500 font-medium">
                QR Code oficial para retirada da encomenda
              </p>
              {fullscreenQrPackage.residentName && (
                <p className="text-[11px] text-[#D81B60] font-bold mt-1">
                  Destinatário: {fullscreenQrPackage.residentName} • Qualquer morador do apartamento pode retirar
                </p>
              )}
            </div>

            {/* QR Code Display High Def */}
            <div className="p-4 bg-white rounded-2xl border-2 border-[#D4AF37]/50 shadow-inner inline-block">
              <QRCodeDisplay
                value={fullscreenQrPackage.qrToken || `QR-B${fullscreenQrPackage.block}A${fullscreenQrPackage.apartment}-${fullscreenQrPackage.id}`}
                size={220}
              />
            </div>

            <div className="p-3 rounded-xl bg-[#FCE4EC] border border-[#F48FB1] text-xs text-[#AD1457] font-bold">
              {fullscreenQrPackage.carrier} • Estante {fullscreenQrPackage.shelf.shelf}{fullscreenQrPackage.shelf.level}
            </div>

            <button
              type="button"
              onClick={() => setFullscreenQrPackage(null)}
              className="w-full py-3 rounded-xl bg-[#0D3823] hover:bg-[#15462D] text-white font-black text-xs shadow-md transition-all"
            >
              Fechar QR Code
            </button>
          </div>
        </div>
      )}

      {/* Central Notifications Drawer */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl space-y-4 animate-in slide-in-from-right duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-[#D81B60]" />
                  <h3 className="text-base font-black text-[#0D3823]">Central de Notificações</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotificationDrawer(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-1">
                {myNotifications.length > 0 ? (
                  myNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#D81B60] text-xs">{notif.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(notif.timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{notif.body}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-slate-400 text-xs">
                    <BellRing className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    Nenhuma notificação registrada ainda.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNotificationDrawer(false)}
              className="w-full py-3 rounded-xl bg-[#0D3823] text-white font-bold text-xs"
            >
              Fechar Notificações
            </button>
          </div>
        </div>
      )}

      {/* Digital Delivery Receipt Modal */}
      {selectedReceipt && (
        <DeliveryReceiptModal
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          pkg={selectedReceipt}
          unit={currentUnit}
          onShowToast={onShowToast}
        />
      )}

      {/* Profile & Contacts Edit Modal */}
      {showRegistrationModal && (
        <MoradorRegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          currentUnit={currentUnit}
          onSaveUnit={(updated) => {
            if (onUpdateUnit) onUpdateUnit(updated);
            setShowRegistrationModal(false);
          }}
          onShowToast={onShowToast}
          mode="edit"
        />
      )}
    </div>
  );
};
