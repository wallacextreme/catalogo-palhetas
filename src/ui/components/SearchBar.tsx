import type { RefObject } from 'preact';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
}

export function SearchBar({ value, onChange, onClear, isLoading, inputRef }: SearchBarProps) {
  const quickSearches = ['Onix 2019', 'Hilux 2015', '24/14', 'YN-PS2416B', 'SD6', 'Tracker', 'HB20', 'Corolla'];

  return (
    <div className="w-full">
      <div className="relative flex items-center">
        <div className="absolute left-4 text-slate-400 pointer-events-none text-lg" aria-hidden="true">
          🔍
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          placeholder='Busque por veículo + ano (ex: Gol 2010, Onix 2019), medida (ex: 22/16, 24", 600mm) ou código (ex: SD6, YN-PS2416B)...'
          className="w-full pl-12 pr-36 py-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm sm:text-base shadow-sm dark:bg-slate-900/90 dark:border-slate-700/80 dark:text-slate-100 dark:placeholder-slate-400 dark:shadow-inner transition-all"
          autoFocus
        />

        <div className="absolute right-3 flex items-center gap-2">
          {isLoading && (
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          )}

          {value ? (
            <button
              type="button"
              onClick={onClear}
              title="Limpar pesquisa (Esc)"
              className="px-2.5 py-1 text-xs rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Limpar <span className="hidden sm:inline text-[10px] opacity-70">(Esc)</span>
            </button>
          ) : (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono text-[10px] pointer-events-none"
              title="Pressione F2 ou Ctrl+K para focar na busca de qualquer lugar"
            >
              <kbd className="font-sans font-semibold">F2</kbd>
              <span>/</span>
              <kbd className="font-sans font-semibold">Ctrl+K</kbd>
            </span>
          )}
        </div>
      </div>

      {/* Sugestões de Consulta Rápida */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-600 dark:text-slate-400">Sugestões rápidas:</span>
        {quickSearches.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => onChange(term)}
            className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700/50 transition-colors cursor-pointer"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}
