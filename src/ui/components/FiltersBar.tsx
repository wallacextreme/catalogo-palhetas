import { useMemo, useState, useEffect } from 'preact/hooks';
import type { SearchFilters } from '@/search/search-engine';
import { canonicalizeManufacturer, OFFICIAL_VEHICLE_MANUFACTURERS } from '@/domain/manufacturers';
import { CatalogService } from '@/services/catalog-service';

interface FiltersBarProps {
  filters: SearchFilters;
  brands: string[];
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
  onApply?: () => void;
}

export function FiltersBar({ filters, brands, onChange, onReset, onApply }: FiltersBarProps) {
  const activeFiltersCount = Object.values(filters).filter((v) => v !== undefined && v !== '').length;
  const hasActiveFilters = activeFiltersCount > 0;
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Carrega dinamicamente a lista de modelos limpos para a montadora selecionada (ou geral)
  useEffect(() => {
    let active = true;
    const loadModels = async () => {
      try {
        const service = CatalogService.getInstance();
        const list = await service.getModelsByBrand(filters.brand);
        if (active) setAvailableModels(list);
      } catch (err) {
        console.error('Erro ao listar modelos:', err);
      }
    };
    loadModels();
    return () => {
      active = false;
    };
  }, [filters.brand]);

  // Garante que o select exiba estritamente as montadoras de veículos automotivos legítimas
  const cleanBrands = useMemo(() => {
    const present = new Set<string>();
    for (const b of brands) {
      const canon = canonicalizeManufacturer(b);
      if (canon) present.add(canon);
    }
    const filtered = OFFICIAL_VEHICLE_MANUFACTURERS.filter((m) => present.has(m));
    return filtered.length > 0 ? filtered : OFFICIAL_VEHICLE_MANUFACTURERS;
  }, [brands]);

  const positions = [
    { value: '', label: 'Todas as Posições' },
    { value: 'motorista', label: 'Motorista' },
    { value: 'passageiro', label: 'Passageiro' },
    { value: 'par_dianteiro', label: 'Par Dianteiro' },
    { value: 'traseira', label: 'Traseira' },
  ];

  const inchesList = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 28];

  const wiperMfrs = [
    { value: '', label: 'Todos Fabricantes' },
    { value: 'DYNA', label: 'DYNA' },
    { value: 'CINOY', label: 'CINOY' },
    { value: 'VETOR', label: 'VETOR' },
  ];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onApply?.();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 text-xs shadow-sm transition-colors">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="font-semibold text-slate-800 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <span>⚙️</span> Filtros Técnicos Combinados
        </span>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors font-medium text-xs cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}

          <button
            type="button"
            onClick={onApply}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Aplicar filtros combinados"
          >
            <span>🔍</span> Filtrar
          </button>
        </div>
      </div>

      {/* Grid com os 6 campos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        {/* Montadora do Veículo */}
        <div>
          <label className="block text-slate-600 dark:text-slate-400 mb-1 text-[11px] font-medium">Montadora</label>
          <select
            value={filters.brand ?? ''}
            onChange={(e) => {
              const val = (e.target as HTMLSelectElement).value || undefined;
              onChange({ ...filters, brand: val });
            }}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition-colors"
          >
            <option value="">Todas as Montadoras</option>
            {cleanBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Nome do Veículo / Modelo */}
        <div>
          <label className="block text-slate-600 dark:text-slate-400 mb-1 text-[11px] font-medium">Nome do Veículo</label>
          <div className="relative">
            <input
              type="text"
              list="models-datalist"
              value={filters.model ?? ''}
              placeholder={filters.brand ? `Modelos de ${filters.brand}...` : 'Ex: Hilux, Etios, Gol...'}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                onChange({ ...filters, model: val || undefined });
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs transition-colors"
            />
            <datalist id="models-datalist">
              {availableModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {filters.model && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, model: undefined })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
                title="Limpar modelo"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Posição */}
        <div>
          <label className="block text-slate-600 dark:text-slate-400 mb-1 text-[11px] font-medium">Posição</label>
          <select
            value={filters.position ?? ''}
            onChange={(e) => onChange({ ...filters, position: (e.target as HTMLSelectElement).value || undefined })}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition-colors"
          >
            {positions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Medida (Polegadas) */}
        <div>
          <label className="block text-slate-600 dark:text-slate-400 mb-1 text-[11px] font-medium">Polegadas</label>
          <select
            value={filters.inches ? String(filters.inches) : ''}
            onChange={(e) => {
              const val = (e.target as HTMLSelectElement).value;
              onChange({ ...filters, inches: val ? Number(val) : undefined });
            }}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition-colors"
          >
            <option value="">Todas as Medidas</option>
            {inchesList.map((inc) => (
              <option key={inc} value={inc}>
                {inc}" ({Math.round(inc * 25.4)} mm)
              </option>
            ))}
          </select>
        </div>

        {/* Fabricante da Palheta */}
        <div>
          <label className="block text-slate-600 dark:text-slate-400 mb-1 text-[11px] font-medium">Marca da Palheta</label>
          <select
            value={filters.wiperManufacturer ?? ''}
            onChange={(e) =>
              onChange({ ...filters, wiperManufacturer: (e.target as HTMLSelectElement).value || undefined })
            }
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition-colors"
          >
            {wiperMfrs.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de Relação */}
        <div>
          <label className="block text-slate-600 dark:text-slate-400 mb-1 text-[11px] font-medium">Tipo de Relação</label>
          <select
            value={filters.relationType ?? ''}
            onChange={(e) =>
              onChange({ ...filters, relationType: ((e.target as HTMLSelectElement).value as any) || undefined })
            }
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs transition-colors"
          >
            <option value="">Todas as Relações</option>
            <option value="catalog_documented">Documentada no Catálogo</option>
            <option value="application_match">Mesma Aplicação / Coincidente</option>
            <option value="derived_compatibility">Compatibilidade Derivada</option>
          </select>
        </div>
      </div>

      {/* Barra Inferior com Botão Primário e Indicador */}
      <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          {hasActiveFilters ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              {activeFiltersCount} critério(s) ativo(s)
            </span>
          ) : (
            <span>💡 Preencha os campos desejados e clique em <b>Filtrar Resultados</b> ou pressione <b>Enter</b>.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              ✕ Limpar Filtros
            </button>
          )}

          <button
            type="button"
            onClick={onApply}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔍</span> Filtrar Resultados
          </button>
        </div>
      </div>
    </div>
  );
}
