# Melhorias Futuras e Backlog Técnico (Pós-Release)

Este documento registra melhorias de evolução identificadas durante a **Fase 6 — QA End-to-End e Hardening de Produção**. Conforme as diretrizes de governança, nenhuma dessas melhorias bloqueia o release atual (todas classificadas como **P3**).

---

## 1. Experiência de Balcão e PDV (P3)
* **Impressão Térmica Direta (Cupom Não-Fiscal / Orçamento de Balcão):**
  * Gerar layout pré-formatado de 58mm/80mm para envio direto a impressoras térmicas de balcão (Epson, Bematech, Daruma) com os códigos de palhetas recomendados.
* **Leitor de Código de Barras via Câmera no Mobile (PWA):**
  * Integração com a Barcode Detection API (ou biblioteca leve WASM) para permitir que o atendente aponte a câmera do celular para a embalagem física da palheta (EAN-13) e o catálogo abra instantaneamente a ficha de compatibilidade veicular.

## 2. Desktop Nativo e Tauri (P3)
* **Persistência Relacional Nativa com SQLite em Tauri:**
  * Embora o aplicativo web e PWA usem Dexie.js (IndexedDB) com excelência, o ambiente desktop Tauri v2 pode utilizar diretamente o plugin `@tauri-apps/plugin-sql` para consultas relacionais em arquivo `.sqlite` local, reduzindo ainda mais o footprint de memória RAM.
* **Atalhos Globais de Sistema (Hotkey F9/F10):**
  * Permitir que o aplicativo desktop seja minimizado para a bandeja do sistema (system tray) e abra instantaneamente ao pressionar um atalho global configurável (ex: `Ctrl + Shift + P`).

## 3. Gestão e Governança de Catálogos (P3)
* **Interface Visual para Decisão da Fila de Revisão Humana:**
  * No momento, a fila de revisão (`docs/DATA_REVIEW_QUEUE.md`) e os registros de auditoria (`docs/REVIEW_DECISIONS.json`) são mantidos em arquivos estruturados. Um dashboard administrativo restrito (com autenticação local) poderia permitir que o auditor aprove ou rejeite divergências com clique e gere automaticamente os logs de decisão.
* **Importador Incremental com Diff Visual:**
  * Facilitar a ingestão de novas edições de catálogos (ex: DYNA 2026 ou VETOR 2026) exibindo um relatório visual de novos veículos, códigos descontinuados e medidas alteradas antes de atualizar a base.

## 4. Performance e Otimização Avançada (P3)
* **Virtualização de Lista para Mais de 100 Cards Simultâneos:**
  * Atualmente a paginação por blocos de 15/35 veículos garante renderização rápida (< 10ms). Para cenários de listagem contínua sem paginação, a adoção de `@tanstack/virtual` ou similar pode ser avaliada se o catálogo for expandido para mais de 10.000 veículos.
