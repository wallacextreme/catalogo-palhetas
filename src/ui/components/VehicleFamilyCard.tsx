import { useState } from 'preact/hooks';
import type {
  BrandProduct,
  CatalogSource,
  MatchedApplicationFit,
  TechnicalVariant,
  VehicleFamilyResult,
} from '@/domain/types';
import { formatMillimeters } from '@/domain/measures';
import { ConnectorBadge } from './ConnectorBadge';

interface VehicleFamilyCardProps {
  family: VehicleFamilyResult;
  onShowSources: (sources: CatalogSource[], title: string) => void;
  onShowSourcesByIds?: (sourceIds: string[], title: string) => void;
  onSelectProduct?: (product: BrandProduct) => void;
  onSelectRelatedFamily?: (query: string) => void;
}

/** Formata a ficha técnica de uma variante individual para cópia/WhatsApp no balcão */
export function formatVariantTechnicalSheet(
  family: VehicleFamilyResult,
  variant: TechnicalVariant,
  includeDivergenceNotice = true
): string {
  const lines: string[] = [
    `${family.fullName}${variant.bodyTypeBadge ? ` (${variant.bodyTypeBadge})` : ''}`,
    `Ano: ${variant.label}`,
    '',
  ];

  const frontApps = variant.applications.filter((a) => a.position !== 'traseira');
  const rearApp = variant.applications.find((a) => a.position === 'traseira');

  if (frontApps.length > 0) {
    lines.push('Dianteira');
    const driver = frontApps.find((a) => a.position === 'motorista');
    const passenger = frontApps.find((a) => a.position === 'passageiro');
    const pair = frontApps.find((a) => a.position === 'par_dianteiro');

    if (driver?.inches) {
      const mmPart = driver.millimeters ? ` (${formatMillimeters(driver.millimeters)} mm)` : '';
      lines.push(`Motorista: ${driver.inches}"${mmPart}`);
    }
    if (passenger?.inches) {
      const mmPart = passenger.millimeters ? ` (${formatMillimeters(passenger.millimeters)} mm)` : '';
      lines.push(`Passageiro: ${passenger.inches}"${mmPart}`);
    }
    if (pair?.inches) {
      const mmPart = pair.millimeters ? ` (${formatMillimeters(pair.millimeters)} mm)` : '';
      lines.push(`Par dianteiro: ${pair.inches}"${mmPart}`);
    }
    for (const a of frontApps) {
      if (!['motorista', 'passageiro', 'par_dianteiro'].includes(a.position)) {
        lines.push(`${a.positionLabel}: ${a.inches ? `${a.inches}"` : a.sizeLabel || ''}`);
      }
    }
    const frontConn = driver?.connectorRaw || driver?.connector?.code || pair?.connectorRaw || pair?.connector?.code;
    if (frontConn) {
      lines.push(`Encaixe: ${frontConn}`);
    }
    lines.push('');
  }

  if (rearApp) {
    lines.push('Traseira');
    const rearMm = rearApp.millimeters ? ` (${formatMillimeters(rearApp.millimeters)} mm)` : '';
    lines.push(`Traseira: ${rearApp.inches ? `${rearApp.inches}"${rearMm}` : rearApp.sizeLabel || 'Específica'}`);
    lines.push('');
  }

  // Marcas e códigos
  const brands = ['DYNA', 'CINOY', 'VETOR'];
  const brandLines: Record<string, string[]> = {
    DYNA: [],
    CINOY: [],
    VETOR: [],
  };

  for (const app of variant.applications) {
    for (const fit of app.fits) {
      const bCode = (fit.manufacturerCode || '').toUpperCase();
      if (!brandLines[bCode]) brandLines[bCode] = [];
      const codeStr = `${fit.product.code}${app.positionLabel ? ` (${app.positionLabel})` : ''}`;
      if (!brandLines[bCode].includes(codeStr)) {
        brandLines[bCode].push(codeStr);
      }
    }
  }

  for (const b of brands) {
    if (brandLines[b] && brandLines[b].length > 0) {
      lines.push(`${b}: ${brandLines[b].join(' / ')}`);
    }
  }

  if (variant.hasTransitionWarning && variant.transitionWarningText) {
    lines.push('');
    lines.push(`⚠ ${variant.transitionWarningText}`);
  }

  const hasDivergence =
    variant.applications.some((a) => a.technicalStatus === 'SOURCE_CONFLICT') ||
    Boolean(family.governance && family.governance.documentaryDivergencesCount > 0);

  if (includeDivergenceNotice && hasDivergence) {
    lines.push('');
    lines.push('Atenção: existem medidas divergentes entre catálogos.');
  }

  return lines.join('\n');
}

/** Formata a ficha técnica completa da família para cópia/WhatsApp */
export function formatFamilyTechnicalSheet(family: VehicleFamilyResult): string {
  if (family.variants.length === 1) {
    return formatVariantTechnicalSheet(family, family.variants[0]!, true);
  }

  const variantSheets = family.variants.map((v) =>
    formatVariantTechnicalSheet(family, v, false)
  );

  const lines = [
    `🚗 ${family.fullName}`,
    family.selectedYear !== undefined
      ? `Ano selecionado: ${family.selectedYear}`
      : `${family.variants.length} configurações técnicas documentadas`,
    '',
    variantSheets.join('\n\n--------------------\n\n'),
  ];

  if (family.governance && family.governance.documentaryDivergencesCount > 0) {
    lines.push('');
    lines.push('Atenção: existem medidas divergentes entre catálogos.');
  }

  return lines.join('\n');
}

export function VehicleFamilyCard({
  family,
  onShowSources,
  onShowSourcesByIds,
  onSelectProduct,
  onSelectRelatedFamily,
}: VehicleFamilyCardProps) {
  // Apenas a primeira variante vem expandida por padrão em busca ampla,
  // ou a variante única filtrada pelo ano.
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (family.variants.length > 0) {
      initial[family.variants[0]!.id] = true;
    }
    return initial;
  });

  const [showDivergenceDetails, setShowDivergenceDetails] = useState(false);

  const toggleVariant = (id: string) => {
    setExpandedVariants((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    for (const v of family.variants) all[v.id] = true;
    setExpandedVariants(all);
  };

  const collapseAll = () => {
    setExpandedVariants({});
  };

  const relationLabels: Record<string, { label: string; color: string; desc: string }> = {
    catalog_documented: {
      label: 'Documentada no Catálogo',
      color:
        'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
      desc: 'Aplicação oficial impressa no catálogo do fabricante.',
    },
    documented_equivalence: {
      label: 'Equivalência Documentada',
      color:
        'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
      desc: 'Fonte declara formalmente equivalência direta.',
    },
    application_match: {
      label: 'Mesma Aplicação',
      color:
        'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
      desc: 'Mesmo veículo, posição e anos sobrepostos.',
    },
    derived_compatibility: {
      label: 'Compatibilidade Derivada',
      color:
        'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
      desc: 'Inferida por critérios dimensionais e conexão compatível.',
    },
    not_confirmed: {
      label: 'Não Confirmada',
      color:
        'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
      desc: 'Dados insuficientes.',
    },
  };

  // Separa e agrupa os produtos de todos os itens da variante por fabricante (DYNA, CINOY, VETOR)
  const getVariantProductsByBrand = (variant: TechnicalVariant) => {
    const brandMap: Record<string, Array<{ posLabel: string; fit: MatchedApplicationFit }>> = {
      DYNA: [],
      CINOY: [],
      VETOR: [],
    };

    for (const app of variant.applications) {
      for (const fit of app.fits) {
        const mCode = (fit.manufacturerCode || '').toUpperCase();
        if (brandMap[mCode]) {
          brandMap[mCode]!.push({ posLabel: app.positionLabel, fit });
        } else {
          if (!brandMap[mCode]) brandMap[mCode] = [];
          brandMap[mCode]!.push({ posLabel: app.positionLabel, fit });
        }
      }
    }

    return brandMap;
  };

  // Separa aplicações dianteiras e traseiras para apresentação visual clara
  const splitApplications = (variant: TechnicalVariant) => {
    const frontApps = variant.applications.filter((a) => a.position !== 'traseira');
    const rearApp = variant.applications.find((a) => a.position === 'traseira');
    return { frontApps, rearApp };
  };

  // Estado para feedback visual de cópia
  const [copiedFamily, setCopiedFamily] = useState(false);
  const [copiedVariantId, setCopiedVariantId] = useState<string | null>(null);

  const copyTextToClipboard = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback para textarea em ambientes restritos
      }
    }
    if (typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const success = document.execCommand('copy');
        document.body.removeChild(ta);
        return success;
      } catch {
        return false;
      }
    }
    return false;
  };

  // Monta o texto completo da ficha técnica para cópia no clipboard
  const handleCopyFullSheet = async () => {
    const text = formatFamilyTechnicalSheet(family);
    await copyTextToClipboard(text);
    setCopiedFamily(true);
    setTimeout(() => setCopiedFamily(false), 2000);
  };

  const handleCopyVariantSheet = async (variant: TechnicalVariant) => {
    const text = formatVariantTechnicalSheet(family, variant, true);
    await copyTextToClipboard(text);
    setCopiedVariantId(variant.id);
    setTimeout(() => setCopiedVariantId(null), 2000);
  };

  return (
    <div className="industrial-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 mb-6 transition-colors shadow-sm bg-white dark:bg-slate-900/60">
      {/* 1. CABEÇALHO UNIFICADO DA FAMÍLIA (MARCA + MODELO UMA ÚNICA VEZ) */}
      <div className="bg-slate-100/90 dark:bg-slate-900/90 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">🚗</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {family.brand}
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {family.model}
              </h2>
            </div>

            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium capitalize">
              {family.category.replace('_', ' ')}
            </span>

            {/* Badges de Catálogos Oficiais */}
            <div className="flex items-center gap-1.5 ml-1">
              {(['DYNA', 'CINOY', 'VETOR'] as const).map((b) => {
                const hasApp = family.documentedBrands.includes(b);
                return (
                  <span
                    key={b}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition-all ${
                      hasApp
                        ? b === 'DYNA'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30'
                          : b === 'CINOY'
                            ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
                            : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30'
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

          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {family.selectedYear !== undefined
                ? `1 aplicação compatível com ${family.selectedYear}`
                : `${family.totalVariants} ${family.totalVariants === 1 ? 'configuração documentada' : 'configurações documentadas'}`}
            </span>
            <span>•</span>
            <span>Consulta técnica de balcão oficial</span>
          </div>

          {/* Resumo Técnico de Governança (Fase 5 - Balcão) */}
          {family.governance && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {family.governance.confirmedCatalogsCount > 1 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[11px] font-bold">
                  <span>✓</span> {family.governance.confirmedCatalogsCount} catálogos confirmados
                </span>
              )}
              {family.hasTransitionWarning && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 text-[11px] font-bold"
                  title={
                    family.transitionYears && family.transitionYears.length > 0
                      ? `Anos de transição de geração/encaixe: ${family.transitionYears.join(', ')}`
                      : 'Mudança de geração ou encaixe no mesmo ano'
                  }
                >
                  <span>⚡</span> Ano de Transição
                  {family.transitionYears && family.transitionYears.length > 0
                    ? ` (${family.transitionYears.slice(0, 3).join(', ')})`
                    : ''}
                </span>
              )}
              {family.governance.documentaryDivergencesCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDivergenceDetails(!showDivergenceDetails)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
                  title="Clique para ver detalhes das divergências documentadas"
                >
                  <span>⚠</span> {family.governance.documentaryDivergencesCount} divergência documental
                  <span className="underline ml-1 font-normal text-[10px]">
                    {showDivergenceDetails ? '(Ocultar)' : '(Ver detalhes)'}
                  </span>
                </button>
              )}
              {family.governance.hasBodyVariants && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold">
                  Aplicações distintas por carroceria
                </span>
              )}
            </div>
          )}

          {family.relatedFamilies && family.relatedFamilies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Modelos relacionados:</span>
              {family.relatedFamilies.map((rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() => onSelectRelatedFamily?.(rel)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/80 hover:bg-amber-500/15 dark:bg-slate-800 dark:hover:bg-amber-500/20 text-slate-700 hover:text-amber-800 dark:text-slate-300 dark:hover:text-amber-300 font-medium text-[11px] border border-slate-300 hover:border-amber-400 dark:border-slate-700 dark:hover:border-amber-500/40 shadow-2xs transition-colors cursor-pointer"
                  title={`Pesquisar ${rel}`}
                >
                  <span>{rel}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">→</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ações Rápidas de Balcão */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyFullSheet}
            className={`text-xs px-3 py-1.5 rounded-lg border shadow-2xs flex items-center gap-1.5 transition-colors font-medium cursor-pointer ${
              copiedFamily
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="Copiar todas as variantes e códigos da família para WhatsApp ou orçamento"
          >
            <span aria-hidden="true">{copiedFamily ? '✓' : '📋'}</span>
            <span>{copiedFamily ? 'Copiado!' : 'Copiar p/ WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onShowSourcesByIds) {
                onShowSourcesByIds(family.sourceIds, `Fontes Oficiais: ${family.fullName}`);
              } else {
                onShowSources(
                  family.sourceIds.map((id) => ({
                    id,
                    catalogId: '',
                    manufacturer: family.brand,
                    catalogName: 'Catálogo Oficial de Fabricante',
                    catalogYear: 2025,
                    page: 1,
                  })),
                  `Fontes Oficiais: ${family.fullName}`,
                );
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
            title="Ver rastreabilidade de todas as páginas onde a família é citada"
          >
            <span aria-hidden="true">📄</span> Rastreabilidade
          </button>
        </div>
      </div>

      {/* 1.1 PAINEL EXPANSÍVEL DE DIVERGÊNCIA DOCUMENTAL (Fase 5 - Balcão) */}
      {showDivergenceDetails && family.governance?.divergenceDetails && family.governance.divergenceDetails.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-3.5 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-extrabold flex items-center gap-1.5 text-amber-900 dark:text-amber-300 text-sm">
              <span aria-hidden="true">⚠</span> Divergência Documental entre Catálogos
            </span>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
              Confirme a medida do braço no veículo antes da venda
            </span>
          </div>
          <div className="space-y-2.5">
            {family.governance.divergenceDetails.map((div, dIdx) => (
              <div key={dIdx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-2xs">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100 mb-1">
                  <span>{div.positionLabel} • Período {div.years}</span>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-mono">
                    Conflito de Balcão
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs mb-2">
                  {div.warningMessage}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Catálogos Documentados:</span>
                  {div.options.map((opt, oIdx) => (
                    <span
                      key={oIdx}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-slate-100"
                    >
                      {opt.brand}: {opt.inches ? `${opt.inches}"` : 'Medida não informada'}
                      {opt.connector ? ` [${opt.connector}]` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. BANNER DE ANO EM DESTAQUE (QUANDO BUSCADO COM ANO ESPECÍFICO) */}
      {family.selectedYear !== undefined && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-medium">
            <span aria-hidden="true">🎯</span>
            <span>
              Aplicação encontrada para <b>{family.selectedYear}</b>
            </span>
          </div>
          <span className="text-[11px] font-mono uppercase bg-amber-500/20 px-2 py-0.5 rounded font-bold">
            Ano {family.selectedYear}
          </span>
        </div>
      )}

      {/* 3. BARRA DE CONTROLE DO ACCORDION */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <span aria-hidden="true">⚙️</span> Configurações Técnicas por Ano e Carroceria
        </span>

        {family.variants.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Expandir Todas
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
            >
              Recolher Todas
            </button>
          </div>
        )}
      </div>

      {/* 4. LISTA ACCORDION INTELIGENTE (SEM DUPLICAÇÃO DE CABEÇALHOS) */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {family.variants.map((variant) => {
          const isExpanded = Boolean(expandedVariants[variant.id]);
          const { frontApps, rearApp } = splitApplications(variant);
          const brandProducts = getVariantProductsByBrand(variant);

          // Extrai as medidas rápidas dianteiras para o badge do cabeçalho
          const driver = frontApps.find((a) => a.position === 'motorista');
          const passenger = frontApps.find((a) => a.position === 'passageiro');
          const pair = frontApps.find((a) => a.position === 'par_dianteiro');

          return (
            <div key={variant.id} className="transition-colors">
              {/* Cabeçalho Clicável da Variante com foco e acessibilidade */}
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleVariant(variant.id)}
                className={`w-full text-left px-5 py-3.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 transition-colors cursor-pointer ${
                  isExpanded ? 'bg-amber-500/5 dark:bg-slate-800/30' : ''
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400 dark:text-slate-500 w-3 text-center transition-transform duration-200" aria-hidden="true">
                    {isExpanded ? '▼' : '▶'}
                  </span>

                  {/* Badge de Carroceria / Versão (Cabine vs Padrão) */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                      variant.variant === 'Cabine'
                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 font-bold'
                        : variant.variant === 'Special'
                          ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40'
                          : 'bg-slate-200/80 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {variant.bodyTypeBadge || 'Aplicação Padrão'}
                  </span>

                  {/* Rótulo da Variante de Ano em destaque Mono */}
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                    {variant.label}
                  </span>

                  {/* Alerta de Ano de Transição na Variante */}
                  {variant.hasTransitionWarning && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 text-[10px] font-bold"
                      title={variant.transitionWarningText}
                    >
                      <span>⚡</span> Ano de Transição
                    </span>
                  )}

                  {/* Medidas em Super Destaque Visual */}
                  <div className="flex items-center gap-2">
                    {driver?.inches && passenger?.inches ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/30 font-mono text-xs font-bold">
                        <span>Dianteira:</span>
                        <span className="text-amber-700 dark:text-amber-400 font-extrabold">{driver.inches}"</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-amber-700 dark:text-amber-400 font-extrabold">{passenger.inches}"</span>
                      </span>
                    ) : pair?.inches ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/30 font-mono text-xs font-bold">
                        <span>Par:</span>
                        <span className="text-amber-700 dark:text-amber-400 font-extrabold">{pair.inches}"</span>
                      </span>
                    ) : null}

                    {rearApp?.inches && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono text-xs font-semibold">
                        <span>Traseira:</span>
                        <span className="font-bold">{rearApp.inches}"</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto sm:ml-0">
                  {/* Marcas disponíveis nesta variante */}
                  <div className="flex items-center gap-1">
                    {variant.documentedBrands.map((b) => (
                      <span
                        key={b}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${
                          b === 'DYNA'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/30'
                            : b === 'CINOY'
                              ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
                              : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30'
                        }`}
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    {isExpanded ? 'Ocultar detalhes' : 'Ver ficha de balcão'}
                  </span>
                </div>
              </button>

              {/* 5. CONTEÚDO EXPANDIDO: EXPERIÊNCIA DE BALCÃO RÁPIDA */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-3 bg-slate-50/60 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                  {/* Alerta amarelo de Ano de Transição se aplicável */}
                  {variant.hasTransitionWarning && variant.transitionWarningText && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-300">
                      <span className="text-base" aria-hidden="true">⚡</span>
                      <span className="font-semibold">{variant.transitionWarningText}</span>
                    </div>
                  )}

                  {/* Grade de Posições com Medidas em Destaque Gigante */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span aria-hidden="true">📏</span> Medidas e Posições das Palhetas
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleCopyVariantSheet(variant)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                          copiedVariantId === variant.id
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
                        }`}
                        title="Copiar dados desta variante para WhatsApp ou cliente"
                      >
                        <span aria-hidden="true">{copiedVariantId === variant.id ? '✓' : '📋'}</span>
                        <span>{copiedVariantId === variant.id ? 'Copiado!' : 'Copiar p/ WhatsApp'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Aplicações Dianteiras */}
                      {frontApps.map((app, aIdx) => {
                        const uniqueBrandsCount = new Set(
                          app.fits.map((f) => f.manufacturerCode.toUpperCase()),
                        ).size;
                        return (
                          <div
                            key={aIdx}
                            className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                  {app.positionLabel}
                                </span>
                                <div className="flex items-baseline gap-2 mt-0.5">
                                  <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono tracking-tight">
                                    {app.inches ? `${app.inches}"` : app.sizeLabel || '—'}
                                  </span>
                                  {app.millimeters && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                      {formatMillimeters(app.millimeters)} mm
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex flex-col items-end gap-1">
                                <span className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                                  Encaixe
                                </span>
                                <ConnectorBadge
                                  code={app.connectorRaw || app.connector?.code || 'Padrão (G)'}
                                  name={app.connector?.name}
                                  compact
                                />
                              </div>
                            </div>

                            {uniqueBrandsCount >= 2 && (
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <span>✓</span> Aplicação confirmada em {uniqueBrandsCount} catálogos
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Aplicação Traseira (se houver) */}
                      {rearApp && (() => {
                        const rearBrandsCount = new Set(
                          rearApp.fits.map((f) => f.manufacturerCode.toUpperCase()),
                        ).size;
                        return (
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col justify-between gap-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                  Palheta Traseira
                                </span>
                                <div className="flex items-baseline gap-2 mt-0.5">
                                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                                    {rearApp.inches ? `${rearApp.inches}"` : rearApp.sizeLabel || '—'}
                                  </span>
                                  {rearApp.millimeters && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                      {formatMillimeters(rearApp.millimeters)} mm
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex flex-col items-end gap-1">
                                <span className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                                  Encaixe
                                </span>
                                <ConnectorBadge
                                  code={rearApp.connectorRaw || rearApp.connector?.code || 'Específico'}
                                  name={rearApp.connector?.name}
                                  compact
                                />
                              </div>
                            </div>

                            {rearBrandsCount >= 2 && (
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <span>✓</span> Aplicação confirmada em {rearBrandsCount} catálogos
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 6. CROSS-REFERENCE DE PRODUTOS AGRUPADO (SEM REPETIÇÃO DE CABEÇALHOS) */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                      <span aria-hidden="true">📦</span> Produtos Documentados por Fabricante (Cross-Reference)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* DYNA */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-yellow-500/30 dark:border-yellow-500/20 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-yellow-500/20">
                            <span className="font-black text-xs text-yellow-700 dark:text-yellow-400 tracking-wide flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                              DYNA
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Catálogo 2025</span>
                          </div>

                          {brandProducts.DYNA && brandProducts.DYNA.length > 0 ? (
                            <div className="space-y-2.5">
                              {brandProducts.DYNA.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => onSelectProduct?.(item.fit.product)}
                                        className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors text-left cursor-pointer"
                                        title="Ver detalhes do produto"
                                      >
                                        {item.fit.product.code}
                                      </button>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {item.posLabel}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                      {item.fit.product.family || 'Convencional'}
                                    </span>
                                  </div>

                                  <div className="text-right flex flex-col items-end gap-1">
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                                        relationLabels[item.fit.relationType]?.color
                                      }`}
                                      title={relationLabels[item.fit.relationType]?.desc}
                                    >
                                      {relationLabels[item.fit.relationType]?.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onShowSources(
                                          item.fit.sources,
                                          `Rastreabilidade DYNA: ${item.fit.product.code} (${family.fullName} ${variant.label})`,
                                        )
                                      }
                                      className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-medium cursor-pointer"
                                    >
                                      Ver Fonte
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 dark:text-slate-500 text-xs italic py-2">
                              Sem aplicação oficial documentada
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CINOY */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-red-500/30 dark:border-red-500/20 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-red-500/20">
                            <span className="font-black text-xs text-red-700 dark:text-red-400 tracking-wide flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              CINOY
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Catálogo 2023</span>
                          </div>

                          {brandProducts.CINOY && brandProducts.CINOY.length > 0 ? (
                            <div className="space-y-2.5">
                              {brandProducts.CINOY.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => onSelectProduct?.(item.fit.product)}
                                        className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors text-left cursor-pointer"
                                        title="Ver detalhes do produto"
                                      >
                                        {item.fit.product.code}
                                      </button>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {item.posLabel}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                      {item.fit.product.family || 'Convencional'}
                                    </span>
                                  </div>

                                  <div className="text-right flex flex-col items-end gap-1">
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                                        relationLabels[item.fit.relationType]?.color
                                      }`}
                                      title={relationLabels[item.fit.relationType]?.desc}
                                    >
                                      {relationLabels[item.fit.relationType]?.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onShowSources(
                                          item.fit.sources,
                                          `Rastreabilidade CINOY: ${item.fit.product.code} (${family.fullName} ${variant.label})`,
                                        )
                                      }
                                      className="text-[10px] text-red-700 dark:text-red-400 hover:underline font-medium cursor-pointer"
                                    >
                                      Ver Fonte
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 dark:text-slate-500 text-xs italic py-2">
                              Sem aplicação oficial documentada
                            </div>
                          )}
                        </div>
                      </div>

                      {/* VETOR */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-blue-500/30 dark:border-blue-500/20 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-blue-500/20">
                            <span className="font-black text-xs text-blue-700 dark:text-blue-400 tracking-wide flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              VETOR
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Catálogo 2025</span>
                          </div>

                          {brandProducts.VETOR && brandProducts.VETOR.length > 0 ? (
                            <div className="space-y-2.5">
                              {brandProducts.VETOR.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => onSelectProduct?.(item.fit.product)}
                                        className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors text-left cursor-pointer"
                                        title="Ver detalhes do produto"
                                      >
                                        {item.fit.product.code}
                                      </button>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {item.posLabel}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                      {item.fit.product.family || 'Convencional'}
                                    </span>
                                  </div>

                                  <div className="text-right flex flex-col items-end gap-1">
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                                        relationLabels[item.fit.relationType]?.color
                                      }`}
                                      title={relationLabels[item.fit.relationType]?.desc}
                                    >
                                      {relationLabels[item.fit.relationType]?.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onShowSources(
                                          item.fit.sources,
                                          `Rastreabilidade VETOR: ${item.fit.product.code} (${family.fullName} ${variant.label})`,
                                        )
                                      }
                                      className="text-[10px] text-blue-700 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                                    >
                                      Ver Fonte
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 dark:text-slate-500 text-xs italic py-2">
                              Sem aplicação oficial documentada
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
