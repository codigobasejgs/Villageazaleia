import React, { useState, useMemo } from 'react';
import { PackageItem, ActivityLog, Carrier, Unit, PackageStatus, AuditFilterParams } from '../types';
import { CARRIER_CONFIG, SHELF_CONFIG } from '../data/mockData';
import {
  BarChart3,
  TrendingUp,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Filter,
  Layers,
  Calendar,
  Building,
  User,
  ShieldCheck,
  FileSpreadsheet,
  RotateCcw,
  SlidersHorizontal,
  X,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  QrCode
} from 'lucide-react';
import { sound } from '../utils/audio';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { DeliveryReceiptModal } from './DeliveryReceiptModal';
import { Printer, FileCheck } from 'lucide-react';

interface SindicoDashboardProps {
  packages: PackageItem[];
  logs: ActivityLog[];
  units: Unit[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const SindicoDashboard: React.FC<SindicoDashboardProps> = ({
  packages,
  logs,
  units,
  onShowToast
}) => {
  // Advanced Filter state (draft vs applied)
  const defaultFilters: AuditFilterParams = {
    searchTerm: '',
    carrier: 'ALL',
    block: 'ALL',
    apartment: '',
    status: 'ALL',
    dateType: 'ENTRADA',
    startDate: '',
    endDate: ''
  };

  const [filterInputs, setFilterInputs] = useState<AuditFilterParams>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilterParams>(defaultFilters);
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState<boolean>(true);
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageItem | null>(null);
  const [receiptPkgForSindico, setReceiptPkgForSindico] = useState<PackageItem | null>(null);

  // Apply filters action
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    sound.playScanBeep();
    setAppliedFilters({ ...filterInputs });
    onShowToast('Filtros de auditoria aplicados com sucesso!', 'info');
  };

  // Reset filters
  const handleResetFilters = () => {
    sound.playScanBeep();
    setFilterInputs(defaultFilters);
    setAppliedFilters(defaultFilters);
    onShowToast('Filtros de busca limpos.', 'info');
  };

  // Quick date presets
  const handleQuickDatePreset = (preset: 'today' | 'last7days' | 'last30days' | 'clear') => {
    sound.playScanBeep();
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const todayStr = formatDate(today);
      setFilterInputs(prev => ({ ...prev, startDate: todayStr, endDate: todayStr }));
    } else if (preset === 'last7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setFilterInputs(prev => ({ ...prev, startDate: formatDate(past), endDate: formatDate(today) }));
    } else if (preset === 'last30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setFilterInputs(prev => ({ ...prev, startDate: formatDate(past), endDate: formatDate(today) }));
    } else {
      setFilterInputs(prev => ({ ...prev, startDate: '', endDate: '' }));
    }
  };

