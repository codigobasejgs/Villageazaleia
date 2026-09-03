import React, { useState, useMemo } from 'react';
import { PackageItem, Unit } from '../types';
import {
  QrCode,
  CheckCircle2,
  PackageCheck,
  PlusCircle,
  Archive,
  Search,
  PenTool
} from 'lucide-react';
import { sound } from '../utils/audio';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { HandoverModal } from './HandoverModal';
import { DeliveryReceiptModal } from './DeliveryReceiptModal';
import { PackageIntakeFlow, PackageIntakePayload } from './PackageIntakeFlow';
import { ShelfOccupancyMap } from './ShelfOccupancyMap';

interface PortariaViewProps {
  packages: PackageItem[];
  units: Unit[];
  /** Nome do porteiro logado (vem da sessão — ver src/services/auth.service.ts) */
  operatorName: string;
  onAddPackage: (pkg: PackageIntakePayload) => Promise<boolean>;
  onPickupPackage: (
    pkgId: string,
    pickedUpBy: string,
    operatorName: string,
    signatureUrl?: string | null,
    handoverPhotoUrl?: string | null,
    receiptProtocol?: string
  ) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PortariaView: React.FC<PortariaViewProps> = ({
  packages,
  units,
  operatorName,
  onAddPackage,
  onPickupPackage,
  onShowToast
}) => {
  // A função principal da Portaria agora é a Saída (escanear o QR do morador e entregar) —
  // a Entrada continua disponível (ela também pode escanear/cadastrar), mas é secundária.
  const [activeTab, setActiveTab] = useState<'saida' | 'entrada' | 'estantes'>('saida');

  // SAIDA / CHECKOUT STATE
  const [qrSearchCode, setQrSearchCode] = useState('');
  const [selectedPackageForCheckout, setSelectedPackageForCheckout] = useState<PackageItem | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [filterTextSaida, setFilterTextSaida] = useState('');

  // HANDOVER & RECEIPT MODALS STATE
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverPkg, setHandoverPkg] = useState<PackageItem | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptPkg, setReceiptPkg] = useState<PackageItem | null>(null);

  // Pending packages (Status ARMAZENADA or RECEBIDA)
  const pendingPackages = useMemo(() => {
    return packages.filter(p => p.status !== 'RETIRADA');
  }, [packages]);

  // Open Handover Modal for photo + digital signature
  const handleOpenHandover = (pkg?: PackageItem) => {
    const target = pkg || selectedPackageForCheckout;
    if (!target) return;
    setHandoverPkg(target);
    setIsHandoverModalOpen(true);
    sound.playScanBeep();
  };

  // Confirm Handover from HandoverModal (Photo + Signature)
  const handleConfirmHandoverFromModal = (
    pkgId: string,
    pickedUpBy: string,
    opName: string,
    signatureUrl: string | null,
    handoverPhotoUrl: string | null
  ) => {
    const protocol = `REC-VA-${Date.now().toString().slice(-8)}`;
    onPickupPackage(pkgId, pickedUpBy, opName, signatureUrl, handoverPhotoUrl, protocol);
    sound.playCheckout();

    // Setup package for immediate digital receipt display
    const target = packages.find(p => p.id === pkgId);
    if (target) {
      const completedPkg: PackageItem = {
        ...target,
        status: 'RETIRADA',
        pickedUpAt: new Date().toISOString(),
        pickedUpBy: pickedUpBy || target.residentName,
        operatorName: opName || operatorName,
        signatureUrl: signatureUrl || undefined,
        handoverPhotoUrl: handoverPhotoUrl || undefined,
        receiptProtocol: protocol
      };
      setReceiptPkg(completedPkg);
      setIsReceiptModalOpen(true);
    }

    onShowToast(`Baixa e Recibo gerados com sucesso para ${pickedUpBy || 'o morador'}!`, 'success');
    setSelectedPackageForCheckout(null);
    setReceiverName('');
    setQrSearchCode('');
  };

  // Search by QR code in Saída tab
  const handleQrSearch = (code: string) => {
    setQrSearchCode(code);
    const found = pendingPackages.find(
      p => p.qrToken.toLowerCase() === code.trim().toLowerCase() ||
           p.trackingCode.toLowerCase() === code.trim().toLowerCase() ||
           p.id.toLowerCase() === code.trim().toLowerCase()
    );
    if (found) {
      sound.playScanBeep();
      setSelectedPackageForCheckout(found);
      setReceiverName(found.residentName);
      onShowToast(`Encomenda localizada: ${found.trackingCode}`, 'success');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Subheader & Tabs with Village Azaleia Branding */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4.5 rounded-2xl border border-[#D4AF37]/35 shadow-md">
        <div className="flex items-center gap-3.5">
          <VillageAzaleiaLogo variant="icon" size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-brand font-bold text-xs tracking-wider text-[#D81B60] uppercase">
                Portaria Central
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <span className="text-xs font-semibold text-[#0D3823]">Village Azaleia</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0D3823] tracking-tight">
              Retirada & Triagem de Encomendas
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Operador: <strong className="text-[#0D3823]">{operatorName}</strong> •{' '}
              <span className="text-[#D81B60] font-bold">{pendingPackages.length} aguardando retirada</span>
            </p>
          </div>
        </div>

        {/* Tab Selector — Saída primeiro: é o papel principal da Portaria (escanear QR do
            morador e confirmar a entrega). Entrada continua disponível, como apoio. */}
        <div className="flex bg-[#061D12] p-1.5 rounded-xl border border-[#D4AF37]/40 self-start md:self-auto shadow-inner">
          <button
            onClick={() => { setActiveTab('saida'); sound.playScanBeep(); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all relative ${
              activeTab === 'saida'
                ? 'bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md ring-1 ring-[#FFF2B2]/50'
                : 'text-emerald-100/70 hover:text-white'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-[#FFF2B2]" />
            <span>1. Saída / Entregar</span>
            {pendingPackages.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FFF2B2] text-[#AD1457] font-extrabold shadow-sm">
                {pendingPackages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('entrada'); sound.playScanBeep(); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'entrada'
                ? 'bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md ring-1 ring-[#FFF2B2]/50'
                : 'text-emerald-100/70 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-[#FFF2B2]" />
            <span>2. Entrada / Receber</span>
          </button>

          <button
            onClick={() => { setActiveTab('estantes'); sound.playScanBeep(); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
              activeTab === 'estantes'
                ? 'bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white shadow-md ring-1 ring-[#FFF2B2]/50'
                : 'text-emerald-100/70 hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4 text-[#FFF2B2]" />
            <span>3. Mapa de Estantes</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SAÍDA / BAIXA RÁPIDA — escanear o QR do celular do morador e registrar a entrega */}
      {activeTab === 'saida' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* QR Code Scanner & Search Bar */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-6 shadow-md space-y-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#0D3823] flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#D81B60]" />
                  <span>Leitura do QR Code do Morador</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Aproxime o smartphone do morador com o QR Code ou digite o código de rastreio
                </p>
              </div>

              {/* QR Code Reader */}
              <div className="relative">
                <QrCode className="w-4 h-4 text-[#D81B60] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={qrSearchCode}
                  onChange={(e) => handleQrSearch(e.target.value)}
                  placeholder="Código QR (Ex: QR-B03A102-PKG001) ou Rastreio..."
                  className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0D3823] font-mono focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
                  autoFocus
                />
              </div>
            </div>

            {/* List of all pending packages to click and checkout */}
            <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-[#0D3823]">
                  Todas as Encomendas Pendentes ({pendingPackages.length})
                </h4>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={filterTextSaida}
                  onChange={(e) => setFilterTextSaida(e.target.value)}
                  placeholder="Filtrar por nome, apto ou rastreio..."
                  className="w-full bg-[#F8F9FA] border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#0D3823] focus:outline-none focus:border-[#D81B60]"
                />
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {pendingPackages
                  .filter(p =>
                    !filterTextSaida ||
                    p.residentName.toLowerCase().includes(filterTextSaida.toLowerCase()) ||
                    p.trackingCode.toLowerCase().includes(filterTextSaida.toLowerCase()) ||
                    `bloco ${p.block} apt ${p.apartment}`.toLowerCase().includes(filterTextSaida.toLowerCase())
                  )
                  .map((p) => {
                    const isSelected = selectedPackageForCheckout?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPackageForCheckout(p);
                          setReceiverName(p.residentName);
                          sound.playScanBeep();
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#FCE4EC] border-[#D81B60] shadow-sm ring-2 ring-[#D81B60]/30'
                            : 'bg-[#F8F9FA] hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={p.photoUrl}
                            alt="Box"
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-extrabold text-[#0D3823] text-xs sm:text-sm">
                              Bloco {p.block} - Apt {p.apartment}
                            </div>
                            <div className="text-xs text-slate-700 font-medium">{p.residentName}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {p.trackingCode}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-extrabold px-2.5 py-1 rounded bg-[#0D3823] text-[#FFF2B2] border border-[#D4AF37]/40 shadow-sm">
                            {p.shelf.shelf}{p.shelf.level}
                          </span>
                          <div className="text-[10px] text-slate-500 font-semibold mt-1">{p.carrier}</div>
                        </div>
                      </div>
                    );
                  })}

                {pendingPackages.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    Nenhuma encomenda pendente na portaria no momento!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Checkout Action Panel */}
          <div className="lg:col-span-7">
            {selectedPackageForCheckout ? (
              <div className="bg-white rounded-2xl border border-[#D4AF37]/40 p-6 shadow-md space-y-6 text-[#1A2E22]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-xs font-extrabold text-[#D81B60] uppercase tracking-wider">
                      Confirmação de Retirada
                    </span>
                    <h3 className="text-xl font-black text-[#0D3823]">
                      Bloco {selectedPackageForCheckout.block} — Apartamento {selectedPackageForCheckout.apartment}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FCE4EC] text-[#AD1457] border border-[#F48FB1] text-xs font-bold">
                    Pronto para Retirada
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo & location */}
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden border border-[#D4AF37]/30 bg-slate-100 h-44 relative shadow-sm">
                      <img
                        src={selectedPackageForCheckout.photoUrl}
                        alt="Foto Encomenda"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-[#061D12]/90 backdrop-blur-sm text-white text-xs font-bold border border-[#D4AF37]/40">
                        {selectedPackageForCheckout.carrier}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-semibold">Local de Guarda:</span>
                      <span className="text-sm font-extrabold text-[#0D3823] bg-white px-2.5 py-1 rounded-lg border border-[#A5D6A7] shadow-sm">
                        Estante {selectedPackageForCheckout.shelf.shelf} — Prateleira {selectedPackageForCheckout.shelf.level}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-slate-200 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Morador Titular:</span>
                        <span className="font-bold text-[#0D3823]">{selectedPackageForCheckout.residentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Código de Rastreio:</span>
                        <span className="font-mono font-bold text-[#0D3823]">{selectedPackageForCheckout.trackingCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recebido em:</span>
                        <span className="text-slate-700 font-medium">
                          {new Date(selectedPackageForCheckout.receivedAt).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(selectedPackageForCheckout.receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Registrado por:</span>
                        <span className="text-slate-700">{selectedPackageForCheckout.operatorName || 'Portaria'}</span>
                      </div>
                      {selectedPackageForCheckout.notes && (
                        <div className="pt-2 border-t border-slate-200 text-slate-600 italic">
                          "{selectedPackageForCheckout.notes}"
                        </div>
                      )}
                    </div>

                    {/* QR Code Verification badge */}
                    <div className="p-3 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#0D3823] shrink-0" />
                      <div>
                        <div className="font-bold text-[#0D3823] text-xs">QR Code Validado</div>
                        <div className="text-[11px] text-slate-600 font-mono">{selectedPackageForCheckout.qrToken}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Receiver name input & Confirmation Button */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-[#0D3823] mb-1.5">
                      Nome de quem está retirando na portaria:
                    </label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="Ex: Próprio morador ou familiar / procurador"
                      className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-[#0D3823] font-semibold focus:outline-none focus:border-[#D81B60]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedPackageForCheckout(null)}
                      className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-slate-300"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenHandover(selectedPackageForCheckout)}
                      className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#D81B60] via-[#E91E63] to-[#AD1457] hover:from-[#AD1457] hover:to-[#880E4F] text-white font-extrabold text-sm shadow-lg shadow-[#D81B60]/30 transition-all flex items-center justify-center gap-2 transform active:scale-[0.99] border border-[#FFF2B2]/30"
                    >
                      <PenTool className="w-5 h-5 text-[#FFF2B2]" />
                      <span>Coletar Assinatura Digital & Emitir Recibo</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-12 shadow-md flex flex-col items-center justify-center text-center space-y-3 h-full min-h-[350px]">
                <div className="w-16 h-16 rounded-2xl bg-[#FCE4EC] border border-[#F48FB1] flex items-center justify-center text-[#D81B60] shadow-sm">
                  <PackageCheck className="w-8 h-8" />
                </div>
                <h4 className="text-base font-extrabold text-[#0D3823]">Nenhuma encomenda selecionada</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Digite ou escaneie o código QR do morador ao lado, ou selecione uma encomenda da lista de pendentes para efetuar a entrega.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ENTRADA / RECEBIMENTO — a Portaria também pode escanear/cadastrar, mesmo fluxo do Totem */}
      {activeTab === 'entrada' && (
        <PackageIntakeFlow
          packages={packages}
          units={units}
          onAddPackage={onAddPackage}
          onShowToast={onShowToast}
          registeredVia="PORTARIA"
          operatorName={operatorName}
        />
      )}

      {/* TAB 3: MAPA DE ESTANTES */}
      {activeTab === 'estantes' && (
        <ShelfOccupancyMap
          pendingPackages={pendingPackages}
          onSelectPackage={(p) => {
            setActiveTab('saida');
            setSelectedPackageForCheckout(p);
            setReceiverName(p.residentName);
          }}
        />
      )}

      {/* HANDOVER MODAL (ASSINATURA DIGITAL + FOTO LGPD) */}
      <HandoverModal
        isOpen={isHandoverModalOpen}
        onClose={() => {
          setIsHandoverModalOpen(false);
          setHandoverPkg(null);
        }}
        pkg={handoverPkg}
        unit={units.find(u => handoverPkg && u.block === handoverPkg.block && u.apartment === handoverPkg.apartment)}
        operatorName={operatorName}
        onConfirmHandover={handleConfirmHandoverFromModal}
        onShowToast={onShowToast}
      />

      {/* DELIVERY RECEIPT MODAL (EMISSÃO AUTOMÁTICA DE RECIBO) */}
      <DeliveryReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setReceiptPkg(null);
        }}
        pkg={receiptPkg}
        unit={units.find(u => receiptPkg && u.block === receiptPkg.block && u.apartment === receiptPkg.apartment)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
