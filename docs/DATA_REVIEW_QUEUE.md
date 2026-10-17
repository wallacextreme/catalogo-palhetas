# Fila de Revisão Documental de Dados (Data Review Queue) — Fase 5

**Catálogo Técnico & Cross-Reference de Palhetas Automotivas**  
**Repositório:** `wallacextreme/catalogo-palhetas`  
**Data:** Outubro/2026 — Homologação da Fase 5  
**Status do Dataset:** `data/validated/dataset.json` — **100% INTACTO (Zero alterações automáticas)**

> **REGRA DE OURO DE GOVERNANÇA:**  
> A Fila de Revisão Documental é uma camada de governança e auditoria.  
> Ela **NÃO** modifica `data/validated/dataset.json` de forma automatizada ou por inferência de IA.  
> Cada item exige comprovação visual humana no documento físico/PDF original antes de qualquer deliberação.

---

## 1. Esclarecimento Matemático: "13 Possíveis Erros" vs "13 Casos de Revisão Humana"

Na Fase 4, surgiram dúvidas sobre se os *"13 possíveis erros"* e os *"13 casos de revisão humana"* seriam grupos diferentes, parcialmente sobrepostos ou idênticos.

A auditoria matemática da Fase 5 comprova: **SÃO EXATAMENTE OS MESMOS 13 REGISTROS.**

* No motor de conflitos (`src/domain/conflicts.ts`), a função `classifyApplicationPair` atribui simultaneamente:
  * `classification: 'possible_source_error'`
  * `priority: 'P2'`
  * `recommendation: 'Encaminhar para fila de revisão humana documental.'`
* **Auditoria no Dataset:**
  * Pares com classificação `possible_source_error`: **13**
  * Pares com prioridade `P2`: **13**
  * Interseção exata entre os conjuntos: **13 / 13 (100% de coincidência)**
  * Pares ambíguos ou com P2 em outra categoria: **0**

Portanto, no relatório da Fase 4 tratava-se da mesma entidade observada sob duas dimensões: sob a dimensão de *classificação de domínio* (`possible_source_error`) e sob a dimensão de *prioridade operacional* (`P2 - Revisão Humana`).

---

## 2. Tabela Geral da Fila de Homologação Humana

