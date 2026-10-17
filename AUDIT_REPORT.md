# 📋 Relatório de Auditoria Técnica e Arquitetural (`AUDIT_REPORT.md`)

**Projeto:** Catálogo Técnico & Cross-Reference de Palhetas Automotivas  
**Arquitetura:** Clean Architecture / DDD • Preact + TypeScript Strict + Tailwind CSS v4 + MiniSearch + Dexie (IndexedDB) + Tauri v2  
**Ponto de Restauração Inicial:** `restore-point-0-initial` (Branch de segurança: `backup/estado-original`)

---

## 1. Diagnóstico da Estrutura Atual de Pastas e Componentes

```text
src/
├── domain/                  # Regras de negócio puras e tipagem estrita
│   ├── types.ts             # Entidades (Vehicle, VehicleApplication, BrandProduct, ProductFit, etc.)
│   ├── normalize.ts         # Normalização léxica e compactCode
│   ├── measures.ts          # Conversão dimensional Polegadas (") ↔ Milímetros (mm)
│   ├── years.ts             # Parser de faixas de anos (yearStart, yearEnd, yearEndOpen, yearInRange)
│   ├── manufacturers.ts     # Canonização de montadoras e fabricantes
│   ├── consolidation.ts     # Desacoplamento de submodelos e consolidação de famílias (VehicleFamilyResult)
│   ├── conflicts.ts         # Detecção de conflitos documentais e anomalias de fonte
│   └── governance.ts        # Matriz de confiança técnica (6 estados formais de governança)
├── search/
│   └── search-engine.ts     # Motor de busca híbrido MiniSearch + filtros estruturados + proteção de submodelos
├── repositories/
│   ├── memory/              # Repositório em memória de baixa latência (< 2ms)
│   ├── dexie/               # Persistência offline client-side via IndexedDB (Dexie v4)
│   └── sqlite/              # Schema relacional preparado para Tauri Desktop
├── services/
│   └── catalog-service.ts   # Orquestrador singleton de inicialização, cache e busca
└── ui/
    ├── App.tsx              # Estado global, temas (Dark/Light), atalhos e modais
    └── components/
        ├── Header.tsx               # Cabeçalho industrial com métricas e alternador de tema
        ├── SearchBar.tsx            # Barra de busca universal com sugestões rápidas
        ├── FiltersBar.tsx           # 7 filtros técnicos combinados (Montadora, Modelo, Ano, Posição, Polegadas, Marca, Relação)
        ├── VehicleFamilyCard.tsx    # Card principal consolidado por família com accordions de variantes e cópia p/ WhatsApp
        ├── CrossReferenceTable.tsx  # Tabela comparativa individual por veículo
        ├── ProductDetailModal.tsx   # Modal de raio-X do produto e veículos compatíveis
        └── TraceabilityModal.tsx    # Modal de auditoria documental (Catálogo, Edição e Página do PDF)
```

---

## 2. Análise da Integridade dos Dados (`dataset.json`)

- **Fontes Primárias Auditadas:**
  - **DYNA:** Catálogo Oficial 2025 (Linha Leve)
  - **CINOY:** Catálogo de Palhetas 2023 (Tradicionais, Silicone e Específicas)
  - **VETOR:** Catálogo Oficial de Palhetas 2025
- **Escopo Linha Leve:** Exclusão determinística de caminhões, ônibus e linha pesada validada por suíte de testes (`115 pass / 0 fail`).
- **Rastreabilidade:** Todos os veículos, aplicações e produtos preservam `sourceIds` apontando para o documento e página original do PDF.

---

## 3. O Que Já Está Implementado vs. Pontos de Correção e Evolução Identificados

### ✅ O Que Já Está Sólido na Base Atual
1. **Busca por Ano Intermediário:** `extractYearFromQuery` e `yearInRange` já filtram matematicamente intervalos (`yearStart <= ano <= yearEnd` e `yearEndOpen`).
2. **Isolamento de Submodelos:** `Hilux` não se mistura com `SW4`; `Onix` não se mistura com `Onix Plus`; `HB20` não se mistura com `HB20S`; `Gol` não vaza para `Golf`.
3. **Governança Técnica (Fase 5):** `governance.ts` classifica aplicações em 6 estados (`DOCUMENTED`, `MULTI_CATALOG_CONFIRMED`, `TECHNICAL_VARIANT`, `CONNECTOR_VARIANT`, `SOURCE_CONFLICT`, `SOURCE_REVIEW`).

