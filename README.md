# Catálogo Técnico & Cross-Reference de Palhetas Automotivas

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-2563eb?style=for-the-badge&logo=github&logoColor=white)](https://wallacextreme.github.io/catalogo-palhetas/)
[![Offline-First](https://img.shields.io/badge/Offline--First-PWA-059669?style=for-the-badge&logo=pwa&logoColor=white)](https://wallacextreme.github.io/catalogo-palhetas/)
[![Desktop](https://img.shields.io/badge/Desktop-Tauri_v2-24c8db?style=for-the-badge&logo=tauri&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![Preact](https://img.shields.io/badge/Frontend-Preact-673ab8?style=for-the-badge&logo=preact&logoColor=white)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS_v4-06b6d4?style=for-the-badge&logo=tailwindcss&logoColor=white)](#)
[![Testes Automatizados](https://img.shields.io/badge/Testes-29_Passed-success?style=for-the-badge)](#)
[![Licença](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

Sistema profissional de alta fidelidade para **consulta técnica**, **rastreabilidade oficial** e **equivalência cruzada (cross-reference)** multi-catálogo de palhetas limpadoras de para-brisa automotivas. Consolida em tempo real as bases oficiais de fabricantes homologados: **DYNA (Catálogo 2025)**, **CINOY (Catálogo 2023)** e **VETOR (Catálogo 2025)**.

Desenvolvido com arquitetura **100% Offline-First**, disponível como **PWA Web instalável** e aplicativo **Desktop nativo para Windows** via **Tauri v2**.

---

## 🌐 Acesso Online (Demonstração Live)

* **Aplicação em Produção (GitHub Pages)**: [https://wallacextreme.github.io/catalogo-palhetas/](https://wallacextreme.github.io/catalogo-palhetas/)
  * *PWA Homologado*: Funciona totalmente offline após o primeiro carregamento, com banco de dados em cache local.
  * *Alternador de Temas*: Interface industrial com modos Claro (Light) e Escuro (Dark) de alto contraste e legibilidade.

---

## 🎯 Problema Resolvido & Escopo Técnico

No mercado de reposição automotiva, a especificação incorreta de palhetas acarreta devoluções, danos a para-brisas e risco operacional. A fragmentação das informações entre catálogos de fabricantes concorrentes dificulta o cruzamento de códigos em balcões de autopeças.

O sistema resolve essa dor por meio de:
1. **Fidelidade à Linha Leve Exclusiva**: Exclusão estrita e determinística de caminhões, cavalos mecânicos, ônibus e máquinas agrícolas/pesadas. Foco 100% em automóveis de passeio, SUVs, picapes leves e utilitários urbanos.
2. **Desacoplamento e Desduplicação Inteligente**: Veículos com nomes agrupados em catálogos (ex: *Toyota Etios* vs *Hilux*) são rigorosamente desacoplados no motor de busca. Aplicações redundantes de múltiplos catálogos do mesmo carro são consolidadas em uma **ficha unificada única** com visualização por posição (motorista, passageiro e traseira).
3. **Classificação Formal da Relação Técnica**:
   * `Documentada no Catálogo`: Registro oficial expresso na fonte primária do fabricante.
   * `Equivalência Documentada`: Tabela formal de correspondência direta declarada no catálogo.
   * `Mesma Aplicação`: Correspondência coincidente com mesmo veículo, posição e anos sobrepostos.
   * `Compatibilidade Derivada`: Critérios dimensionais e encaixe compatível.
4. **Rastreabilidade por Item**: Cada veículo, produto e aplicação armazena metadados de auditoria apontando o catálogo oficial de origem, ano de edição e número exato da página do catálogo físico/PDF.

---

## 🏗️ Arquitetura & Engenharia do Software

O projeto segue os princípios de **Clean Architecture** e **Domain-Driven Design (DDD)**:

```
src/
├── domain/                  # Núcleo de domínio desacoplado de frameworks
│   ├── types.ts             # Modelos estritos TypeScript (Vehicle, BrandProduct, VehicleApplication, etc.)
│   ├── normalize.ts         # Normalização canônica (remoção de acentos, pontuações, compactCode)
│   ├── measures.ts          # Conversão dimensional exata polegadas ↔ mm e validação técnica
│   ├── years.ts             # Parser de anos (formatos 12/21, 2012 -> ..., ranges e sobreposição)
│   ├── manufacturers.ts     # Dicionário de montadoras automotivas e canonização
│   └── consolidation.ts     # Agrupamento determinístico e consolidação de fichas sem redundâncias
├── search/                  # Motor de busca multi-critério
│   └── search-engine.ts     # Indexação com tokenização MiniSearch + filtros técnicos booleanos
├── repositories/            # Camada de persistência intercambiável (Repository Pattern)
│   ├── interfaces.ts        # Contratos abstratos dos repositórios
│   ├── memory/              # Implementação em memória ultrarrápida (InMemoryCatalogDatabase)
│   ├── dexie/               # Armazenamento offline client-side IndexedDB v4 via Dexie.js
│   └── sqlite/              # Schema relacional e migrations para Tauri Desktop
├── services/                # Orquestração da camada de aplicação
│   └── catalog-service.ts   # Singleton de inicialização, cache e busca com consolidação
└── ui/                      # Camada de apresentação e componentes reativos
    ├── App.tsx              # Componente raiz, controle de ciclo de vida e temas
    └── components/          # Design system industrial com alto contraste
        ├── Header.tsx       # Barra de navegação com métricas dinâmicas e alternador de tema
        ├── SearchBar.tsx    # Campo universal de busca por veículo ou código com sugestões
        ├── FiltersBar.tsx   # Filtros combinados (Montadora, Modelo, Posição, Medida, Marca, Relação)
        ├── CrossReferenceTable.tsx  # Ficha técnica comparativa lado a lado (DYNA x CINOY x VETOR)
        ├── ProductDetailModal.tsx   # Modal de raio-X do produto e veículos compatíveis
        └── TraceabilityModal.tsx    # Modal de auditoria e página oficial do catálogo
```

---

## ⚙️ Pipeline de Dados & Governança

Os dados foram extraídos e tratados a partir de catálogos oficiais primários:
* **DYNA**: Catálogo Oficial 2025 (Linha Leve)
* **CINOY**: Catálogo de Palhetas 2023 (Palhetas Tradicionais, Silicone e Específicas)
* **VETOR**: Catálogo Oficial de Palhetas 2025

### Pipeline Automatizado (`scripts/pipeline/`):
* `extract.ts`: Extração estruturada de tabelas e metadados por PDF.
* `dyna-parser.ts`, `cinoy-parser.ts`, `vetor-parser.ts`: Parsers dedicados com limpeza léxica, conversão de conectores (gancho, baioneta, encaixes específicos) e normalização de medidas.
* `run.ts`: Normalizador, validador de integridade referencial e gerador do `public/data/dataset.json`.

---

## 🧪 Qualidade de Código & Suíte de Testes

O projeto conta com **29 testes automatizados** cobrindo normalização, conversão dimensional, exclusão de linha pesada, resolução de repositórios e motor de busca:

```bash
bun test
```

```text
tests/integration/catalog-service.test.ts:
  ✓ provides dataset summary metrics
  ✓ lists automotive brands in alphabetical order and strictly contains only manufacturers
  ✓ lists models by brand
  ✓ resolves multi-manufacturer cross reference for Onix
  ✓ resolves product by exact code and tracks official catalog source

tests/unit/domain.test.ts:
  ✓ normalizes accents, spaces, and punctuation
  ✓ converts inches to millimeters precisely
  ✓ validates plausible automotive wiper sizes
  ✓ parses various catalog year formats
  ✓ identifies allowed vehicle categories and heavy line keywords
  ✓ produces exclusion reasons correctly

tests/unit/search.test.ts:
  ✓ finds Chevrolet Onix by exact model name and year query
  ✓ finds product by exact, lower-case, and compact code (e.g. YN-PS2416B, SD6)
  ✓ applies combined filters correctly (Brand + Year)
  ✓ decouples car models (e.g. Etios without Hilux/SW4)
  ✓ decouples HILUX search completely from COROLLA
  ✓ decouples GOL search completely from GOLF, KADETT GL, and GL 4MATIC
  ✓ filters specifically by model (e.g. HILUX) when main search query is empty
  ✓ combines Brand and Model filters when main search query is empty

 29 pass, 0 fail (100% de aprovação)
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* [Bun](https://bun.sh/) (recomendado) ou [Node.js](https://nodejs.org/) v18+

### 1. Clonar o Repositório
```bash
git clone https://github.com/wallacextreme/catalogo-palhetas.git
cd catalogo-palhetas
```

### 2. Instalar Dependências
```bash
bun install
```

### 3. Rodar em Ambiente de Desenvolvimento
```bash
bun run dev
```
Acesse `http://localhost:5173` no navegador.

### 4. Compilar para Produção (Build Web / PWA)
```bash
bun run build
```
Os arquivos otimizados e o Service Worker são gerados no diretório `dist/`.

### 5. Executar como Aplicativo Desktop Windows (Tauri v2)
```bash
bun run tauri dev
```
Para compilar o instalador nativo Windows (`.msi` / `.exe`):
```bash
bun run tauri build
```

---

## 👤 Autor

**Wallace de Paula Soares**
* **GitHub**: [@wallacextreme](https://github.com/wallacextreme)
* **LinkedIn**: [linkedin.com/in/wallacextreme](https://linkedin.com/in/wallacextreme)
* **Portfólio**: [https://wallacextreme.github.io/portfolio/](https://wallacextreme.github.io/portfolio/)
* **E-mail**: [wallacextreme@hotmail.com](mailto:wallacextreme@hotmail.com)

---

## 📄 Licença

Este projeto é distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

---
## ☕ Apoie este Projeto

Se este projeto ou código foi útil para você, considere apoiar o meu trabalho com uma doação espontânea de qualquer valor. Sua contribuição ajuda a manter o desenvolvimento de novas ferramentas e soluções open-source!

<details>
<summary><strong>💠 Clique aqui para exibir os dados do PIX (Doação Voluntária)</strong></summary>

<br>

- **Chave PIX (ALEATORIA):** `91afe4f0-a466-4423-9d9c-d6a0ffea9b3e`
- **Banco:** C6 Bank
- **Titular:** Wallace de Paulo Soares

> *Nota Legal: Contribuição 100% voluntária e espontânea de apoio ao desenvolvedor (Art. 538 do Código Civil).*
</details>
