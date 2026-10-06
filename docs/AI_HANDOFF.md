# AI HANDOFF & CONTINUITY LOG

Este documento estabelece o estado operacional, as decisões técnicas consolidadas e o handoff contínuo do **Sistema de Catálogo Técnico e Cross-Reference de Palhetas Automotivas**.

---

## 1. RESUMO EXECUTIVO DO PROJETO

O sistema foi concebido, arquitetado e implementado como uma aplicação industrial, técnica, auditável e 100% offline-first para consulta e cross-reference comparativo entre as três principais marcas de palhetas do mercado brasileiro: **DYNA (Catálogo 2025)**, **CINOY (Catálogo 2023)** e **VETOR (Catálogo 2025)**.

### Plataformas Suportadas
1. **Web / PWA**: Vite 6 + Preact + TypeScript + TailwindCSS v4 com VitePWA (Service Worker auto-update e pré-cache integral do dataset JSON de 5.2MB).
2. **Desktop Windows**: Tauri v2 + Rust 1.96 + SQLite nativo (`tauri-plugin-sql`) com migrations versionadas.

---

## 2. MÉTRICAS CONSOLIDADAS DO DATASET VALIDADO

Todos os dados foram extraídos com **fidelidade geométrica e textual absoluta** dos PDFs oficiais primários, passando pelo pipeline de validação relacional (`scripts/pipeline/validator.ts`):
* **Erros de Integridade**: 0
* **Avisos de Integridade**: 0
* **Montadoras / Marcas de Veículos**: 126
* **Catálogos Oficiais Rastreáveis**: 3
* **Páginas de Catálogo Auditáveis**: 212
* **Conectores / Encaixes Técnicos Catalogados**: 58
* **Veículos Únicos (Somente Linha Leve)**: 2.757
* **Aplicações Técnicas por Posição**: 7.154
* **Produtos / Palhetas Oficiais**: 584
* **Fits de Compatibilidade Cruzada**: 10.543

---

## 3. ARQUITETURA E DIRETÓRIOS

```
├── CATALOGO CINOY.pdf           # Fonte primária CINOY (2023)
├── Catalogo-Dyna-2025.pdf         # Fonte primária DYNA (2025)
├── Catálogo Vetor Palhetas.pdf     # Fonte primária VETOR (2025)
├── data/
│   ├── raw/                      # JSONs brutos com geometria de spans e blocos
│   └── validated/dataset.json    # Dataset oficial consolidado e validado
├── public/data/dataset.json      # Dataset exposto para Web/PWA e fetch local
├── src/
│   ├── domain/                   # Entidades, tipos, medidas, anos, IDs estáveis
│   │   ├── ids.ts                # Hash estável determinístico cyrb53
│   │   ├── measures.ts           # Conversão e formatação de polegadas e mm
│   │   ├── normalize.ts          # Normalização de busca, diacríticos e códigos
│   │   ├── types.ts              # Tipagem estrita de todas as entidades
│   │   ├── vehicle-category.ts   # Dupla barreira de exclusão da linha pesada
│   │   └── years.ts              # Parser estrito de ranges de anos
│   ├── repositories/             # Abstração de persistência
│   │   ├── interfaces.ts         # Contratos desacoplados
│   │   ├── memory/               # In-memory database para testes e busca ultra-rápida
│   │   ├── dexie/                # IndexedDB offline-first para Web/PWA
│   │   └── sqlite/               # Migrations e queries para Tauri Windows Desktop
│   ├── search/                   # Engine de busca MiniSearch multi-critério e fuzzy
│   │   └── search-engine.ts
│   ├── services/                 # CatalogService singleton unificado
│   │   └── catalog-service.ts
│   └── ui/                       # Interface de usuário industrial Preact + TailwindCSS v4
│       ├── App.tsx               # Orquestrador de estado, filtros, paginação e modais
│       └── components/
│           ├── Header.tsx        # Identidade visual, métricas e theme switcher
│           ├── SearchBar.tsx     # Input inteligente com chips de consultas rápidas
│           ├── FiltersBar.tsx    # Filtros técnicos combinados (marca, posição, pol, etc.)
│           ├── CrossReferenceTable.tsx # Tabela comparativa DYNA vs CINOY vs VETOR
│           ├── TraceabilityModal.tsx   # Modal de auditoria de página e catálogo
│           └── ProductDetailModal.tsx  # Ficha técnica e veículos compatíveis
├── src-tauri/                    # Configuração Rust + Tauri v2 Desktop
│   ├── Cargo.toml                # Dependências Rust (tauri, tauri-plugin-sql)
│   ├── tauri.conf.json           # Janela 1280x800, permissões SQL e caminhos de build
│   └── src/lib.rs                # Inicialização do plugin SQL e lifecycle do Tauri
├── scripts/
│   ├── extract/extract_pdf.py    # Extrator PyMuPDF com coordenadas
│   └── pipeline/                 # Parsers por catálogo, validadores e orquestrador
└── tests/
    ├── unit/                     # Testes de domínio e de search engine
    └── integration/              # Testes integrados do CatalogService
```

---

## 4. REGRAS DE OURO E DECISÕES ARQUITETURAIS IMUTÁVEIS

1. **Fidelidade Estrita aos Dados**:
   - É estritamente proibido inventar dados de códigos, conexões, anos ou compatibilidades. Lacunas na fonte primária são mantidas como `null` ("Não informado").
2. **Exclusão Categórica da Linha Pesada**:
   - Caminhões, ônibus, tratores, colheitadeiras e máquinas pesadas são estritamente proibidos e barrados tanto no nível dos parsers quanto no modelo de domínio e validação (`vehicle-category.ts`).
3. **Compatibilidade ≠ Equivalência**:
   - Apenas declarações explícitas da fonte recebem `documented_equivalence`. Aplicações de mesma montadora/modelo/posição com sobreposição temporal são classificadas como `application_match`. Inferências dimensionais são classificadas como `derived_compatibility`.
4. **Rastreabilidade de Página**:
   - Qualquer aplicação ou fit expõe formalmente: Fabricante, Nome do Catálogo, Ano da Edição e Número da Página Exata do PDF.

---

## 5. COMANDOS DE OPERAÇÃO (TOOLCHAIN COM BUN)

* **Executar Testes**: `bun test` (23 testes passando em ~520ms)
* **Verificação de Tipos**: `bun run typecheck` (zero erros TypeScript)
* **Build Web/PWA**: `bun run build:web` (gera pasta `dist/` com PWA precache em ~1.7s)
* **Executar Servidor Web Local**: `bun run dev` (porta 3000)
* **Verificar Compilação Tauri**: `cargo check --manifest-path src-tauri/Cargo.toml` (aprovado)
* **Recompilar Pipeline de Dados**: `bun scripts/pipeline/run.ts`
