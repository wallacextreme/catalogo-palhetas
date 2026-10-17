# Política de Apresentação e Decisão Técnica no Balcão (Display Decision Policy)

**Catálogo Técnico & Cross-Reference de Palhetas Automotivas**  
**Fase 5 — Governança de Dados, Revisão Humana e Decisão no Balcão**  
**Repositório:** `wallacextreme/catalogo-palhetas`

---

## 1. Princípio Fundamental de Interface

> **"Nem todo conflito de catálogo é um problema operacional de balcão."**

A interface do catálogo foi desenhada com base na separação rigorosa entre:
1. **Classificação de Domínio (Diagnóstico Interno / CI):** Mapeamento exaustivo de todas as sobreposições documentais para integridade do dataset.
2. **Apresentação de Balcão (Experiência do Atendente / UX):** Comunicação clara, orientada à decisão do vendedor, sem poluição visual e sem termos técnicos indecifráveis.

O vendedor de autopeças necessita de **orientação prática e segura** para evitar devoluções, não de mensagens internas de debug como `CONFLICT_CLASSIFICATION_SOURCE_CONFLICT P0`.

---

## 2. Matriz de Casos de Apresentação

### Caso 1: Mesma Aplicação Documentada por Fabricantes Distintos (Multi-Catálogo)
* **Cenário de Dados:** Dois ou mais fabricantes recomendam as mesmas polegadas e o mesmo tipo de encaixe para o mesmo período e posição (ex: Hilux 2005–2015 Motorista 21" Gancho em DYNA, CINOY e VETOR).
* **Classificação de Domínio:** `same_application_multicatalog` (Prioridade `P4`).
* **Comportamento da UI:**
  * **Status:** `MULTI_CATALOG_CONFIRMED`.
  * **Apresentação:** Cross-reference pleno e unificado em card único.
  * **Sinalização Visual:** Badge verde de confiança: `✓ Aplicação confirmada em 3 catálogos`.
  * **Códigos:** Exibição dos códigos de produto de cada marca lado a lado (`DYNA: DX21 | CINOY: YN-PS21 | VETOR: PVT21`).
  * **Alerta:** Nenhum alerta de conflito. Informação 100% positiva para o vendedor e cliente.

---

### Caso 2: Diferença Legítima de Carroceria ou Linha (Variante Técnica)
* **Cenário de Dados:** Diferença de dimensões decorrente de configurações de cabine, perua, hatch vs sedan, ou edições documentadas (ex: Hilux 2016+ Passageiro: Padrão 22" vs Cabine 16"; Gol G2 vs Gol Special).
* **Classificação de Domínio:** `technical_variant` (Prioridade `P3`).
* **Comportamento da UI:**
  * **Status:** `TECHNICAL_VARIANT`.
  * **Apresentação:** Divisão limpa em variantes técnicas no accordion da família.
  * **Sinalização Visual:** Badges de identificação de versão: `[Carroceria Cabine]`, `[Série Especial]`, `[Geração Quadrado]`.
  * **Resumo:** Badge informativo `Aplicações distintas por carroceria`.
  * **Alerta:** Não exibir como erro ou divergência, pois trata-se de projeto veicular distinto.

---

### Caso 3: Medida Divergente entre Catálogos no Mesmo Ano/Modelo
* **Cenário de Dados:** Fabricantes concorrentes recomendam polegadas diferentes para a mesma posição e veículo sem indicação de mudança de carroceria (ex: Chevrolet Tracker 2020+ Motorista 24" na DYNA vs 26" na VETOR).
* **Classificação de Domínio:** `source_conflict` (Prioridade `P0` para $\Delta \ge 2"$, `P1` para $\Delta = 1"$).
* **Comportamento da UI:**
  * **Status:** `SOURCE_CONFLICT`.
  * **Apresentação:** Preservar ambas as variantes documentadas sem arbitrar ou forçar média.
  * **Sinalização Visual:** Pílula visual discreta no cabeçalho: `⚠ 1 divergência documental`.
  * **Mensagem de Balcão:**
    ```text
    ⚠ Divergência documental entre catálogos:
    DYNA: 24"
    VETOR: 26"
    Atenção: há duas medidas documentadas para esta aplicação. Confirme a peça instalada ou a marca solicitada antes de concluir a venda.
    ```
  * **Interação:** Expansível sob demanda via clique em `(Ver detalhes)`. Card não se expande compulsoriamente para não assustar o usuário.

---

### Caso 4: Conector Diferente com Mesma Medida (Variante de Encaixe)
* **Cenário de Dados:** Mesma polegada indicada por diferentes fontes, porém com padrão de encaixe divergente (ex: Onix 2019 de transição com Gancho vs Top Lock TL2).
* **Classificação de Domínio:** `connector_variant` (Prioridade `P1`).
* **Comportamento da UI:**
  * **Status:** `CONNECTOR_VARIANT`.
  * **Apresentação:** Apresentação com destaque no campo de encaixe.
  * **Sinalização Visual:** Badge de alerta técnico: `⚠ Variante de Encaixe: Verifique o braço/engate do veículo`.

---

### Caso 5: Divergência Simultânea de Medida E Conector
* **Cenário de Dados:** Divergência dimensional e mecânica simultânea para o mesmo veículo e ano.
* **Classificação de Domínio:** `dimension_and_connector_variant` (Prioridade `P0`).
* **Comportamento da UI:**
  * **Status:** `SOURCE_CONFLICT`.
  * **Apresentação:** Ambas as opções listadas com rastreabilidade explícita aos catálogos de origem.
  * **Mensagem de Balcão:** `⚠ Atenção técnica: medidas e encaixes divergentes entre catálogos. Conferência física obrigatória.`

---

### Caso 6: Erro Material ou Anomalia Tipográfica no PDF Original
* **Cenário de Dados:** Anomalia na diagramação original do fabricante (ex: texto de ano `1015` em vez de `2015`, `19911` em vez de `1991`, marca omitida na tabela).
* **Classificação de Domínio:** `possible_source_error` (Prioridade `P2`).
* **Comportamento da UI:**
  * **Para o Cliente/Atendente:** NÃO exibir jargão técnico alarmista ou dados truncados.
  * **Internamente:** Registro isolado e encaminhado para a fila formal de governança (`docs/DATA_REVIEW_QUEUE.md`).
  * **Dataset:** Permanece verbatim (intacto) até decisão humana comprovada.

---

## 3. Resumo Operacional para o Balcão

| Situação | Apresentação ao Atendente | Ação Recomendada |
| :--- | :--- | :--- |
| **3 marcas recomendam 21"** | `✓ Aplicação confirmada em 3 catálogos` | Venda imediata com qualquer uma das 3 marcas. |
| **Cabine Simples vs Padrão** | `Carroceria Cabine: 16" / Padrão: 22"` | Confirmar com o cliente o tipo de cabine da picape. |
| **Dyna indica 24" e Vetor indica 26"** | `⚠ Divergência documental: DYNA 24" vs VETOR 26"` | Perguntar qual marca o cliente prefere ou checar a palheta instalada. |
| **Gancho vs Trava Lateral** | `⚠ Verifique o conector do braço` | Olhar o encaixe do limpador do veículo no estacionamento/balcão. |
| **Erro evidente no catálogo (ex: 1015)** | Oculto da UI geral / Retido na governança | Consulta técnica documental interna. |
