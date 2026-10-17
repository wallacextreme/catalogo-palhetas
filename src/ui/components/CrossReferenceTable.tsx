import { useMemo, useState } from 'preact/hooks';
import type { BrandProduct, CatalogSource, Connector, RelationType, Vehicle, VehicleApplication } from '@/domain/types';
import { formatMillimeters, formatInches } from '@/domain/measures';
import { formatYearRange } from '@/domain/years';
import { ConnectorBadge } from './ConnectorBadge';

interface ProductMatchItem {
  product: BrandProduct;
  manufacturerCode: string;
  relationType: RelationType | 'catalog_documented';
  sources: CatalogSource[];
  notes?: string;
}

interface ApplicationGroup {
  application: VehicleApplication;
  connector?: Connector;
  fits: ProductMatchItem[];
}

interface CrossReferenceTableProps {
  vehicle: Vehicle;
  applications: ApplicationGroup[];
  onShowSources: (sources: CatalogSource[], title: string) => void;
  onShowSourcesByIds?: (sourceIds: string[], title: string) => void;
  onSelectProduct?: (product: BrandProduct) => void;
}

export function CrossReferenceTable({
  vehicle,
  applications,
  onShowSources,
  onShowSourcesByIds,
  onSelectProduct,
}: CrossReferenceTableProps) {
  const [copied, setCopied] = useState(false);

  const positionLabels: Record<string, string> = {
    motorista: 'Motorista',
    passageiro: 'Passageiro',
    par_dianteiro: 'Par Dianteiro',
    traseira: 'Traseira',
  };

  const relationLabels: Record<string, { label: string; color: string; desc: string }> = {
    catalog_documented: {
      label: 'Documentada no Catálogo',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
      desc: 'Catálogo do próprio fabricante atesta aplicação oficial para o veículo.',
    },
    documented_equivalence: {
      label: 'Equivalência Documentada',
      color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
      desc: 'Fonte declara formalmente equivalência direta entre os códigos.',
    },
    application_match: {
      label: 'Mesma Aplicação',
      color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
      desc: 'Atende ao mesmo veículo, mesma posição e anos sobrepostos, sem declaração explícita de equivalência.',
    },
    derived_compatibility: {
      label: 'Compatibilidade Derivada',
      color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
      desc: 'Compatibilidade inferida por critérios dimensionais e conexão compatível.',
    },
    not_confirmed: {
      label: 'Não Confirmada',
      color: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
      desc: 'Dados insuficientes ou divergentes para atestar compatibilidade.',
    },
  };

  // Identifica quais catálogos possuem aplicação para este veículo
  const documentedBrands = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) {
      for (const fit of app.fits) {
        set.add(fit.manufacturerCode.toUpperCase());
      }
    }
    return Array.from(set);
  }, [applications]);

  // Separa produtos por fabricante
  function groupFitsByBrand(fits: ProductMatchItem[]) {
    const brands: Record<string, ProductMatchItem[]> = {
      DYNA: [],
      CINOY: [],
      VETOR: [],
    };

    for (const f of fits) {
      const code = f.manufacturerCode.toUpperCase();
      if (brands[code]) {
        brands[code]!.push(f);
      } else {
        if (!brands[code]) brands[code] = [];
        brands[code]!.push(f);
      }
    }

    return brands;
  }

  return (
    <div className="industrial-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 mb-6 transition-colors shadow-sm">
      {/* Cabeçalho do Veículo */}
      <div className="bg-slate-100/90 dark:bg-slate-900/90 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl">🚗</span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {vehicle.brand} {vehicle.model}
            </h2>
            {vehicle.variant && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                {vehicle.variant}
              </span>
            )}

            {/* Badges dos Catálogos com Aplicação */}
            <div className="flex items-center gap-1.5 ml-1">
              {(['DYNA', 'CINOY', 'VETOR'] as const).map((b) => {
                const hasApp = documentedBrands.includes(b);
                return (
                  <span
                    key={b}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition-all ${
                      hasApp
                        ? b === 'DYNA'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30 shadow-xs'
                          : b === 'CINOY'
                            ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 shadow-xs'
                            : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30 shadow-xs'
                        : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-800 line-through opacity-40'
                    }`}
                    title={hasApp ? `Possui palheta documentada no catálogo ${b}` : `Sem palheta documentada em ${b}`}
                  >
                    {b}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span>Ano:</span>{' '}
              <span className="font-semibold text-amber-700 dark:text-amber-400 font-mono">
                {formatYearRange(vehicle)}
              </span>
            </div>
            <div>
              <span>Categoria:</span>{' '}
              <span className="text-slate-800 dark:text-slate-200 capitalize font-medium">
                {vehicle.category.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const text = [
                `🚗 ${vehicle.brand} ${vehicle.model} (${formatYearRange(vehicle)})`,
                ...applications.map((ag) => {
                  const pos = positionLabels[ag.application.position] || ag.application.position;
                  const size = ag.application.inches ? `${ag.application.inches}"` : ag.application.sizeLabel || '';
                  const fits = ag.fits.map((f) => `${f.manufacturerCode}: ${f.product.code}`).join(' | ');
                  return `• ${pos} (${size}): ${fits || 'Sem aplicação oficial'}`;
                }),
              ].join('\n');
              navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg border shadow-2xs flex items-center gap-1.5 transition-colors font-medium cursor-pointer ${
              copied
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="Copiar dados para enviar ao cliente ou WhatsApp"
          >
            <span>{copied ? '✓' : '📋'}</span> {copied ? 'Copiado!' : 'Copiar Ficha'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onShowSourcesByIds) {
                onShowSourcesByIds(vehicle.sourceIds, `Fontes Oficiais: ${vehicle.brand} ${vehicle.model}`);
              } else {
                onShowSources(
                  vehicle.sourceIds.map((id) => ({
                    id,
                    catalogId: '',
                    manufacturer: vehicle.brand,
                    catalogName: 'Catálogo Oficial',
                    catalogYear: 2025,
                    page: 1,
                  })),
                  `Fontes Oficiais: ${vehicle.brand} ${vehicle.model}`,
                );
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
          >
            <span>📄</span> Rastreabilidade do Veículo
          </button>
        </div>
      </div>

      {/* Aplicações Técnicas por Posição */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
        {applications.map((appGroup, idx) => {
          const app = appGroup.application;
          const groupedFits = groupFitsByBrand(appGroup.fits);

          return (
            <div key={app.id || idx} className="p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/20 transition-colors">
              {/* Resumo Técnico da Posição */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 mb-4 text-xs transition-colors">
                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    Posição
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {positionLabels[app.position] || app.position}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    Medida
                  </span>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
                    {app.inches ? formatInches(app.inches) : app.sizeLabel || 'Não informada'}
                    {app.millimeters && (
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                        ({formatMillimeters(app.millimeters)} mm)
                      </span>
                    )}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold mb-1">
                    Conexão / Encaixe
                  </span>
                  <ConnectorBadge
                    code={app.connectorRaw || appGroup.connector?.code || 'Padrão (G)'}
                    name={appGroup.connector?.name}
                    compact
                  />
                </div>

                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    Origem da Medida
                  </span>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {app.measureOrigin === 'application_table'
                      ? 'Tabela da Aplicação'
                      : app.measureOrigin === 'product_table'
                        ? 'Tabela do Fabricante'
                        : 'Não informada'}
                  </span>
                </div>
              </div>

              {/* Grid Comparativo de Fabricantes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* DYNA */}
                <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-slate-900/40 border border-yellow-500/30 dark:border-yellow-500/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-yellow-700 dark:text-yellow-400 tracking-wide flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        DYNA
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Catálogo 2025</span>
                    </div>

                    {groupedFits.DYNA && groupedFits.DYNA.length > 0 ? (
                      groupedFits.DYNA.map((fit, fIdx) => (
                        <div key={fIdx} className="mb-2.5 last:mb-0">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => onSelectProduct?.(fit.product)}
                              className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors flex items-center gap-1 text-left"
                              title="Ver especificações e veículos compatíveis"
                            >
                              {fit.product.code}
                            </button>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {fit.product.family || 'Geral'}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-1">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                relationLabels[fit.relationType]?.color
                              }`}
                              title={relationLabels[fit.relationType]?.desc}
                            >
                              {relationLabels[fit.relationType]?.label}
                            </span>

                            <button
                              onClick={() =>
                                onShowSources(
                                  fit.sources,
                                  `Rastreabilidade DYNA: ${fit.product.code} (${vehicle.brand} ${vehicle.model})`,
                                )
                              }
                              className="text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline flex items-center gap-0.5 font-medium"
                            >
                              <span>📄</span> Ver Fonte
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400 text-xs italic py-2">
                        Sem aplicação oficial documentada
                      </div>
                    )}
                  </div>
                </div>

                {/* CINOY */}
                <div className="p-3.5 rounded-xl bg-red-50/50 dark:bg-slate-900/40 border border-red-500/30 dark:border-red-500/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-red-700 dark:text-red-400 tracking-wide flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        CINOY
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Catálogo 2023</span>
                    </div>

                    {groupedFits.CINOY && groupedFits.CINOY.length > 0 ? (
                      groupedFits.CINOY.map((fit, fIdx) => (
                        <div key={fIdx} className="mb-2.5 last:mb-0">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => onSelectProduct?.(fit.product)}
                              className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors flex items-center gap-1 text-left"
                              title="Ver especificações e veículos compatíveis"
                            >
                              {fit.product.code}
                            </button>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {fit.product.family || 'Geral'}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-1">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                relationLabels[fit.relationType]?.color
                              }`}
                              title={relationLabels[fit.relationType]?.desc}
                            >
                              {relationLabels[fit.relationType]?.label}
                            </span>

                            <button
                              onClick={() =>
                                onShowSources(
                                  fit.sources,
                                  `Rastreabilidade CINOY: ${fit.product.code} (${vehicle.brand} ${vehicle.model})`,
                                )
                              }
                              className="text-[10px] text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline flex items-center gap-0.5 font-medium"
                            >
                              <span>📄</span> Ver Fonte
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400 text-xs italic py-2">
                        Sem aplicação oficial documentada
                      </div>
                    )}
                  </div>
                </div>

                {/* VETOR */}
                <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-slate-900/40 border border-blue-500/30 dark:border-blue-500/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-blue-700 dark:text-blue-400 tracking-wide flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        VETOR
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Catálogo 2025</span>
                    </div>

                    {groupedFits.VETOR && groupedFits.VETOR.length > 0 ? (
                      groupedFits.VETOR.map((fit, fIdx) => (
                        <div key={fIdx} className="mb-2.5 last:mb-0">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => onSelectProduct?.(fit.product)}
                              className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors flex items-center gap-1 text-left"
                              title="Ver especificações e veículos compatíveis"
                            >
                              {fit.product.code}
                            </button>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {fit.product.family || 'Geral'}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-1">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                relationLabels[fit.relationType]?.color
                              }`}
                              title={relationLabels[fit.relationType]?.desc}
                            >
                              {relationLabels[fit.relationType]?.label}
                            </span>

                            <button
                              onClick={() =>
                                onShowSources(
                                  fit.sources,
                                  `Rastreabilidade VETOR: ${fit.product.code} (${vehicle.brand} ${vehicle.model})`,
                                )
                              }
                              className="text-[10px] text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-0.5 font-medium"
                            >
                              <span>📄</span> Ver Fonte
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400 text-xs italic py-2">
                        Sem aplicação oficial documentada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
