import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import type { BrandProduct, CatalogSource, Vehicle } from '@/domain/types';
import { CatalogService } from '@/services/catalog-service';
import type { SearchFilters, SearchResultItem } from '@/search/search-engine';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { FiltersBar } from './components/FiltersBar';
import { CrossReferenceTable } from './components/CrossReferenceTable';
import { TraceabilityModal } from './components/TraceabilityModal';
import { ProductDetailModal, type ProductApplicationUsage } from './components/ProductDetailModal';

export function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

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
  }>({
    isOpen: false,
    product: null,
    sources: [],
    usages: [],
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
    } catch (err: any) {
      console.error('Erro ao inicializar catálogo:', err);
      setInitError(err.message || 'Erro desconhecido ao carregar base de dados');
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

  // Abertura do Modal de Rastreabilidade
  const handleShowSources = useCallback((sources: CatalogSource[], title: string) => {
    setTraceabilityModal({
      isOpen: true,
      sources,
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

    setProductDetailModal({
      isOpen: true,
      product,
      manufacturerName: mfrName,
      sources,
      usages,
    });
  }, []);

  const handleCloseProductDetail = useCallback(() => {
    setProductDetailModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleSelectVehicleFromProduct = useCallback((vehicle: Vehicle) => {
    setSearchQuery(`${vehicle.brand} ${vehicle.model}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
          />

          <FiltersBar
            filters={filters}
            brands={brands}
            onChange={setFilters}
            onReset={() => setFilters({})}
            onApply={handleApplyFilters}
          />
        </section>

        {/* Resumo da Pesquisa */}
        <section className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          <div>
            Exibindo <span className="font-bold text-slate-900 dark:text-slate-200">{results.length}</span> resultado(s)
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
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold transition-colors"
            >
              Limpar busca e filtros
            </button>
          )}
        </section>

        {/* Lista de Resultados */}
        <section className="space-y-6">
          {displayedResults.map((item) => {
            if (item.type === 'vehicle' && item.vehicle && item.matchedApplications) {
              return (
                <CrossReferenceTable
                  key={item.id}
                  vehicle={item.vehicle}
                  applications={item.matchedApplications}
                  onShowSources={handleShowSources}
                  onSelectProduct={handleSelectProduct}
                />
              );
            }

            if (item.type === 'product' && item.product) {
              return (
                <div
                  key={item.id}
                  className="industrial-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-lg">
                      🪶
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100">
                          {item.product.code}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                          {item.product.family || 'Palheta'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.product.mainApplicationsText || 'Palheta com aplicação técnica documentada.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectProduct(item.product!)}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span>🔍</span> Ver Aplicações & Veículos
                  </button>
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
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors border border-slate-300 dark:border-slate-700"
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
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 shadow-md hover:border-amber-500/50 transition-all"
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
        onClose={handleCloseProductDetail}
        onSelectVehicle={handleSelectVehicleFromProduct}
        onShowSources={handleShowSources}
      />
    </div>
  );
}
