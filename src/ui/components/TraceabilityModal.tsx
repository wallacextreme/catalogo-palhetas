import type { CatalogSource } from '@/domain/types';

interface TraceabilityModalProps {
  sources: CatalogSource[];
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function TraceabilityModal({ sources, isOpen, onClose, title }: TraceabilityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {title || 'Rastreabilidade Oficial da Informação'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
          {sources.map((s, idx) => (
            <div
              key={s.id || idx}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                  {s.manufacturer}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                  Ano {s.catalogYear}
                </span>
              </div>

              <div className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Catálogo:</span> {s.catalogName}
              </div>

              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Página do PDF:</span>{' '}
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-200/80 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                    Página {s.page}
                  </span>
                </div>
                {s.section && (
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Seção: <span className="text-slate-700 dark:text-slate-300">{s.section}</span>
                  </div>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/40 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <span>✓</span> {s.sourceReference || `${s.manufacturer} — Catálogo ${s.catalogYear} — Página ${s.page}`}
              </div>
            </div>
          ))}

          {sources.length === 0 && (
            <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs">
              Nenhuma fonte oficial anexada a este registro.
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-amber-500/10"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
