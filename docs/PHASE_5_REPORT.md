# Relatório Técnico — Fase 5: Governança de Dados, Revisão Humana e Decisão Técnica no Balcão

**Projeto:** Catálogo Técnico & Cross-Reference de Palhetas Automotivas  
**Data:** 07 de Outubro de 2026  
**Status:** CONCLUÍDA COM SUCESSO  

---

## 1. Reconciliação Matemática das Métricas da Fase 4

### O Problema Identificado
O relatório executivo da Fase 4 indicava `4.670 pares avaliados`, porém o resumo descritivo citava apenas 5 linhas somando `3.615`:
* 2.478 legítimos (`same_application_multicatalog`)
* 926 variantes técnicas (`technical_variant`)
* 185 conflitos documentais (`source_conflict`)
* 13 possíveis erros (`possible_source_error`)
* 13 revisão humana (mesmo subconjunto dos 13 possíveis erros)

A auditoria matemática identificou com precisão a causa raiz da discrepância:
1. **Omissão de categorias no sumário textual:** O sumário anterior omitiu 4 categorias de variantes legítimas:
   * `dimension_and_connector_variant`: 1.696 pares
   * `connector_variant`: 1.469 pares
   * `dimension_variant`: 364 pares
   * `duplicate_commercial_entry`: 17 pares
   Essas categorias somavam exatamente **3.546 pares adicionais** que pertenciam ao motor de auditoria.
2. **Definição de `totalPairs` em `auditDatasetConflicts`:** A função retornava `totalPairs: records.length` (4.670), pois os pares multi-catálogo (`same_application_multicatalog` = 2.478) eram contabilizados em contadores separados e não eram incluídos no array `records`.
   O verdadeiro total de pares avaliados era $4.670 + 2.478 = 7.148$.
3. **Evolução do dataset após isolamento de submodelos na Fase 4:** Ao separar formalmente submodelos como `ONIX PLUS` e `COROLLA CROSS` em famílias próprias (como documentado na Fase 4), 9 pares de aplicações cruzadas entre Onix/Onix Plus e Corolla/Corolla Cross deixaram de gerar pares intra-família espúrios. Assim, o total de pares avaliados passou de 7.148 para exatamente **7.139**.

### Fórmula de Reconciliação e Garantia Matemática
Definiu-se a métrica formal:
$$\text{classifiedPairs} + \text{unclassifiedPairs} = \text{totalPairs}$$

No dataset atual:
* **Total de pares avaliados (`totalPairs`):** 7.139
* **Pares classificados (`classifiedPairs`):** 7.139
* **Pares não classificados (`unclassifiedPairs`):** 0
* **Multi-catálogo confirmado (`same_application_multicatalog`):** 2.477
* **Registros de conflito/variante armazenados (`conflictRecordsCount`):** 4.662
  $$4.662 + 2.477 = 7.139 \quad (100\% \text{ reconciliado})$$

### Decomposição Exaustiva dos 7.139 Pares
1. `same_application_multicatalog`: **2.477** (P4 - Ação: `MERGE_AS_CROSS_REFERENCE`)
2. `dimension_and_connector_variant`: **1.696** (P3 - Ação: `KEEP_SEPARATE`)
3. `connector_variant`: **1.469** (P3 - Ação: `KEEP_SEPARATE`)
4. `technical_variant`: **926** (P3 - Ação: `KEEP_SEPARATE`)
5. `dimension_variant`: **364** (P3 - Ação: `KEEP_SEPARATE`)
6. `source_conflict`: **177** (P1 - Ação: `DISPLAY_WARNING`)
7. `duplicate_commercial_entry`: **17** (P4 - Ação: `MERGE_AS_CROSS_REFERENCE`)
8. `possible_source_error`: **13** (P2 - Ação: `REVIEW_HUMAN` / `REVIEW_SOURCE`)

$$\sum = 2.477 + 1.696 + 1.469 + 926 + 364 + 177 + 17 + 13 = 7.139$$

---

## 2. Esclarecimento: 13 Possíveis Erros vs 13 Revisão Humana

A auditoria matemática e de código comprovou:
* **Os 13 possíveis erros e os 13 casos de revisão humana são rigorosamente o MESMO subconjunto de 13 pares.**
* No domínio (`conflicts.ts`), a classificação `possible_source_error` atribui univocamente a prioridade `P2` e a ação recomendada `REVIEW_HUMAN` / `REVIEW_SOURCE`.
* Origem física: 13 pares extraídos do Catálogo Cinoy (páginas 215, 216, 217, 218, 221) onde a coluna de montadora foi omitida na diagramação do PDF (`v.brand === 'Não informada'`), gerando agrupamentos intra-família em `hrv` (1 par), `m6 coupe` (2 pares) e `classe` (10 pares entre Classe M, B, S).
* Erros pontuais de digitação de ano em registros isolados (ex: `19911` na Pajero/Bandeirante, `1015` no Audi R8/Q7/Classe C, `2026/2024` na Maverick) não geram pares pois possuem `yearStart: null`, permanecendo como anomalias registradas na fila de revisão humana.

---

## 3. Arquitetura de Domínio e Governança

