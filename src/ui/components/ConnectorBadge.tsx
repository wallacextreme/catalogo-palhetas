interface ConnectorBadgeProps {
  code?: string;
  name?: string;
  compact?: boolean;
}

export function getConnectorVisualInfo(rawCode?: string): {
  category: 'hook' | 'toplock' | 'bayonet' | 'pin' | 'specific';
  shortLabel: string;
  tip: string;
} {
  const c = (rawCode || 'G').trim().toUpperCase();

  if (c === 'G' || c === 'GANCHO' || c === 'U' || c === '01' || c.includes('GANCHO')) {
    return {
      category: 'hook',
      shortLabel: rawCode || 'G (Gancho)',
      tip: 'Conector Gancho Universal (U-Hook 9x3 / 9x4)',
    };
  }
  if (c.startsWith('TL') || c === '03' || c === '05' || c === '06' || c.includes('TOP')) {
    return {
      category: 'toplock',
      shortLabel: rawCode || c,
      tip: 'Conector Top-Lock / Botão Superior (Trava quadrada)',
    };
  }
  if (c === 'B' || c === 'BAIONETA' || c === '02' || c.includes('BAIONETA')) {
    return {
      category: 'bayonet',
      shortLabel: rawCode || 'B (Baioneta)',
      tip: 'Conector Baioneta / Braço Reto com Pino Superior',
    };
  }
  if (c.startsWith('SL') || c.startsWith('PL') || c === '04' || c.includes('PINO')) {
    return {
      category: 'pin',
      shortLabel: rawCode || c,
      tip: 'Conector Side-Lock / Pino Lateral',
    };
  }
  return {
    category: 'specific',
    shortLabel: rawCode || 'Específico',
    tip: 'Conector Específico / Dedicado ao Modelo',
  };
}

export function ConnectorBadge({ code, name, compact = false }: ConnectorBadgeProps) {
  const info = getConnectorVisualInfo(code);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 bg-slate-100/90 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
      title={name ? `${info.tip} — ${name}` : info.tip}
    >
      {/* Esquema SVG do Conector */}
      <span className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true">
        {info.category === 'hook' && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 18V9a5 5 0 0 1 10 0v3a2.5 2.5 0 0 1-5 0V9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {info.category === 'toplock' && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="4" y="7" width="16" height="10" rx="2" />
            <rect x="9" y="10" width="6" height="4" rx="0.5" fill="currentColor" />
          </svg>
        )}
        {info.category === 'bayonet' && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 14h18M7 14v-3h10v3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="8" r="1.8" fill="currentColor" />
          </svg>
        )}
        {info.category === 'pin' && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="9" cy="12" r="4" />
            <path d="M13 12h7" strokeLinecap="round" />
          </svg>
        )}
        {info.category === 'specific' && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        )}
      </span>

      <span className="font-mono font-bold tracking-tight">{info.shortLabel}</span>
    </div>
  );
}