### 🐛 Bugs Sutis Encontrados na Auditoria (A Corrigir)
1. **Rastreabilidade no Cabeçalho da Família (`VehicleFamilyCard.tsx` e `CrossReferenceTable.tsx`):**
   - O botão `"📄 Rastreabilidade"` no topo do card criava objetos fictícios (`page: 1`, `catalogName: 'Catálogo Oficial de Fabricante'`) em vez de consultar as fontes reais via `CatalogService.getInstance().getSourcesByIds(family.sourceIds)`.
2. **Badges de `"Modelos relacionados"` sem ação de clique (`VehicleFamilyCard.tsx`):**
   - Os badges `Onix Plus →`, `SW4 →`, `HB20S →` exibem seta de navegação, mas eram `<span>` estáticos sem callback para filtrar o modelo relacionado em 1 clique.
3. **Uso residual de `alert()` bloqueante (`CrossReferenceTable.tsx`):**
   - O botão de copiar ficha na tabela secundária ainda usava `alert()` nativo em vez de feedback visual não-bloqueante.

### 🚀 Oportunidades de Evolução Técnica (Fases 1 a 5)
1. **Fase 1 (Saneamento de Tipagem & Script `validate:data`):**
   - Eliminar `any` residuais nos arquivos de domínio/serviço/UI e disponibilizar o comando `bun run validate:data` (`scripts/validate-catalog.ts`) verificando duplicidades, órfãos, intervalos de anos e integridade de códigos.
2. **Fase 2 (Busca Direta por Medidas `22/16`, `24"`, `600mm` + Cross-Reference Direto por Código + Alerta de Ano de Transição):**
   - Permitir digitar pares de medidas (`"22/16"`, `"24/14"`), polegadas (`"22\""`) ou milímetros (`"600mm"`) diretamente na barra de busca principal.
   - Enriquecer o resultado de busca por código de peça (`SD6`, `PVF2414G`, `YN-PS2416B`) com índice $O(1)$ de **códigos equivalentes das outras marcas (DYNA ↔ CINOY ↔ VETOR)** que compartilham as mesmas aplicações veiculares.
   - Detectar automaticamente **Ano de Transição (`hasTransitionWarning`)** quando um mesmo modelo/ano possui múltiplas gerações ou variantes com encaixes/medidas distintas sobrepostas.
3. **Fase 3 (UX de Balcão, Visualizador SVG de Conectores, WhatsApp Completo e Atalhos `F2`/`Ctrl+K`/`Esc`):**
   - Ícones esquemáticos SVG para visualização rápida do tipo de conector (`Gancho G`, `Top-Lock TL1/TL2`, `Baioneta B`, `Slim/Específico`).
   - Enriquecer a cópia para WhatsApp com medidas em Polegadas (`"`) + Milímetros (`mm`), tipo de conector (`🔌 Encaixe`) e alerta de ano de transição/divergência.
   - Atalhos globais de balcão: `F2` ou `Ctrl+K` para focar/selecionar a busca instantaneamente e `Esc` para limpar busca/filtros ou fechar modais.
4. **Fase 4 (Persistência Local de Balcão — Favoritos, Buscas Recentes e Notas por Veículo com Backup JSON):**
   - Serviço `CounterStorageService` (`localStorage` seguro) com veículos fixados/favoritos, histórico recente em 1 clique e anotações técnicas locais de balcão por veículo com **Exportar/Importar JSON**.
5. **Fase 5 (Higiene Git, Sigilo de Dados `.gitignore`, Build `.exe`/`.msi` e Publicação GitHub):**
   - Endurecimento completo do `.gitignore` (bloqueando PDFs, dados brutos, `scratch/`, `.env*`, chaves, bancos locais e backups de clientes), validação completa e geração dos instaladores Windows (`.exe` e `.msi`).