| ID | Status | Prioridade | Família | Veículo | Ano | Posição | Medida | Conector | Fonte A | Fonte B | Página | Problema | Evidência | Ação Recomendada |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| **REV-001** | `OPEN` | P2 | HRV | HRV (Slim Blade) vs Convencional | 2018/2021 | Traseira | 10" vs 10" | Padrão | Cinoy (`src_1pjiir95ped`) | Cinoy (`src_02lxn24e93m`) | 215 / 221 | Marca não informada na tabela; tipos de palheta distintos | `veh_1t815trz2l8` vs `veh_1fsdl99lvdi` | `REVIEW_HUMAN` |
| **REV-002** | `OPEN` | P2 | M6 Coupé | M6 Coupê (BMW) | 2008/2014 vs 2012> | Par Diant. | 18" vs 26" | Padrão | Cinoy (`src_0fp2d29ng35`) | Cinoy (`src_2c6pfphey0i`) | 216 / 217 | Marca omitida; conflito de medida entre linhas Cinoy | `veh_0xinpld39jl` vs `veh_0pfzjfcwntv` | `REVIEW_HUMAN` |
| **REV-003** | `OPEN` | P2 | M6 Coupé | M6 Coupê (BMW) | 2008/2014 vs 2012> | Par Diant. | 19" vs 26" | A vs Padrão | Cinoy (`src_0fp2d29ng35`) | Cinoy (`src_2c6pfphey0i`) | 216 / 217 | Variação dimensional intra-catálogo sem marca | `veh_0xinpld39jl` vs `veh_0pfzjfcwntv` | `REVIEW_HUMAN` |
| **REV-004** | `OPEN` | P2 | Classe | Classe M vs Classe B | 2005/2011 | Par Diant. | 26" vs 26" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Modelos Mercedes agrupados sob família genérica 'classe' | `veh_1bi327ifwaw` vs `veh_2eqiphnqzsu` | `REVIEW_HUMAN` |
| **REV-005** | `OPEN` | P2 | Classe | Classe M vs Classe S | 2005/2011 vs 2000/2013 | Par Diant. | 26" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Modelos distintos fundidos na mesma família por omissão de marca | `veh_1bi327ifwaw` vs `veh_19nffb6chke` | `REVIEW_HUMAN` |
| **REV-006** | `OPEN` | P2 | Classe | Classe M vs Classe B | 2005/2011 vs 2011/2014 | Par Diant. | 26" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Modelos distintos cruzados sob cluster 'classe' | `veh_1bi327ifwaw` vs `veh_0pcj9fheblx` | `REVIEW_HUMAN` |
| **REV-007** | `OPEN` | P2 | Classe | Classe M vs Classe M | 2005/2011 vs 2011> | Par Diant. | 26" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Variação de geração da Classe M documentada | `veh_1bi327ifwaw` vs `veh_043jc2kuq8h` | `REVIEW_HUMAN` |
| **REV-008** | `OPEN` | P2 | Classe | Classe B vs Classe S | 2005/2011 vs 2000/2013 | Par Diant. | 26" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Cruzamento indevido entre Classe B e Classe S | `veh_2eqiphnqzsu` vs `veh_19nffb6chke` | `REVIEW_HUMAN` |
| **REV-009** | `OPEN` | P2 | Classe | Classe B vs Classe B | 2005/2011 vs 2011/2014 | Par Diant. | 26" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Transição geracional da Classe B (W245 vs W246) | `veh_2eqiphnqzsu` vs `veh_0pcj9fheblx` | `REVIEW_HUMAN` |
| **REV-010** | `OPEN` | P2 | Classe | Classe B vs Classe M | 2005/2011 vs 2011> | Par Diant. | 26" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Cruzamento indevido entre Classe B e Classe M | `veh_2eqiphnqzsu` vs `veh_043jc2kuq8h` | `REVIEW_HUMAN` |
| **REV-011** | `OPEN` | P2 | Classe | Classe S vs Classe B | 2000/2013 vs 2011/2014 | Par Diant. | 28" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Cruzamento indevido entre Classe S e Classe B | `veh_19nffb6chke` vs `veh_0pcj9fheblx` | `REVIEW_HUMAN` |
| **REV-012** | `OPEN` | P2 | Classe | Classe S vs Classe M | 2000/2013 vs 2011> | Par Diant. | 28" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Cruzamento indevido entre Classe S e Classe M | `veh_19nffb6chke` vs `veh_043jc2kuq8h` | `REVIEW_HUMAN` |
| **REV-013** | `OPEN` | P2 | Classe | Classe B vs Classe M | 2011/2014 vs 2011> | Par Diant. | 28" vs 28" | Padrão | Cinoy (`src_2a149i40812`) | Cinoy (`src_2a149i40812`) | 218 | Cruzamento indevido entre Classe B e Classe M | `veh_0pcj9fheblx` vs `veh_043jc2kuq8h` | `REVIEW_HUMAN` |

---

## 3. Análise Individual dos 13 Casos de `possible_source_error`

