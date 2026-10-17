import { useState } from 'preact/hooks';
import type { BrandProduct, CatalogSource, Vehicle, VehicleApplication } from '@/domain/types';
import { formatMillimeters, formatInches } from '@/domain/measures';
import { ConnectorBadge } from './ConnectorBadge';

export interface ProductApplicationUsage {
  vehicle: Vehicle;
  application: VehicleApplication;
  relationType: string;
}

interface ProductDetailModalProps {
  product: BrandProduct | null;
  manufacturerName?: string;
  sources: CatalogSource[];
  usages: ProductApplicationUsage[];
  equivalentProductsByBrand?: Record<string, BrandProduct[]>;
  isOpen: boolean;
  onClose: () => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onSelectProduct?: (product: BrandProduct) => void;
  onShowSources?: (sources: CatalogSource[], title: string) => void;
}

export function ProductDetailModal({
  product,
  manufacturerName,
  sources,
  usages,
  equivalentProductsByBrand,
  isOpen,
  onClose,
  onSelectVehicle,
  onSelectProduct,
  onShowSources,
}: ProductDetailModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !product) return null;

  const mfr = manufacturerName || product.manufacturerId;
  const badgeColors: Record<string, string> = {
    DYNA: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
    CINOY: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
    VETOR: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  };

  const badgeColor =
    badgeColors[mfr.toUpperCase()] ||
    'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';

  const equivEntries = equivalentProductsByBrand
    ? Object.entries(equivalentProductsByBrand).filter(
        ([b, list]) => b.toUpperCase() !== mfr.toUpperCase() && list.length > 0,
      )
    : [];

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(product.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold uppercase ${badgeColor}`}>
                {mfr}
              </span>
              {product.family && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                  {product.family}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-2">
              {product.code}
            </h2>
            {product.subfamily && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{product.subfamily}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
          {/* Technical Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div>
              <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold">
                Medida Polegadas
              </span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
                {product.inches && product.inches.length > 0
                  ? product.inches.map((i) => formatInches(i)).join(' / ')
                  : 'Não informada'}
              </span>
            </div>

            <div>
              <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold">
                Medida Milímetros
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                {product.millimeters && product.millimeters.length > 0
                  ? product.millimeters.map((m) => `${formatMillimeters(m)} mm`).join(' / ')
                  : product.inches && product.inches.length > 0
                    ? product.inches.map((i) => `${Math.round(i * 25.4)} mm`).join(' / ')
                    : 'Não informada'}
              </span>
            </div>

            <div>
              <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold mb-0.5">
                Encaixe / Conector
              </span>
              {product.armCompatibility && product.armCompatibility.length > 0 ? (
                <ConnectorBadge code={product.armCompatibility.join(', ')} compact />
              ) : (
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Conforme Catálogo
                </span>
              )}
            </div>

            <div>
              <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold">
                Tipo da Palheta
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">
                {product.construction || (product.packageType === 'par' ? 'Par' : 'Unitário')}
              </span>
            </div>
          </div>

          {/* Conversão Cruzada (Cross-Reference Direto entre Marcas) */}
          {equivEntries.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-slate-800/50 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span aria-hidden="true">🔄</span> Códigos Equivalentes nas Mesmas Aplicações
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Clique no código para alternar
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {equivEntries.map(([brand, list]) => (
                  <div
                    key={brand}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mb-1.5 ${
                        badgeColors[brand] || ''
                      }`}
                    >
                      {brand}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {list.slice(0, 8).map((eqProd) => (
                        <button
                          key={eqProd.id}
                          type="button"
                          onClick={() => onSelectProduct?.(eqProd)}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-500/20 dark:bg-slate-800 dark:hover:bg-amber-500/20 font-mono font-bold text-xs text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                          title={eqProd.family || 'Ver este código equivalente'}
                        >
                          {eqProd.code}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Catalog Notes / Applications Text */}
          {product.mainApplicationsText && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/40 text-xs">
              <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold mb-1">
                Aplicações Mencionadas no Catálogo Oficial
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-relaxed">
                {product.mainApplicationsText}
              </p>
            </div>
          )}

          {/* Veículos Compatíveis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>🚗</span> Veículos Compatíveis Catalogados ({usages.length})
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Clique para abrir cross-reference
              </span>
            </div>

            {usages.length > 0 ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {usages.map((u, i) => (
                  <div
                    key={`${u.vehicle.id}-${u.application.id}-${i}`}
                    onClick={() => {
                      if (onSelectVehicle) {
                        onSelectVehicle(u.vehicle);
                        onClose();
                      }
                    }}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-750 hover:border-amber-500/50 border border-slate-200 dark:border-slate-700/60 cursor-pointer flex items-center justify-between gap-3 text-xs transition-all"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {u.vehicle.brand} {u.vehicle.model}
                      </span>
                      {u.vehicle.variant && (
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-1.5">
                          {u.vehicle.variant}
                        </span>
                      )}
                      <span className="font-mono text-amber-700 dark:text-amber-400 text-[11px] ml-2">
                        ({u.vehicle.yearRaw})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-slate-300 capitalize text-[11px] bg-slate-200/80 dark:bg-slate-900 px-2 py-0.5 rounded">
                        {u.application.position.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {u.application.inches ? `${u.application.inches}"` : ''}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 text-xs">→</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/20 rounded-lg border border-slate-200 dark:border-transparent">
                Nenhum veículo individual associado diretamente nos dados validados.
              </div>
            )}
          </div>

          {/* Rastreabilidade Oficial */}
          {sources.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onShowSources) {
                    onShowSources(sources, `Rastreabilidade: ${product.code} (${mfr})`);
                  }
                }}
                className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-colors font-medium cursor-pointer"
              >
                <span>📄</span> Ver Rastreabilidade Oficial ({sources.length} referências de catálogo)
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopyCode}
            className={`px-3.5 py-1.5 rounded-lg text-xs border flex items-center gap-1.5 transition-colors font-medium cursor-pointer ${
              copiedCode
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span>{copiedCode ? '✓' : '📋'}</span> {copiedCode ? 'Código Copiado!' : 'Copiar Código'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