  // Remove single active filter
  const handleRemoveActiveFilter = (key: keyof AuditFilterParams) => {
    const updated = { ...appliedFilters, [key]: key === 'searchTerm' || key === 'apartment' || key === 'startDate' || key === 'endDate' ? '' : 'ALL' };
    setAppliedFilters(updated);
    setFilterInputs(updated);
    sound.playScanBeep();
  };

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.searchTerm) count++;
    if (appliedFilters.carrier !== 'ALL') count++;
    if (appliedFilters.block !== 'ALL') count++;
    if (appliedFilters.apartment) count++;
    if (appliedFilters.status !== 'ALL') count++;
    if (appliedFilters.startDate || appliedFilters.endDate) count++;
    return count;
  }, [appliedFilters]);

  // KPI Calculations
  const totalPackages = packages.length;
  const pendingPackages = useMemo(() => packages.filter(p => p.status !== 'RETIRADA'), [packages]);
  const pickedUpPackages = useMemo(() => packages.filter(p => p.status === 'RETIRADA'), [packages]);

  // Shelf Total Capacity vs Used
  const totalShelfCapacity = SHELF_CONFIG.reduce((acc, s) => acc + s.maxPerLevel * 4, 0);
  const shelfOccupancyRate = Math.round((pendingPackages.length / totalShelfCapacity) * 100);

  // Carrier distribution data for Donut Chart
  const carrierDistribution = useMemo(() => {
    const counts: Record<Carrier, number> = {
      'Mercado Livre': 0,
      'Amazon': 0,
      'Correios': 0,
      'Shopee': 0,
      'Loggi': 0,
      'Outra': 0
    };

    packages.forEach(p => {
      if (counts[p.carrier] !== undefined) {
        counts[p.carrier]++;
      } else {
        counts['Outra']++;
      }
    });

    return (Object.keys(counts) as Carrier[])
      .map(c => ({
        carrier: c,
        count: counts[c],
        percentage: totalPackages > 0 ? Math.round((counts[c] / totalPackages) * 100) : 0,
        color: CARRIER_CONFIG[c]?.color || '#94A3B8'
      }))
      .filter(item => item.count > 0);
  }, [packages, totalPackages]);

  // Blocos distintos cadastrados (podem ter letra, ex: "12B") em ordem natural
  const distinctBlocks = useMemo(() => {
    return Array.from(new Set<string>(units.map(u => u.block))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [units]);

  // Block distribution for Bar Chart
  const blockDistribution = useMemo(() => {
    return distinctBlocks.map((block) => ({
      block,
      count: packages.filter(p => p.block === block).length
    }));
  }, [packages, distinctBlocks]);

  // Filtered Audit Table based on appliedFilters
  const filteredPackages = useMemo(() => {
    return packages.filter(p => {
      // 1. Text search
      if (appliedFilters.searchTerm) {
        const term = appliedFilters.searchTerm.toLowerCase();
        const matchesResident = p.residentName.toLowerCase().includes(term);
        const matchesTracking = p.trackingCode.toLowerCase().includes(term);
        const matchesUnit = `bloco ${p.block} apt ${p.apartment}`.toLowerCase().includes(term);
        const matchesCarrier = p.carrier.toLowerCase().includes(term);
        const matchesOperator = (p.operatorName || '').toLowerCase().includes(term);
        const matchesPicker = (p.pickedUpBy || '').toLowerCase().includes(term);
        const matchesShelf = `estante ${p.shelf.shelf}${p.shelf.level}`.toLowerCase().includes(term);

        if (!matchesResident && !matchesTracking && !matchesUnit && !matchesCarrier && !matchesOperator && !matchesPicker && !matchesShelf) {
          return false;
        }
      }

      // 2. Carrier filter
      if (appliedFilters.carrier !== 'ALL' && p.carrier !== appliedFilters.carrier) {
        return false;
      }

      // 3. Block filter
      if (appliedFilters.block !== 'ALL' && p.block !== appliedFilters.block) {
        return false;
      }

      // 4. Apartment filter
      if (appliedFilters.apartment && String(p.apartment) !== appliedFilters.apartment.trim()) {
        return false;
      }

      // 5. Status filter (RECEBIDA, ARMAZENADA, RETIRADA)
      if (appliedFilters.status !== 'ALL') {
        if (appliedFilters.status === 'RECEBIDA') {
          // If registered via totem/portaria
          if (p.status !== 'RECEBIDA' && p.status !== 'ARMAZENADA') return false;
        } else if (p.status !== appliedFilters.status) {
          return false;
        }
      }

      // 6. Date Range filter (Entrada or Retirada)
      const targetDateStr = appliedFilters.dateType === 'ENTRADA' ? p.receivedAt : p.pickedUpAt;

      if (appliedFilters.startDate) {
        if (!targetDateStr) return false;
        const targetDate = new Date(targetDateStr);
        const startDate = new Date(`${appliedFilters.startDate}T00:00:00`);
        if (targetDate < startDate) return false;
      }

      if (appliedFilters.endDate) {
        if (!targetDateStr) return false;
        const targetDate = new Date(targetDateStr);
        const endDate = new Date(`${appliedFilters.endDate}T23:59:59.999`);
        if (targetDate > endDate) return false;
      }

      return true;
    });
  }, [packages, appliedFilters]);

  // Export CSV based on filtered records
  const handleExportCSV = () => {
    sound.playSuccess();
    const headers = ['ID,Rastreio,Bloco,Apartamento,Morador,Transportadora,Status,Estante,DataRecebimento,DataRetirada,RetiradoPor,OperadorPortaria\n'];
    const rows = filteredPackages.map(p =>
      `"${p.id}","${p.trackingCode}","${p.block}","${p.apartment}","${p.residentName}","${p.carrier}","${p.status}","${p.shelf.shelf}${p.shelf.level}","${p.receivedAt}","${p.pickedUpAt || ''}","${p.pickedUpBy || ''}","${p.operatorName || ''}"`
    );
    const blob = new Blob([headers.concat(rows.join('\n')).join('')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_village_azaleia_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onShowToast(`Relatório com ${filteredPackages.length} registro(s) exportado em CSV com sucesso!`, 'success');
  };

  // Calculate SVG Donut chart paths
  const donutPaths = useMemo(() => {
    let cumulativeAngle = 0;
    const size = 200;
    const center = size / 2;
    const radius = 75;
    const innerRadius = 50;

    return carrierDistribution.map((item) => {
      const angle = (item.count / (totalPackages || 1)) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const x3 = center + innerRadius * Math.cos(endRad);
      const y3 = center + innerRadius * Math.sin(endRad);
      const x4 = center + innerRadius * Math.cos(startRad);
      const y4 = center + innerRadius * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
        'Z'
      ].join(' ');

      return {
        ...item,
        pathData
      };
    });
  }, [carrierDistribution, totalPackages]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 text-[#1A2E22]">
      {/* Header with Village Azaleia Branding */}
      <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] rounded-3xl border border-[#D4AF37]/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-[#D81B60]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur-md text-[#FFF2B2] border border-[#D4AF37]/40 flex items-center justify-center shadow-inner">
            <VillageAzaleiaLogo variant="icon" size="md" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#D81B60]/30 text-[#FFF2B2] font-bold border border-[#D81B60]/50 uppercase tracking-wider">
                Gestão & Administração
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <span className="text-xs text-white/80 font-semibold">Residencial Village Azaleia</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-brand">
              Painel de Controle do Síndico & Auditoria
            </h2>
            <p className="text-xs text-white/80 font-medium">
              Visão analítica de fluxo, auditoria de retiradas e controle de inventário
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D81B60] to-[#AD1457] hover:from-[#AD1457] hover:to-[#880E4F] text-white font-extrabold text-xs shadow-lg flex items-center gap-2 transition-all border border-[#FFF2B2]/20"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FFF2B2]" />
            <span>Exportar CSV ({filteredPackages.length})</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Encomendas Hoje */}
        <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-5 shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total de Encomendas</span>
            <div className="p-2 rounded-xl bg-[#FCE4EC] text-[#D81B60] border border-[#F48FB1]">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0D3823]">{totalPackages}</span>
            <span className="text-xs text-[#0D3823] font-extrabold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#D81B60]" /> 100% ativas
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Volume total registrado no condomínio</p>
        </div>

        {/* Pendentes na Portaria */}
        <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-5 shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#D81B60] uppercase tracking-wider">Pendentes na Portaria</span>
            <div className="p-2 rounded-xl bg-[#FCE4EC] text-[#D81B60] border border-[#F48FB1]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#D81B60]">{pendingPackages.length}</span>
            <span className="text-xs text-slate-500 font-semibold">aguardando morador</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Alocadas nas Estantes A, B e C</p>
        </div>

        {/* Retiradas / Baixas */}
        <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-5 shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#0D3823] uppercase tracking-wider">Retiradas / Baixas</span>
            <div className="p-2 rounded-xl bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0D3823]">{pickedUpPackages.length}</span>
            <span className="text-xs text-[#0D3823] font-bold">
              {totalPackages > 0 ? `${Math.round((pickedUpPackages.length / totalPackages) * 100)}% concluídas` : '0%'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Entregues com QR Code ou validação</p>
        </div>

        {/* Ocupação das Estantes */}
        <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-5 shadow-md space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#D4AF37] uppercase tracking-wider">Ocupação das Estantes</span>
            <div className="p-2 rounded-xl bg-[#FFF9C4] text-[#B38F48] border border-[#FFE082]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0D3823]">{shelfOccupancyRate}%</span>
            <span className="text-xs text-slate-500 font-semibold">({pendingPackages.length}/{totalShelfCapacity} slots)</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
            <div
              className={`h-full rounded-full ${shelfOccupancyRate > 70 ? 'bg-[#D81B60]' : 'bg-[#0D3823]'}`}
              style={{ width: `${Math.max(5, shelfOccupancyRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Donut Chart: Transportadoras */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#D4AF37]/35 p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-[#0D3823] flex items-center gap-2">
              <span>Distribuição por Transportadora</span>
            </h3>
            <span className="text-xs text-slate-500 font-semibold">{carrierDistribution.length} parceiras</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {/* SVG Donut */}
            <div className="relative">
              <svg width={180} height={180} viewBox="0 0 200 200" className="transform -rotate-90">
                {donutPaths.map((item, idx) => (
                  <path
                    key={idx}
                    d={item.pathData}
                    fill={item.color}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <title>{`${item.carrier}: ${item.count} encomendas (${item.percentage}%)`}</title>
                  </path>
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-[#0D3823]">{totalPackages}</span>
                <span className="text-[10px] text-slate-500 uppercase font-extrabold">Total</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 w-full sm:w-auto">
              {carrierDistribution.map((item) => (
                <div key={item.carrier} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-[#0D3823] font-bold">{item.carrier}</span>
                  </div>
                  <div className="font-mono text-slate-500 font-semibold">
                    <strong className="text-[#0D3823] font-black">{item.count}</strong> ({item.percentage}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart: Encomendas por Bloco */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#D4AF37]/35 p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-[#0D3823] flex items-center gap-2">
              <span>Volume de Encomendas por Bloco ({distinctBlocks.length} blocos)</span>
            </h3>
            <span className="text-xs text-slate-500 font-semibold">30 aptos / bloco</span>
          </div>

          <div className="h-52 flex items-end justify-between gap-1 sm:gap-2 pt-6 pb-2">
            {blockDistribution.map(({ block, count }) => {
              const maxVal = Math.max(...blockDistribution.map((b) => b.count), 4);
              const heightPct = Math.round((count / maxVal) * 100);

              return (
                <div key={block} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-black text-slate-500 group-hover:text-[#D81B60] transition-colors">
                    {count}
                  </span>
                  <div className="w-full max-w-[28px] bg-slate-100 rounded-t-md h-full flex items-end p-0.5">
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${
                        count > 0 ? 'bg-gradient-to-t from-[#0D3823] to-[#D81B60] group-hover:brightness-110' : 'bg-slate-200'
                      }`}
                      style={{ height: `${Math.max(8, heightPct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-extrabold text-[#0D3823] group-hover:text-[#D81B60] transition-colors">
                    B{block}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ADVANCED SEARCH & AUDIT FILTER PANEL */}
      <div className="bg-white rounded-3xl border-2 border-[#D4AF37]/40 shadow-xl overflow-hidden">
        {/* Panel Header */}
        <div className="bg-gradient-to-r from-[#061D12] via-[#0D3823] to-[#15462D] p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D81B60]/20 border border-[#D81B60]/40 text-[#FFF2B2] flex items-center justify-center shadow-inner">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-brand font-bold text-[11px] text-[#FFF2B2] uppercase tracking-wider">
                  Módulo de Rastreabilidade & Auditoria
                </span>
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#D81B60] text-white text-[10px] font-black animate-pulse">
                    {activeFiltersCount} ativo(s)
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Busca Avançada de Encomendas do Condomínio
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <span>{isFilterPanelExpanded ? 'Recolher Filtros' : 'Expandir Filtros'}</span>
              {isFilterPanelExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Filter Input Form */}
        {isFilterPanelExpanded && (
          <form onSubmit={handleApplyFilters} className="p-6 bg-[#F8F9FA] border-b border-slate-200 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Busca Textual Livre */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-[#0D3823] uppercase">
                  Termo de Busca / Palavra-Chave:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={filterInputs.searchTerm}
                    onChange={(e) => setFilterInputs({ ...filterInputs, searchTerm: e.target.value })}
                    placeholder="Morador, rastreio, estante..."
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-[#0D3823] font-semibold focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
                  />
                  {filterInputs.searchTerm && (
                    <button
                      type="button"
                      onClick={() => setFilterInputs({ ...filterInputs, searchTerm: '' })}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Transportadora */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-[#0D3823] uppercase">
                  Transportadora Parceira:
                </label>
                <select
                  value={filterInputs.carrier}
                  onChange={(e) => setFilterInputs({ ...filterInputs, carrier: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-[#0D3823] font-bold focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
                >
                  <option value="ALL">Todas as Transportadoras</option>
                  {(['Mercado Livre', 'Amazon', 'Correios', 'Shopee', 'Loggi', 'Outra'] as Carrier[]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Unidade: Bloco & Apartamento */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-[#0D3823] uppercase">
                  Bloco & Apartamento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterInputs.block}
                    onChange={(e) => setFilterInputs({ ...filterInputs, block: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs text-[#0D3823] font-bold focus:outline-none focus:border-[#D81B60] shadow-inner"
                  >
                    <option value="ALL">Todos Blocos</option>
                    {distinctBlocks.map((b) => (
                      <option key={b} value={b}>
                        Bloco {b}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={filterInputs.apartment}
                    onChange={(e) => setFilterInputs({ ...filterInputs, apartment: e.target.value })}
                    placeholder="Apt (Ex: 102)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs text-[#0D3823] font-bold focus:outline-none focus:border-[#D81B60] shadow-inner"
                  />
                </div>
              </div>

              {/* 4. Status da Encomenda */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-[#0D3823] uppercase">
                  Status no Condomínio:
                </label>
                <select
                  value={filterInputs.status}
                  onChange={(e) => setFilterInputs({ ...filterInputs, status: e.target.value as 'ALL' | PackageStatus })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-[#0D3823] font-bold focus:outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#D81B60]/20 shadow-inner"
                >
                  <option value="ALL">Todos os Status</option>
                  <option value="ARMAZENADA">ARMAZENADA (Pendente na Estante)</option>
                  <option value="RETIRADA">RETIRADA (Entregue ao Morador)</option>
                  <option value="RECEBIDA">RECEBIDA (Em Triagem Inicial)</option>
                </select>
              </div>
            </div>

            {/* Date Range Row */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#D81B60]" />
                  <span className="text-xs font-extrabold text-[#0D3823] uppercase">
                    Filtro por Intervalo de Datas:
                  </span>
                </div>

                {/* Date presets */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400 font-medium mr-1">Atalhos:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickDatePreset('today')}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-[#FCE4EC] hover:text-[#AD1457] text-slate-700 font-bold transition-colors"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDatePreset('last7days')}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-[#FCE4EC] hover:text-[#AD1457] text-slate-700 font-bold transition-colors"
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDatePreset('last30days')}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-[#FCE4EC] hover:text-[#AD1457] text-slate-700 font-bold transition-colors"
                  >
                    Últimos 30 dias
                  </button>
                  {(filterInputs.startDate || filterInputs.endDate) && (
                    <button
                      type="button"
                      onClick={() => handleQuickDatePreset('clear')}
                      className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Limpar datas
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">Base da Data:</label>
                  <select
                    value={filterInputs.dateType}
                    onChange={(e) => setFilterInputs({ ...filterInputs, dateType: e.target.value as 'ENTRADA' | 'RETIRADA' })}
                    className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#0D3823] font-semibold focus:outline-none focus:border-[#D81B60]"
                  >
                    <option value="ENTRADA">Data de Entrada (Recebimento)</option>
                    <option value="RETIRADA">Data de Retirada (Baixa)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">Data Inicial:</label>
                  <input
                    type="date"
                    value={filterInputs.startDate}
                    onChange={(e) => setFilterInputs({ ...filterInputs, startDate: e.target.value })}
                    className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#0D3823] font-semibold focus:outline-none focus:border-[#D81B60]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">Data Final:</label>
                  <input
                    type="date"
                    value={filterInputs.endDate}
                    onChange={(e) => setFilterInputs({ ...filterInputs, endDate: e.target.value })}
                    className="w-full bg-[#F8F9FA] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#0D3823] font-semibold focus:outline-none focus:border-[#D81B60]"
                  />
                </div>
              </div>
            </div>

            {/* Buttons Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 font-medium">
                Pressione <strong>Aplicar Busca</strong> para filtrar instantaneamente todas as encomendas registradas.
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Limpar Filtros</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D81B60] via-[#AD1457] to-[#880E4F] hover:from-[#AD1457] hover:to-[#730941] text-white font-extrabold text-xs shadow-lg shadow-[#D81B60]/25 flex items-center gap-2 transition-all w-full sm:w-auto justify-center border border-[#FFF2B2]/20"
                >
                  <Search className="w-4 h-4 text-[#FFF2B2]" />
                  <span>Aplicar Busca & Filtrar</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Active Filter Chips & Results Summary */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-[#0D3823]">
              Resultados: <span className="text-[#D81B60]">{filteredPackages.length}</span> de {totalPackages} encomendas
            </span>

            {/* Active chips */}
            {appliedFilters.searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FCE4EC] border border-[#F48FB1] text-[11px] font-bold text-[#AD1457]">
                <span>Busca: "{appliedFilters.searchTerm}"</span>
                <button type="button" onClick={() => handleRemoveActiveFilter('searchTerm')} className="hover:text-black">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {appliedFilters.carrier !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F5E9] border border-[#A5D6A7] text-[11px] font-bold text-[#0D3823]">
                <span>Transportadora: {appliedFilters.carrier}</span>
                <button type="button" onClick={() => handleRemoveActiveFilter('carrier')} className="hover:text-black">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {appliedFilters.block !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800">
                <span>Bloco {appliedFilters.block}</span>
                <button type="button" onClick={() => handleRemoveActiveFilter('block')} className="hover:text-black">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {appliedFilters.apartment && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800">
                <span>Apt {appliedFilters.apartment}</span>
                <button type="button" onClick={() => handleRemoveActiveFilter('apartment')} className="hover:text-black">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {appliedFilters.status !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF9C4] border border-[#FFE082] text-[11px] font-bold text-[#B38F48]">
                <span>Status: {appliedFilters.status}</span>
                <button type="button" onClick={() => handleRemoveActiveFilter('status')} className="hover:text-black">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(appliedFilters.startDate || appliedFilters.endDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-800">
                <span>
                  {appliedFilters.dateType === 'ENTRADA' ? 'Entrada' : 'Retirada'}: {appliedFilters.startDate || 'início'} até {appliedFilters.endDate || 'fim'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveActiveFilter('startDate');
                    handleRemoveActiveFilter('endDate');
                  }}
                  className="hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-[#D81B60] hover:underline font-extrabold flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Limpar todos os filtros
            </button>
          )}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FA] text-[#0D3823] font-black uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Unidade Destino</th>
                <th className="px-4 py-3.5">Morador</th>
                <th className="px-4 py-3.5">Transportadora</th>
                <th className="px-4 py-3.5">Código Rastreio</th>
                <th className="px-4 py-3.5">Local Estante</th>
                <th className="px-4 py-3.5">Status Atual</th>
                <th className="px-4 py-3.5">Data Entrada</th>
                <th className="px-4 py-3.5">Baixa / Responsável</th>
                <th className="px-4 py-3.5 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredPackages.map((pkg) => {
                const cfg = CARRIER_CONFIG[pkg.carrier] || { icon: '📦', color: '#94A3B8' };
                const isPending = pkg.status !== 'RETIRADA';
                return (
                  <tr
                    key={pkg.id}
                    className="hover:bg-[#FCE4EC]/20 transition-colors group cursor-pointer"
                    onClick={() => setSelectedPackageDetail(pkg)}
                  >
                    <td className="px-4 py-3.5 font-black text-[#0D3823] whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] border border-[#A5D6A7] text-[#0D3823] font-black">
                        B{pkg.block} • Apt {pkg.apartment}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-bold whitespace-nowrap">
                      {pkg.residentName}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#F8F9FA] border border-slate-200 text-[#0D3823]">
                        <span>{cfg.icon}</span>
                        <span>{pkg.carrier}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[#0D3823] font-bold whitespace-nowrap">
                      {pkg.trackingCode}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] text-[#0D3823] font-black text-[11px] border border-[#A5D6A7]">
                        Estante {pkg.shelf.shelf}{pkg.shelf.level}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isPending ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#FCE4EC] text-[#AD1457] border border-[#F48FB1] inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Pendente</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Retirada Concluída</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap font-medium text-[11px]">
                      {new Date(pkg.receivedAt).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(pkg.receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap font-medium text-[11px]">
                      {pkg.pickedUpAt ? (
                        <div>
                          <div className="font-bold text-[#0D3823]">{new Date(pkg.pickedUpAt).toLocaleString('pt-BR')}</div>
                          <div className="text-[10px] text-[#D81B60] font-extrabold">Por: {pkg.pickedUpBy || pkg.residentName}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPackageDetail(pkg);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#D81B60] hover:text-white text-slate-600 transition-colors"
                        title="Ver detalhes completos"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredPackages.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500 text-xs">
                    <div className="max-w-md mx-auto space-y-2">
                      <Package className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="font-extrabold text-sm text-[#0D3823]">
                        Nenhuma encomenda encontrada com os filtros selecionados.
                      </div>
                      <p className="text-slate-400 text-xs">
                        Tente ajustar o termo de busca, remover o filtro de datas ou alterar a transportadora.
                      </p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-4 py-2 rounded-xl bg-[#0D3823] text-white font-bold text-xs"
                      >
                        Redefinir Filtros
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Detail Modal */}
      {selectedPackageDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-[#D4AF37] max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <VillageAzaleiaLogo variant="icon" size="sm" />
                <h4 className="font-black text-[#0D3823] text-base">
                  Ficha de Auditoria da Encomenda
                </h4>
              </div>
              <button
                onClick={() => setSelectedPackageDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 h-44 shadow-inner">
                <img
                  src={selectedPackageDetail.photoUrl}
                  alt="Foto Pacote"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Unidade:</span>
                  <div className="text-sm font-black text-[#0D3823]">
                    Bloco {selectedPackageDetail.block} — Apt {selectedPackageDetail.apartment}
                  </div>
                  <div className="text-slate-600 font-medium">Morador: {selectedPackageDetail.residentName}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#FCE4EC] border border-[#F48FB1]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Transportadora & Código:</span>
                  <div className="font-black text-[#AD1457]">{selectedPackageDetail.carrier}</div>
                  <div className="font-mono font-bold text-[#0D3823]">{selectedPackageDetail.trackingCode}</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Local na Portaria:</span>
                <span className="font-bold text-[#0D3823]">Estante {selectedPackageDetail.shelf.shelf}{selectedPackageDetail.shelf.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Atual:</span>
                <span className="font-extrabold text-[#D81B60]">{selectedPackageDetail.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data de Entrada:</span>
                <span className="font-medium text-slate-700">{new Date(selectedPackageDetail.receivedAt).toLocaleString('pt-BR')}</span>
              </div>
              {selectedPackageDetail.pickedUpAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Data de Retirada:</span>
                  <span className="font-bold text-emerald-700">{new Date(selectedPackageDetail.pickedUpAt).toLocaleString('pt-BR')}</span>
                </div>
              )}
              {selectedPackageDetail.pickedUpBy && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Retirado por:</span>
                  <span className="font-bold text-[#0D3823]">{selectedPackageDetail.pickedUpBy}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Registro via:</span>
                <span className="font-medium text-slate-700">{selectedPackageDetail.registeredVia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Token QR Code:</span>
                <span className="font-mono text-[10px] text-slate-600">{selectedPackageDetail.qrToken}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              {selectedPackageDetail.status === 'RETIRADA' ? (
                <button
                  onClick={() => {
                    setReceiptPkgForSindico(selectedPackageDetail);
                    setSelectedPackageDetail(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#0D3823] border border-[#A5D6A7] font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <FileCheck className="w-4 h-4 text-[#0D3823]" />
                  <span>Ver Recibo & Assinatura</span>
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={() => setSelectedPackageDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-[#0D3823] text-white font-bold text-xs hover:bg-[#15462D] transition-colors"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Receipt Modal for Síndico */}
      <DeliveryReceiptModal
        isOpen={Boolean(receiptPkgForSindico)}
        onClose={() => setReceiptPkgForSindico(null)}
        pkg={receiptPkgForSindico}
        unit={units.find(u => receiptPkgForSindico && u.block === receiptPkgForSindico.block && u.apartment === receiptPkgForSindico.apartment)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
