import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
import type { BrandProduct, CatalogSource, Vehicle } from '@/domain/types';
import { CatalogService } from '@/services/catalog-service';
import {
  counterStorage,
  type CounterVehicleNote,
  type FavoriteVehicleItem,
} from '@/services/counter-storage';
import { extractYearFromQuery, type SearchFilters, type SearchResultItem } from '@/search/search-engine';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { FiltersBar } from './components/FiltersBar';
import { CrossReferenceTable } from './components/CrossReferenceTable';
import { VehicleFamilyCard } from './components/VehicleFamilyCard';
import { TraceabilityModal } from './components/TraceabilityModal';
import { ProductDetailModal, type ProductApplicationUsage } from './components/ProductDetailModal';
import { ConnectorBadge } from './components/ConnectorBadge';
import { formatMillimeters } from '@/domain/measures';

export function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Persistência Local de Balcão (Favoritos, Recentes, Notas)
  const [favorites, setFavorites] = useState<FavoriteVehicleItem[]>(() =>
    counterStorage.getFavorites(),
  );
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    counterStorage.getRecentSearches(),
  );
  const [counterNotes, setCounterNotes] = useState<Record<string, CounterVehicleNote>>(() =>
    counterStorage.getNotes(),
  );
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);

  // Tema Dark / Light
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return true; // Padrão escuro industrial
    }
    return true;
  });

  // Busca e Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [brands, setBrands] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(15);

  // Status de Rede / PWA
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Métricas
  const [metrics, setMetrics] = useState<{
    vehicles: number;
    applications: number;
    products: number;
  }>({ vehicles: 0, applications: 0, products: 0 });

  // Modal de Rastreabilidade
  const [traceabilityModal, setTraceabilityModal] = useState<{
    isOpen: boolean;
    sources: CatalogSource[];
    title?: string;
  }>({
    isOpen: false,
    sources: [],
  });

  // Modal de Detalhes do Produto
  const [productDetailModal, setProductDetailModal] = useState<{
    isOpen: boolean;
    product: BrandProduct | null;
    manufacturerName?: string;
    sources: CatalogSource[];
    usages: ProductApplicationUsage[];
    equivalentProductsByBrand: Record<string, BrandProduct[]>;
  }>({
    isOpen: false,
    product: null,
    sources: [],
    usages: [],
    equivalentProductsByBrand: {},
  });

  // Inicialização do Catálogo
  const initializeCatalog = useCallback(async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      const catalogService = CatalogService.getInstance();
      await catalogService.initialize();

      const summary = await catalogService.getSummary();
      setMetrics({
        vehicles: summary.vehiclesCount,
        applications: summary.applicationsCount,
        products: summary.productsCount,
      });

      const brandList = await catalogService.getBrands();
      setBrands(brandList);

      // Busca inicial padrão
      const initialResults = catalogService.search('', {});
      setResults(initialResults);
    } catch (err: unknown) {
      console.error('Erro ao inicializar catálogo:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido ao carregar base de dados';
      setInitError(message);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initializeCatalog();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initializeCatalog]);

  // Atalhos globais de teclado para Balcão (F2, Ctrl+K / Cmd+K, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      const isF2 = e.key === 'F2';

      if (isCtrlK || isF2) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (productDetailModal.isOpen) {
          setProductDetailModal((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        if (traceabilityModal.isOpen) {
          setTraceabilityModal((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        setSearchQuery('');
        setFilters({});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productDetailModal.isOpen, traceabilityModal.isOpen]);

  // Aplica classe no <html> para tema
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Aplicação instantânea dos filtros combinados
  const handleApplyFilters = useCallback(() => {
    if (isInitializing || initError) return;
    setIsSearching(true);
    try {
      const catalogService = CatalogService.getInstance();
      const res = catalogService.search(searchQuery, filters);
      setResults(res);
      setDisplayLimit(15);
    } catch (err) {
      console.error('Erro na pesquisa combinada:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filters, isInitializing, initError]);

  // Executa busca sempre que a query ou os filtros mudarem
  useEffect(() => {
    if (isInitializing || initError) return;

    setIsSearching(true);
    const timer = setTimeout(() => {
      handleApplyFilters();
    }, 100);

    return () => clearTimeout(timer);
  }, [searchQuery, filters, isInitializing, initError, handleApplyFilters]);

  // Registra buscas relevantes no histórico local após estabilização da digitação
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      const updated = counterStorage.addRecentSearch(trimmed);
      setRecentSearches(updated);
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handlers de Persistência Local de Balcão
  const handleToggleFavorite = useCallback((familyId: string, fullName: string) => {
    const updated = counterStorage.toggleFavorite(familyId, fullName);
    setFavorites(updated);
  }, []);

  const handleSaveCounterNote = useCallback(
    (familyId: string, fullName: string, noteText: string) => {
      const updated = counterStorage.setVehicleNote(familyId, fullName, noteText);
      setCounterNotes(updated);
    },
    [],
  );

  const handleClearRecentSearches = useCallback(() => {
    const updated = counterStorage.clearRecentSearches();
    setRecentSearches(updated);
  }, []);

  const handleExportCounterBackup = useCallback(() => {
    const json = counterStorage.exportBackupJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `catalogo-palhetas-balcao-backup-${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupStatusMessage('Backup local exportado!');
    setTimeout(() => setBackupStatusMessage(null), 3000);
  }, []);

  const handleImportCounterBackup = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const summary = counterStorage.importBackupJson(text);
        setFavorites(counterStorage.getFavorites());
        setRecentSearches(counterStorage.getRecentSearches());
        setCounterNotes(counterStorage.getNotes());
        setBackupStatusMessage(
          `Restaurado (${summary.favoritesCount} favs / ${summary.notesCount} notas)`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao importar JSON';
        setBackupStatusMessage(`Erro: ${msg}`);
      } finally {
        setTimeout(() => setBackupStatusMessage(null), 4000);
        input.value = '';
      }
    };
    reader.readAsText(file);
  }, []);

  // Abertura do Modal de Rastreabilidade
  const handleShowSources = useCallback((sources: CatalogSource[], title: string) => {
    setTraceabilityModal({
      isOpen: true,
      sources,
      title,
    });
  }, []);

  const handleShowSourcesByIds = useCallback(async (sourceIds: string[], title: string) => {
    const catalogService = CatalogService.getInstance();
    const realSources = await catalogService.getSourcesByIds(sourceIds);
    setTraceabilityModal({
      isOpen: true,
      sources: realSources,
      title,
    });
  }, []);

  const handleCloseTraceability = useCallback(() => {
    setTraceabilityModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Abertura do Modal de Detalhes de Produto
  const handleSelectProduct = useCallback(async (product: BrandProduct) => {
    const catalogService = CatalogService.getInstance();
    const mfrName = catalogService.getManufacturerName(product.manufacturerId);
    const sources = await catalogService.getSourcesByIds(product.sourceIds);
    const usages = await catalogService.getProductApplications(product.id);
    const equivalentProductsByBrand = catalogService.getEquivalentProductsForProduct(product.id);

    setProductDetailModal({
      isOpen: true,
      product,
      manufacturerName: mfrName,
      sources,
      usages,
      equivalentProductsByBrand,
    });
  }, []);

  const handleCloseProductDetail = useCallback(() => {
    setProductDetailModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleSelectVehicleFromProduct = useCallback((vehicle: Vehicle) => {
    setSearchQuery(`${vehicle.brand} ${vehicle.model}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectRelatedFamily = useCallback((relatedQuery: string) => {
    setSearchQuery(relatedQuery);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Métricas de Contagem Estruturada
  const familyCount = useMemo(
    () => results.filter((r) => r.type === 'vehicle_family').length,
    [results],
  );
  const totalVariantsCount = useMemo(
    () =>
      results
        .filter((r) => r.type === 'vehicle_family')
        .reduce((acc, r) => acc + (r.family?.variants.length || 0), 0),
    [results],
  );
  const productCount = useMemo(
    () => results.filter((r) => r.type === 'product').length,
    [results],
  );
  const activeYear = useMemo(
    () => filters.year ?? extractYearFromQuery(searchQuery),
    [filters.year, searchQuery],
  );

  // Resultados limitados para renderização ultra-fluida
  const displayedResults = useMemo(() => {
    return results.slice(0, displayLimit);
  }, [results, displayLimit]);

  const hasMore = results.length > displayLimit;

  // Tela de Carregamento
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-amber-500">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl shadow-xl shadow-orange-500/20 animate-pulse mb-6">
          ⚡
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-100 mb-2">
          Carregando Catálogo Automotivo
        </h2>
        <p className="text-sm text-slate-400 max-w-sm text-center mb-6">
          Indexando bases oficiais DYNA 2025, CINOY 2023 e VETOR 2025 para consulta offline...
        </p>
        <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-amber-500 to-orange-500 animate-[pulse_1s_infinite]"></div>
        </div>
      </div>
    );
  }

  // Tela de Erro de Inicialização
  if (initError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-red-400 mb-2">Falha na Inicialização</h2>
          <p className="text-xs text-slate-300 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4 text-left break-words">
            {initError}
          </p>
          <button
            onClick={initializeCatalog}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-amber-500 selection:text-slate-950 transition-colors duration-150">
      {/* Header Fixo com Métricas */}
      <Header
        isDark={isDark}
        onToggleTheme={toggleTheme}
        metrics={metrics}
      />

      {/* Sub-barra de Status Offline & PWA */}
      <div className="bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 px-4 py-1.5 text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
              }`}
            ></span>
            <span>
              {isOnline
                ? 'Sistema Operacional • Base 100% em Cache Local (Offline-Ready)'
                : 'Modo Offline Ativo • Consultando banco local'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Segmento Leve Exclusivo</span>
            <span>•</span>
            <span>Sem Linha Pesada</span>
            <span>•</span>
            <span>Fidelidade Rastreável</span>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Barra de Busca Principal */}
        <section className="space-y-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            isLoading={isSearching}
            inputRef={searchInputRef}
          />

          <FiltersBar
            filters={filters}
            brands={brands}
            onChange={setFilters}
            onReset={() => setFilters({})}
            onApply={handleApplyFilters}
          />

          {/* Barra Rápida de Balcão: Favoritos Fixados, Buscas Recentes e Backup Local */}
          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Favoritos */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                  <span aria-hidden="true">⭐</span> Favoritos:
                </span>
                {favorites.length > 0 ? (
                  favorites.slice(0, 8).map((fav) => (
                    <button
                      key={fav.familyId}
                      type="button"
                      onClick={() => setSearchQuery(fav.fullName)}
                      className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/30 font-semibold text-[11px] transition-colors cursor-pointer"
                      title={`Consultar ${fav.fullName}`}
                    >
                      {fav.fullName}
                    </button>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                    Nenhum fixado (clique em ☆ Favoritar nos veículos mais atendidos)
                  </span>
                )}
              </div>

              {/* Buscas Recentes */}
              {recentSearches.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                    🕒 Recentes:
                  </span>
                  {recentSearches.slice(0, 5).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSearchQuery(q)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearRecentSearches}
                    className="text-[10px] text-slate-400 hover:text-red-500 underline ml-1 cursor-pointer"
                    title="Limpar histórico recente"
                  >
                    limpar
                  </button>
                </div>
              )}
            </div>

            {/* Backup Local Privado (JSON) */}
            <div className="flex items-center gap-2 ml-auto">
              {backupStatusMessage && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {backupStatusMessage}
                </span>
              )}
              <button
                type="button"
                onClick={handleExportCounterBackup}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                title="Exportar favoritos e notas locais do balcão em arquivo JSON"
              >
                💾 Exportar Notas
              </button>
              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                title="Importar backup JSON de favoritos e notas locais"
              >
                📂 Importar Notas
              </button>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportCounterBackup}
                className="hidden"
              />
            </div>
          </div>
        </section>

        {/* Resumo da Pesquisa */}
        <section className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          <div>
            {familyCount > 0 && productCount === 0 ? (
              <span>
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {familyCount} {familyCount === 1 ? 'família encontrada' : 'famílias encontradas'}
                </span>{' '}
                •{' '}
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  {activeYear !== undefined
                    ? `${totalVariantsCount} ${
                        totalVariantsCount === 1
                          ? `aplicação compatível com ${activeYear}`
                          : `aplicações compatíveis com ${activeYear}`
                      }`
                    : `${totalVariantsCount} ${
                        totalVariantsCount === 1
                          ? 'aplicação técnica'
                          : 'aplicações técnicas'
                      }`}
                </span>
              </span>
            ) : productCount > 0 && familyCount === 0 ? (
              <span>
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {productCount} {productCount === 1 ? 'produto encontrado' : 'produtos encontrados'}
                </span>
              </span>
            ) : (
              <span>
                Exibindo <span className="font-bold text-slate-900 dark:text-slate-200">{results.length}</span> resultado(s)
              </span>
            )}
            {searchQuery && (
              <span>
                {' '}
                para "<span className="text-amber-600 dark:text-amber-400 font-semibold">{searchQuery}</span>"
              </span>
            )}
          </div>

          {(searchQuery || Object.values(filters).some((v) => v !== undefined && v !== '')) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilters({});
              }}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold transition-colors cursor-pointer"
            >
              Limpar busca e filtros (Esc)
            </button>
          )}
        </section>

        {/* Lista de Resultados */}
        <section className="space-y-6">
          {displayedResults.map((item) => {
            if (item.type === 'vehicle_family' && item.family) {
              const fam = item.family;
              const isFav = favorites.some((f) => f.familyId === fam.id);
              const savedNote = counterNotes[fam.id]?.text || '';
              return (
                <VehicleFamilyCard
                  key={item.id}
                  family={fam}
                  onShowSources={handleShowSources}
                  onShowSourcesByIds={handleShowSourcesByIds}
                  onSelectProduct={handleSelectProduct}
                  onSelectRelatedFamily={handleSelectRelatedFamily}
                  isFavorite={isFav}
                  onToggleFavorite={handleToggleFavorite}
                  counterNote={savedNote}
                  onSaveCounterNote={handleSaveCounterNote}
                />
              );
            }

            if (item.type === 'vehicle' && item.vehicle && item.matchedApplications) {
              return (
                <CrossReferenceTable
                  key={item.id}
                  vehicle={item.vehicle}
                  applications={item.matchedApplications}
                  onShowSources={handleShowSources}
                  onShowSourcesByIds={handleShowSourcesByIds}
                  onSelectProduct={handleSelectProduct}
                />
              );
            }

            if (item.type === 'product' && item.product) {
              const prod = item.product;
              const mfrBrand = prod.manufacturerId.toUpperCase().includes('DYNA')
                ? 'DYNA'
                : prod.manufacturerId.toUpperCase().includes('CINOY')
                  ? 'CINOY'
                  : 'VETOR';
              const eqMap = item.equivalentProductsByBrand || {};

              return (
                <div
                  key={item.id}
                  className="industrial-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-lg">
                        🪶
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                              mfrBrand === 'DYNA'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30'
                                : mfrBrand === 'CINOY'
                                  ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
                                  : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30'
                            }`}
                          >
                            {mfrBrand}
                          </span>
                          <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100">
                            {prod.code}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                            {prod.family || 'Palheta'}
                          </span>
                          {prod.inches && prod.inches.length > 0 && (
                            <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              {prod.inches.map((i) => `${i}"`).join(' / ')}{' '}
                              {prod.millimeters && prod.millimeters.length > 0
                                ? `(${prod.millimeters.map((m) => formatMillimeters(m)).join(' / ')} mm)`
                                : ''}
                            </span>
                          )}
                          {prod.armCompatibility && prod.armCompatibility.length > 0 && (
                            <ConnectorBadge code={prod.armCompatibility.join(', ')} compact />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {prod.mainApplicationsText || 'Palheta com aplicação técnica documentada.'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectProduct(prod)}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>🔍</span> Ver Aplicações & Equivalentes
                    </button>
                  </div>

                  {/* Equivalência Direta O(1) no Card de Produto */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                      🔄 Equivalentes Diretos:
                    </span>
                    {(['DYNA', 'CINOY', 'VETOR'] as const).map((b) => {
                      const eqList = eqMap[b] || [];
                      if (eqList.length === 0) return null;
                      return (
                        <div key={b} className="inline-flex items-center gap-1.5">
                          <span className="font-bold text-[10px] text-slate-500 dark:text-slate-400">{b}:</span>
                          {eqList.slice(0, 4).map((eq) => (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => handleSelectProduct(eq)}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-500/15 dark:bg-slate-800 dark:hover:bg-amber-500/20 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                              title={`Abrir ficha de ${eq.code}`}
                            >
                              {eq.code}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Estado Vazio */}
          {results.length === 0 && (
            <div className="industrial-card rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-200 mb-1">
                Nenhum resultado técnico encontrado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                Não encontramos aplicações para os termos informados. Lembre-se que caminhões,
                ônibus e máquinas pesadas foram estritamente excluídos da base de dados.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({});
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Restaurar Todos os Veículos
                </button>
              </div>
            </div>
          )}

          {/* Paginação / Carregar Mais */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => setDisplayLimit((prev) => prev + 20)}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 shadow-md hover:border-amber-500/50 transition-all cursor-pointer"
              >
                Carregar mais veículos ({results.length - displayLimit} restantes)...
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer Industrial */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 mt-12 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-300">
              Catálogo Técnico de Palhetas Automotivas • v1.0.0
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Fontes primárias: DYNA (2025), CINOY (2023) e VETOR (2025). Exclusivo para veículos leves.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span>●</span> SQLite / Dexie Ready
            </span>
            <span>Tauri v2 + Web PWA</span>
          </div>
        </div>
      </footer>

      {/* Modais Globais */}
      <TraceabilityModal
        isOpen={traceabilityModal.isOpen}
        sources={traceabilityModal.sources}
        title={traceabilityModal.title}
        onClose={handleCloseTraceability}
      />

      <ProductDetailModal
        isOpen={productDetailModal.isOpen}
        product={productDetailModal.product}
        manufacturerName={productDetailModal.manufacturerName}
        sources={productDetailModal.sources}
        usages={productDetailModal.usages}
        equivalentProductsByBrand={productDetailModal.equivalentProductsByBrand}
        onClose={handleCloseProductDetail}
        onSelectVehicle={handleSelectVehicleFromProduct}
        onSelectProduct={handleSelectProduct}
        onShowSources={handleShowSources}
      />
    </div>
  );
}