### Novas Estruturas Criadas em `src/domain/governance.ts`
1. **`TechnicalStatus`:**
   * `DOCUMENTED`: Aplicação documentada em catálogo único sem conflito.
   * `MULTI_CATALOG_CONFIRMED`: Aplicação confirmada em 2 ou mais catálogos independentes (mesma medida e conector).
   * `TECHNICAL_VARIANT`: Variante legítima de motorização, versão ou carroceria.
   * `CONNECTOR_VARIANT`: Mesma medida com braço/conector diferente.
   * `SOURCE_CONFLICT`: Divergência documental de medidas no mesmo período.
   * `SOURCE_REVIEW`: Registro com anomalia de catálogo encaminhado para auditoria humana.

2. **`RecommendedAction` (em `src/domain/conflicts.ts`):**
   * `KEEP_SEPARATE`
   * `MERGE_AS_CROSS_REFERENCE`
   * `DISPLAY_WARNING`
   * `REVIEW_SOURCE`
   * `REVIEW_HUMAN`
   * `IGNORE_LEGITIMATE_DIFFERENCE`

3. **`ConflictRecord` Estruturado:**
   * Campos: `id`, `family`, `vehicleA`, `vehicleB`, `applicationA`, `applicationB`, `classification`, `priority`, `dimensions`, `connectors`, `years`, `sourceA`, `sourceB`, `explanation`, `recommendedAction`.

4. **`TechnicalConfidenceMatrix` e Avaliação Leve por Família:**
   * Avaliação em tempo de consolidação ($O(1)$ por família) que alimenta `family.governance` sem impacto na busca.
   * Preserva a auditoria pesada (`auditDatasetConflicts`) restrita ao pipeline de CI/testes.

---

## 4. Política de Apresentação e UX de Balcão

Criado o documento normativo `docs/DISPLAY_DECISION_POLICY.md` e integradas regras claras no componente `src/ui/components/VehicleFamilyCard.tsx`:

1. **Separação entre Conflito Interno e Alarme Visual:**
   * Conflitos de código interno não disparam alarmes vermelhos que assustem o atendente.
   * O usuário recebe informação orientativa, não códigos de erro.
2. **Badges Positivos e Informativos no Header da Família:**
   * `✓ X catálogos confirmados`: Quando há confirmação em múltiplos fabricantes.
   * `Aplicações distintas por carroceria`: Quando a família possui variantes cabine/hatch/sedan.
   * `⚠ X divergência documental`: Badge de aviso não-bloqueante quando há catálogos discordantes.
3. **Painel Retrátil de Divergência Documental:**
   * Por padrão, cards permanecem limpos e compactos.
   * Ao clicar no badge de aviso, expande painel contextual explicando claramente as medidas documentadas por cada catálogo (ex: Dyna 24" vs Vetor 26" no Tracker) e instruindo o vendedor:
     > *"Atenção: há duas medidas documentadas para esta aplicação. Confirme o catálogo ou a peça física instalada antes de concluir a venda."*
4. **Destaque Individual de Aplicação Confirmada:**
   * Selo verde `✓ Aplicação confirmada em X catálogos` no bloco da palheta dianteira ou traseira.

---

## 5. Fila Estruturada de Revisão Humana e Decisões

* **`docs/DATA_REVIEW_QUEUE.md`:** Estrutura tabular formal com colunas `ID`, `Status` (`OPEN`, `IN_REVIEW`, `CONFIRMED`, `RESOLVED`, `REJECTED`), `Prioridade`, `Família`, `Veículo`, `Ano`, `Posição`, `Medida`, `Conector`, `Fonte A`, `Fonte B`, `Página`, `Problema`, `Evidência`, `Ação Recomendada`.
* **Análise Individual dos 13 Casos:** Mapeamento exaustivo com valor encontrado, valor esperado (não inferido), contexto, PDF, página e impacto.
* **`docs/REVIEW_DECISIONS.json`:** Registro histórico estruturado das decisões tomadas para impedir alterações obscuras sem rastreabilidade.
* **Integridade do Dataset:** `data/validated/dataset.json` permaneceu rigorosamente **inalterado** (`git diff` vazio).

---

## 6. Testes e Validação Automatizada

* **Total de Testes:** **91 testes passando** (0 falhas) com **167.730 asserções**.
* **Suíte de Governança:** `tests/unit/governance.test.ts` (7 testes específicos validando status técnico, matriz de confiança e comportamentos de balcão).
* **Suíte de Conflitos e Reconciliação:** `tests/unit/conflicts.test.ts` (validando $classified + unclassified = total = 7.139$).
* **Suíte de Isolamento e Busca:** `tests/unit/search.test.ts` (validando isolamento perfeito de 13 modelos: Onix, Onix Plus, Corolla, Corolla Cross, Corolla Fielder, HB20, HB20S, Hilux, SW4, Gol, Golf, Ka, Kadett).
* **Suíte de Casos de Balcão:** `tests/integration/governance-ui-cases.test.ts` (7 testes ponta-a-ponta cobrindo Tracker, Hilux, Corolla, etc.).
* **Typecheck (`tsc --noEmit`):** 0 erros.
* **Build de Produção (`vite build`):** Sucesso absoluto (PWA bundle gerado em `dist/`).
* **Performance de Busca:** Consultas fundamentais executadas em tempo médio inferior a 5ms (muito abaixo do teto de 50ms).
