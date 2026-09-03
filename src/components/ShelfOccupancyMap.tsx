import React from 'react';
import { PackageItem, ShelfLevel } from '../types';
import { SHELF_CONFIG } from '../data/mockData';
import { Archive } from 'lucide-react';

interface ShelfOccupancyMapProps {
  pendingPackages: PackageItem[];
  /** Se omitido, os chips de encomenda ficam só informativos (não clicáveis) — usado no
   * painel do Síndico, que é consulta. A Portaria passa um handler pra ir direto ao checkout. */
  onSelectPackage?: (pkg: PackageItem) => void;
  title?: string;
  subtitle?: string;
}

/**
 * Mapa visual das 3 Estantes (A, B, C) × 4 Prateleiras da Portaria, com ocupação em tempo
 * real. Compartilhado entre PortariaView (aba Estantes) e SindicoDashboard (aba Estantes).
 */
export const ShelfOccupancyMap: React.FC<ShelfOccupancyMapProps> = ({
  pendingPackages,
  onSelectPackage,
  title = 'Ocupação das Estantes Físicas da Portaria',
  subtitle = 'Visualização em tempo real das 3 Estantes (A, B, C) e 4 Prateleiras cada'
}) => {
  return (
    <div className="bg-white rounded-2xl border border-[#D4AF37]/35 p-6 shadow-md space-y-6 text-[#1A2E22]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-[#0D3823] flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#D81B60]" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-[#E8F5E9] text-[#0D3823] border border-[#A5D6A7] font-bold">
          {pendingPackages.length} itens armazenados no total
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SHELF_CONFIG.map((shelf) => {
          const shelfPackages = pendingPackages.filter((p) => p.shelf?.shelf === shelf.shelf);
          return (
            <div key={shelf.shelf} className="bg-[#F8F9FA] rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-black text-[#0D3823]">Estante {shelf.shelf}</h4>
                  <span className="text-[11px] text-slate-500 font-medium">{shelf.name}</span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#0D3823] text-[#FFF2B2] text-xs font-bold border border-[#D4AF37]/30">
                  {shelfPackages.length} caixas
                </span>
              </div>

              <div className="space-y-3">
                {([4, 3, 2, 1] as ShelfLevel[]).map((level) => {
                  const levelPackages = shelfPackages.filter((p) => p.shelf?.level === level);
                  const max = shelf.maxPerLevel;
                  const pct = Math.min(100, Math.round((levelPackages.length / max) * 100));

                  return (
                    <div
                      key={level}
                      className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 hover:border-[#D4AF37] transition-colors shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0D3823]">Prateleira {level}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {levelPackages.length} / {max} ({pct}%)
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            pct > 80 ? 'bg-[#D81B60]' : pct > 50 ? 'bg-[#D4AF37]' : 'bg-[#0D3823]'
                          }`}
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {levelPackages.map((p) =>
                          onSelectPackage ? (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => onSelectPackage(p)}
                              title={`Bloco ${p.block} Apt ${p.apartment} - ${p.residentName} (${p.carrier})`}
                              className="px-2 py-0.5 rounded bg-[#FCE4EC] hover:bg-[#D81B60] text-[10px] font-bold text-[#AD1457] hover:text-white border border-[#F48FB1] hover:border-transparent transition-colors truncate max-w-[130px]"
                            >
                              B{p.block}-A{p.apartment}
                            </button>
                          ) : (
                            <span
                              key={p.id}
                              title={`Bloco ${p.block} Apt ${p.apartment} - ${p.residentName} (${p.carrier})`}
                              className="px-2 py-0.5 rounded bg-[#FCE4EC] text-[10px] font-bold text-[#AD1457] border border-[#F48FB1] truncate max-w-[130px]"
                            >
                              B{p.block}-A{p.apartment}
                            </span>
                          )
                        )}
                        {levelPackages.length === 0 && (
                          <span className="text-[10px] text-slate-400 italic">Vazia / Disponível</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
