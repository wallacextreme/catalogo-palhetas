# ARQUITETURA DO SISTEMA

## 1. VISÃO GERAL

O sistema de Catálogo Técnico e Cross-Reference de Palhetas Automotivas foi projetado com arquitetura modular, orientada a domínio (Domain-Driven Design), desacoplada de mecanismos de persistência e fornecedores de nuvem.

A aplicação opera em dois ambientes principais de execução:
1. **Desktop Windows**: Executável nativo empacotado via **Tauri v2 + Rust**, utilizando banco de dados relacional local **SQLite** (`@tauri-apps/plugin-sql`).
2. **Web / PWA**: Aplicação Single-Page Application (SPA) e Progressive Web App via **Vite + Preact + TypeScript**, operando offline-first com banco local **IndexedDB** via **Dexie.js**.

---

## 2. CAMADAS ARQUITETURAIS

```text
src/
├── domain/             # Entidades, tipos essenciais, validações, regras de negócio puras
│   ├── types.ts        # Interfaces centrais (Vehicle, BrandProduct, ProductFit, Connector, etc.)
│   ├── ids.ts          # Gerador determinístico de identificadores estáveis
│   ├── measures.ts     # Conversão e formatação técnica de polegadas e milímetros
│   ├── normalize.ts    # Algoritmos de normalização textual e canonização
│   ├── vehicle-category.ts # Regras estritas de admissão e exclusão de linha pesada
│   └── years.ts        # Parser e lógica de sobreposição de intervalos de fabricação
├── application/        # Casos de uso e orquestração do catálogo
│   ├── search/         # Engine de busca fuzzy, prefixada e por código
│   └── cross-ref/      # Motor de resolução de compatibilidades e equivalências
├── repositories/       # Contratos e abstrações de dados
│   ├── interfaces.ts   # Contratos agnósticos de banco de dados
│   ├── memory/         # Implementação de repositório em memória (alta velocidade & testes)
│   ├── dexie/          # Adaptador de persistência para IndexedDB (Web / PWA)
│   └── sqlite/         # Adaptador de persistência para SQLite (Tauri Desktop)
├── services/           # Serviços de dados, rastreabilidade e sincronização
├── ui/                 # Interface gráfica profissional automotiva
│   ├── components/     # Componentes atômicos e reutilizáveis
│   ├── layouts/        # Layout principal responsivo (Desktop, Tablet, Mobile)
│   └── views/          # Visualizações de busca rápida, detalhes do veículo e cross-ref
└── infrastructure/     # Utilitários de plataforma, detecção Tauri vs Web, Service Worker
```

---

## 3. SEPARAÇÃO RIGOROSA: COMPATIBILIDADE vs EQUIVALÊNCIA

Um princípio inegociável da arquitetura é a distinção de grau de relação técnica entre produtos de diferentes fabricantes:
- **`documented_equivalence`**: Declarada explicitamente na fonte original (tabela de equivalência oficial).
- **`application_match`**: Ambos os fabricantes atendem formalmente ao mesmo veículo, mesma posição e mesmo intervalo de ano documentado.
- **`derived_compatibility`**: Relação inferida por igualdade dimensional e tipo de braço/conector equivalente comprovado.
- **`not_confirmed`**: Quando faltam dados para atestar compatibilidade ou existem divergências técnicas.

NUNCA assumir que "mesma medida + mesma conexão = mesmo produto".

---

## 4. PREPARAÇÃO PARA CLOUD E SINCRONIZAÇÃO

Os contratos de repositório e os modelos são agnósticos de backend.
A arquitetura foi desenhada com IDs determinísticos (baseados em hash de conteúdo) e carimbos de versão para permitir sincronização bidirecional futura com Firebase Firestore, Supabase PostgreSQL ou PocketBase sem necessidade de refatorar a camada de domínio.
