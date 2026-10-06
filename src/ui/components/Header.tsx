interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  metrics?: {
    vehicles: number;
    applications: number;
    products: number;
  };
}

export function Header({ isDark, onToggleTheme, metrics }: HeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Marca */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-slate-950 font-black text-xl">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                CATÁLOGO TÉCNICO DE PALHETAS
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30">
                Offline-First
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cross-Reference & Consulta Técnica Multi-Catálogo Automotivo
            </p>
          </div>
        </div>

        {/* Badges de Fabricantes Oficiais */}
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
            DYNA 2025
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            CINOY 2023
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            VETOR 2025
          </span>
        </div>

        {/* Ações: Métricas & Tema */}
        <div className="flex items-center gap-3">
          {metrics && (
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 pr-3">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{metrics.vehicles.toLocaleString('pt-BR')}</span> veículos
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{metrics.products.toLocaleString('pt-BR')}</span> palhetas
              </div>
            </div>
          )}

          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 shadow-xs"
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label="Alternar tema"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}