### Caso REV-001: HRV (Slim Blade) vs HRV (Convencional)
* **ID do Conflito:** `conf_veh_1t815trz2l8_veh_1fsdl99lvdi_traseira`
* **Valor Encontrado:** `veh_1t815trz2l8` ("HRV (PALHETA SLIM BLADE)", 2018/2021) vs `veh_1fsdl99lvdi` ("HRV(PALHETACONVENCONAL)", 2015/2021). Ambos com 10" traseira.
* **Valor Esperado NÃO INFERIDO:** Não inferir unificação cega; o catálogo Cinoy publica explicitamente duas linhas de produto comerciais (convencional vs slim).
* **Contexto:** Tabela de palhetas traseiras Cinoy 2024. A coluna de montadora foi omitida na impressão gráfica da p. 215, resultando em `brand: "Não informada"`.
* **PDF / Página / Fonte:** Catálogo Cinoy 2024 (`src_02lxn24e93m`), página 221.
* **Impacto Operacional:** Nulo no balcão (ambas usam palheta traseira de 10").
* **Ação Recomendada:** `REVIEW_HUMAN` — Confirmar se "Slim Blade" e "Convencional" utilizam o mesmo adaptador de braço traseiro.

---

### Casos REV-002 e REV-003: BMW M6 Coupé (Anos Sobrepostos e Medidas 18", 19" vs 26")
* **IDs do Conflito:** `conf_veh_0xinpld39jl_veh_0pfzjfcwntv_par_dianteiro` (dois pares por aplicações múltiplas).
* **Valor Encontrado:** Veículo A: "M6 COUPÊ" 2008/2014 (Par: 18" e 19", Cinoy p. 216) vs Veículo B: "M6 COUPÈ" 2012> (Par: 26", Cinoy p. 217).
* **Valor Esperado NÃO INFERIDO:** Não inferir se a geração mudou em 2012 (série F12/F13) para 26" ou se houve erro tipográfico na linha de 18"/19".
* **Contexto:** O PDF da Cinoy omitiu o logotipo da BMW no topo da tabela da página 216 e 217, gerando veículo sem marca informada.
* **PDF / Página / Fonte:** Catálogo Cinoy 2024 (`src_0fp2d29ng35`, p. 216 e `src_2c6pfphey0i`, p. 217).
* **Impacto Operacional:** Risco alto se vendido sem conferência (diferença de 18"/19" para 26").
* **Ação Recomendada:** `REVIEW_HUMAN` — Conferir tabela BMW oficial para verificar se M6 E63 (V10) usa 18"/19" e M6 F12 (V8 Biturbo) usa 26".

---

### Casos REV-004 a REV-013 (10 Casos): Agrupamento Anômalo "Classe" (Mercedes-Benz)
* **IDs dos Conflitos:** `conf_veh_1bi327ifwaw_veh_2eqiphnqzsu_par_dianteiro` até `conf_veh_0pcj9fheblx_veh_043jc2kuq8h_par_dianteiro`.
* **Valor Encontrado:** Modelos de categorias veiculares completamente distintas da Mercedes-Benz ("CLASSE M", "CLASSE B", "CLASSE S") tiveram sua marca impressa omitida no catálogo Cinoy (pág. 218). O normalizador de texto extraiu a família como `classe`, gerando comparações sobrepostas artificiais entre SUVs (Classe M), minivans (Classe B) e sedans de luxo (Classe S).
* **Valor Esperado NÃO INFERIDO:** Não atribuir a marca `Mercedes-Benz` automaticamente sem validação documental, pois a regra estrita do projeto proíbe inferência artificial.
* **Contexto:** Diagramação condensada do catálogo Cinoy 2024 na seção de palhetas específicas.
* **PDF / Página / Fonte:** Catálogo Cinoy 2024 (`src_2a149i40812`), página 218.
* **Impacto Operacional:** Isolado na auditoria interna de governança; o motor de busca inteligente por modelo específico (`CLASSE B`, `CLASSE M`) não mistura os veículos na UI.
* **Ação Recomendada:** `REVIEW_HUMAN` — Em futuro ciclo de extração (Fase 6), homologar a atribuição documental formal do fabricante `Mercedes-Benz` para essas páginas da Cinoy, desmembrando o cluster genérico `classe`.

---

## 4. Casos Notáveis de Erros Tipográficos Isolados nos PDFs Originais

Além dos 13 pares de sobreposição, os seguintes registros possuem anomalias numéricas literais de impressão nas tabelas dos PDFs:

1. **Toyota Bandeirante / Mitsubishi Pajero (`19911`):**
   * **Valor Encontrado:** `19911/2000` (Mitsubishi Pajero, `veh_04xsg7r5547`) e `19911` (Toyota Bandeirante, Vetor p. 71).
   * **Valor Esperado NÃO INFERIDO:** Provável `1991`, porém não corrigido automaticamente.
   * **Tratamento:** O parser de anos assinala `valid: false` ou `yearStart: null` para impedir faixas temporais corrompidas.
2. **Audi R8 Q7 / Mercedes-Benz Classe C (`1015`):**
   * **Valor Encontrado:** `1015//17-` (`veh_1w8412nr04j`) e `1015` (Vetor p. 57).
   * **Valor Esperado NÃO INFERIDO:** Provável `2015`.
   * **Tratamento:** Mantido no dataset original verbatim para fidelidade com o documento físico.
3. **Ford Maverick (`2026/2024`):**
   * **Valor Encontrado:** `2026/2024` (`veh_151c76nimiv`, Cinoy p. 36).
   * **Valor Esperado NÃO INFERIDO:** Intervalo invertido na impressão gráfica.
   * **Tratamento:** Identificado e retido sem adulteração.
