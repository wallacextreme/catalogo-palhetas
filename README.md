# Catálogo Técnico & Cross-Reference de Palhetas Automotivas

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-2563eb?style=for-the-badge&logo=github&logoColor=white)](https://wallacextreme.github.io/catalogo-palhetas/)
[![Offline-First](https://img.shields.io/badge/Offline--First-PWA-059669?style=for-the-badge&logo=pwa&logoColor=white)](https://wallacextreme.github.io/catalogo-palhetas/)
[![Desktop](https://img.shields.io/badge/Desktop-Tauri_v2-24c8db?style=for-the-badge&logo=tauri&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![Preact](https://img.shields.io/badge/Frontend-Preact-673ab8?style=for-the-badge&logo=preact&logoColor=white)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS_v4-06b6d4?style=for-the-badge&logo=tailwindcss&logoColor=white)](#)
[![Testes Automatizados](https://img.shields.io/badge/Testes-120_Passed-success?style=for-the-badge)](#)
[![Licença](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

Sistema profissional de alta fidelidade para **consulta técnica**, **rastreabilidade oficial** e **equivalência cruzada (cross-reference)** multi-catálogo de palhetas limpadoras de para-brisa automotivas. Consolida em tempo real as bases oficiais de fabricantes homologados: **DYNA (Catálogo 2025)**, **CINOY (Catálogo 2023)** e **VETOR (Catálogo 2025)**.

Desenvolvido com arquitetura **100% Offline-First**, disponível como **PWA Web instalável** e aplicativo **Desktop nativo para Windows** (`.exe` NSIS e `.msi` WiX) via **Tauri v2**.

---

## 🌐 Acesso Online (Demonstração Live)

* **Aplicação em Produção (GitHub Pages)**: [https://wallacextreme.github.io/catalogo-palhetas/](https://wallacextreme.github.io/catalogo-palhetas/)
  * *PWA Homologado*: Funciona totalmente offline após o primeiro carregamento, com banco de dados em cache local.
  * *Alternador de Temas*: Interface industrial com modos Claro (Light) e Escuro (Dark) de alto contraste e legibilidade.

---

## 🚀 Funcionalidades de Balcão de Autopeças

1. **Motor de Busca Híbrido (Fuzzy + Ano Numérico + Medidas + Código)**:
   * **Busca por Ano Intermediário**: Digite `"Gol 2010"`, `"Hilux 2015"` ou `"Onix 2020"` para filtrar matematicamente o intervalo exato (`yearStart <= ano <= yearEnd`) combinado com busca textual e tolerância a erros de digitação.
   * **Busca Direta por Medidas (Polegadas e Milímetros)**: Digite pares dianteiros (`"24/14"`, `"22/16"`), medidas em milímetros (`"600mm"`) ou polegadas individuais (`'24"'`) para listar todos os veículos e palhetas compatíveis.
   * **Cross-Reference Bidirecional $O(1)$**: Pesquise qualquer código (`SD6`, `PV22`, `S550`, `YN-PS2416B`, `VSL45`) e visualize instantaneamente (< 1 ms) os códigos equivalentes das outras marcas (**DYNA**, **CINOY** e **VETOR**) e todos os veículos que utilizam aquela peça.
2. **Detecção de Ano de Transição & Visualizador Esquemático de Conectores**:
   * **Alerta de Ano de Transição (`⚡ Ano de Transição`)**: Identifica automaticamente quando o mesmo veículo/ano possui mudança de geração, medida ou encaixe (ex.: mudança de geração no mesmo ano-modelo), alertando o balconista para confirmar o conector no veículo.
   * **Visualizador de Encaixes (`ConnectorBadge`)**: Ícones esquemáticos em SVG para identificação imediata do tipo de trava (`G` Gancho U-Hook, `TL` Top-Lock, `B` Baioneta, `SL` Side-Lock/Pino Lateral e Específicos), com medidas lado a lado em **Polegadas (`"`)** e **Milímetros (`mm`)**.
3. **Cópia Rápida 1-Clique para WhatsApp / Orçamento**:
   * Botão `📋 Copiar p/ WhatsApp` em cada família, variante ou produto que copia a ficha formatada (Veículo, Ano, Medidas Dianteira LE/LD e Traseira em `"` e `mm`, Tipo de Conector e Códigos Equivalentes DYNA/CINOY/VETOR) com feedback visual instantâneo.
4. **Ergonomia & Atalhos de Teclado para Balconista**:
   * `F2` ou `Ctrl+K` (`Cmd+K`): Foca e seleciona imediatamente a barra de pesquisa de qualquer lugar da tela.
   * `Esc`: Fecha modais abertos ou limpa instantaneamente a busca e todos os filtros ativos.
5. **Persistência Local Privada de Balcão (`CounterStorageService`)**:
   * **Favoritos Fixados (`⭐ Favoritar`)**: Fixe os veículos de maior giro no topo da tela para consulta em 1 clique.
   * **Histórico de Buscas Recentes (`🕒 Recentes`)**: Acesso rápido às últimas pesquisas realizadas no terminal.
   * **Notas Internas por Veículo (`📝 Nota Local`)**: Adicione observações internas do balcão por veículo (ex.: localização de prateleira ou preferência de cliente), salvas **exclusivamente na máquina local** (`localStorage`) sem nunca enviar dados para a nuvem ou Git.
   * **Backup Local (Exportar/Importar JSON)**: Exporte e restaure suas notas e favoritos locais em arquivo `.json`.

---

## 🏗️ Arquitetura & Engenharia do Software

O projeto segue os princípios de **Clean Architecture** e **Domain-Driven Design (DDD)**:

```text
src/
├── domain/                  # Núcleo de domínio desacoplado de frameworks (zero `any`)
│   ├── types.ts             # Modelos estritos TypeScript (Vehicle, BrandProduct, VehicleApplication, etc.)
│   ├── normalize.ts         # Normalização canônica (remoção de acentos, pontuações, compactCode)
│   ├── measures.ts          # Conversão dimensional exata polegadas ↔ mm e validação técnica
│   ├── years.ts             # Parser de anos (formatos 12/21, 2012 -> ..., ranges e sobreposição)
│   ├── manufacturers.ts     # Dicionário de montadoras automotivas e canonização
│   └── consolidation.ts     # Agrupamento determinístico, detecção de transição e consolidação de fichas
├── search/                  # Motor de busca híbrido multi-critério
│   └── search-engine.ts     # MiniSearch + parser de anos/medidas + índice O(1) de cross-reference
├── repositories/            # Camada de persistência intercambiável (Repository Pattern)
│   ├── interfaces.ts        # Contratos abstratos dos repositórios
│   ├── memory/              # Implementação em memória ultrarrápida (InMemoryCatalogDatabase)
│   ├── dexie/               # Armazenamento offline client-side IndexedDB v4 via Dexie.js
│   └── sqlite/              # Schema relacional e migrations para Tauri Desktop
├── services/                # Orquestração da camada de aplicação
│   ├── catalog-service.ts   # Singleton de inicialização, cache e busca com consolidação
│   └── counter-storage.ts   # Persistência local privada (Favoritos, Recentes, Notas e Backup JSON)
└── ui/                      # Camada de apresentação e componentes reativos
    ├── App.tsx              # Componente raiz, atalhos globais de teclado e estado
    └── components/          # Design system industrial com alto contraste
        ├── Header.tsx               # Barra de navegação com métricas dinâmicas e alternador de tema
        ├── SearchBar.tsx            # Campo universal de busca com suporte a F2 / Ctrl+K / Esc
        ├── FiltersBar.tsx           # Filtros combinados (Montadora, Modelo, Posição, Medida, Marca, Relação)
        ├── ConnectorBadge.tsx       # Badge visual com ícone SVG esquemático por família de conector
        ├── VehicleFamilyCard.tsx    # Card consolidado por família com accordion, favoritos, notas e WhatsApp
        ├── CrossReferenceTable.tsx  # Ficha técnica comparativa lado a lado (DYNA x CINOY x VETOR)
        ├── ProductDetailModal.tsx   # Modal de raio-X do produto, equivalentes diretos e veículos compatíveis
        └── TraceabilityModal.tsx    # Modal de auditoria e página oficial do catálogo
```

---

## 🧪 Qualidade de Código, Validação de Schema & Suíte de Testes

### Validador de Integridade do Catálogo (`validate:data`)
Verifica IDs duplicados, referências órfãs, intervalos de anos (`yearStart <= yearEnd`), medidas plausíveis e equivalências entre produtos:
```bash
bun run validate:data
```

### Suíte de Testes Automatizados (`bun test`)
O projeto conta com **120 testes automatizados** e **167.996 asserções** distribuídas em 9 arquivos:
```bash
bun test
```

```text
 120 pass
 0 fail
 167996 expect() calls
Ran 120 tests across 9 files. (~2.9s)
```

---

## 🛡️ Guia de Pontos de Restauração (Git Tags) e Rollback

O repositório mantém tags semânticas auditadas em cada etapa da evolução para rollback imediato caso necessário:

| Tag de Restauração | Descrição da Fase |
| :--- | :--- |
| `restore-point-0-initial` | Estado original auditado antes das evoluções + `AUDIT_REPORT.md` |
| `restore-point-1-data` | Saneamento de tipagem estrita (zero `any`), equivalência `mm` e `validate:data` |
| `restore-point-2-search` | Motor de busca híbrido (ano numérico + medidas `24/14`, `600mm` + Cross-Reference $O(1)$ + transição) |
| `restore-point-3-ui` | UX de balcão, `ConnectorBadge` SVG, alerta de transição, WhatsApp 1-clique e atalhos `F2`/`Ctrl+K`/`Esc` |
| `restore-point-4-storage` | Persistência local privada (`CounterStorageService` — favoritos, buscas recentes, notas e backup JSON) |
| `restore-point-5-final` | Blindagem de privacidade no `.gitignore`, documentação atualizada e release final validada |

Para listar todos os pontos de restauração ou restaurar o projeto para um ponto específico:
```bash
# Listar tags disponíveis
git tag -l

# Fazer rollback seguro para um ponto de restauração específico
git checkout <nome-da-tag>
# Ou resetar a branch atual para a tag desejada:
git reset --hard restore-point-5-final
```

---

## 🚀 Como Executar e Gerar Instaladores Localmente

### Pré-requisitos
* [Bun](https://bun.sh/) (v1.1+)
* [Rust & Cargo](https://rustup.rs/) (necessário apenas para gerar os instaladores Desktop `.exe` e `.msi`)

### 1. Instalar Dependências e Rodar em Desenvolvimento
```bash
bun install
bun run dev
```

### 2. Compilar para Produção (Web / PWA)
```bash
bun run build
```

### 3. Gerar Instaladores Desktop Windows (`.exe` NSIS e `.msi` WiX)
```bash
bun run release
```
Os instaladores oficiais e o arquivo `SHA256SUMS.txt` são gerados em:
* `src-tauri/target/release/bundle/nsis/` (`.exe`)
* `src-tauri/target/release/bundle/msi/` (`.msi`)

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
