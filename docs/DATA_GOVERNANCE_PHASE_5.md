# Data Governance — Fase 5: Governança de Dados, Revisão Humana e Decisão no Balcão

**Catálogo Técnico & Cross-Reference de Palhetas Automotivas**  
**Repositório:** `wallacextreme/catalogo-palhetas`  
**Data:** Outubro/2026 — Homologação da Fase 5  
**Status do Dataset:** `data/validated/dataset.json` — **100% INTACTO (Zero alterações / Zero deleções)**

---

## 1. Objetivo

Estabelecer uma governança técnica de alta precisão que transforme o catálogo de palhetas em um sistema seguro, auditável e prático para o operador de balcão.

O motor evoluiu do fluxo anterior:
```text
DETECTAR → CLASSIFICAR → ISOLAR
```
para o fluxo de governança completa da Fase 5:
```text
DETECTAR → CLASSIFICAR → PRIORIZAR → EXPLICAR → DECIDIR COMO EXIBIR
```

---

## 2. Princípios de Governança

1. **Fidelidade Documental Estrita:** O dado oficial impresso em catálogo de fabricante é autoridade primária. Nenhuma inferência artificial altera o dataset sem comprovação visual/física.
2. **Separação entre Domínio e Apresentação (UI):** Conflitos internos e diagnósticos estatísticos de CI não devem poluir a experiência do atendente. A interface deve comunicar decisões claras.
3. **Imutabilidade do Dataset Validado:** A fila de revisão humana (`docs/DATA_REVIEW_QUEUE.md`) e os registros de auditoria registram ocorrências, mas **não modificam diretamente** `data/validated/dataset.json`. Somente ciclos formais de release com comprovação documental podem gerar futuras revisões.
4. **Rastreabilidade Bidirecional:** Qualquer indicação técnica na tela pode ser rastreada até o fabricante, ano do catálogo e número da página original.
5. **Reconciliação Matemática Absoluta:** Toda contagem estatística deve fechar rigorosamente: `classifiedPairs + unclassifiedPairs = totalPairs`.

---

## 3. Classificações Formais de Domínio

O motor categoriza pares sobrepostos de aplicações em 9 classificações formais:

| Classificação | Descrição Técnica | Exemplo |
| :--- | :--- | :--- |
| `same_application_multicatalog` | Mesma medida e conector funcional em fontes concorrentes. | Hilux 2005–2015 Motorista 21" Gancho em Dyna, Cinoy e Vetor. |
| `technical_variant` | Variante técnica legítima decorrente de carroceria, geração ou edição. | Hilux Padrão (22") vs Hilux Cabine (16"); Gol Special. |
| `connector_variant` | Mesma medida em polegadas, porém conexões de braço distintas. | Gancho tradicional vs presilha Top Lock TL2. |
| `dimension_variant` | Variação dimensional de palheta dentro do mesmo catálogo. | Ranger com recomendação de 22" e 24" no mesmo catálogo. |
| `dimension_and_connector_variant` | Divergência simultânea de polegadas e tipo de engate. | Tracker 2020+ (24" TL2 vs 26" Específico). |
| `source_conflict` | Divergência direta entre catálogos concorrentes para o mesmo veículo. | Dyna indicando 24" e Vetor indicando 26". |
| `duplicate_commercial_entry` | Entradas comerciais redundantes com códigos distintos (ex: silicone). | Entrada com asterisco no mesmo catálogo. |
| `possible_source_error` | Erro material evidente de impressão no PDF da fonte (ex: ano `1015`, `19911`). | Tipografia de diagramação do catálogo. |
| `ambiguous` | Casos não solucionáveis por falta de dados cadastrais. | Zero casos no dataset auditado. |

---

## 4. Prioridades de Risco Operacional

* **P0 (Crítico — Risco de Incompatibilidade de Balcão):** Divergência simultânea de medida e conector ou $\Delta \ge 2"$. Risco de palheta colidir no parabrisa ou não encaixar no braço.
* **P1 (Alto — Incompatibilidade de Conector ou $\Delta = 1"$):** Variações de engate ou tolerâncias dimensionais leves.
* **P2 (Médio — Auditoria Documental de Fonte):** Anomalias tipográficas no PDF original (`possible_source_error`).
* **P3 (Baixo — Variante Técnica Legítima):** Diferenciação de carroceria documentada pela montadora.
* **P4 (Informativo — Concordância Técnica Multi-Catálogo):** Cross-reference confirmado com risco nulo.

---

## 5. Políticas de Decisão e Ações Recomendadas (`recommendedAction`)

Cada conflito de domínio é mapeado para uma ação institucional pré-definida:

```ts
export type RecommendedAction =
  | 'KEEP_SEPARATE'                   // Manter variantes separadas (carrocerias, ciclos)
  | 'MERGE_AS_CROSS_REFERENCE'        // Unificar em cross-reference multi-catálogo
  | 'DISPLAY_WARNING'                 // Exibir aviso técnico transparente de balcão
  | 'REVIEW_SOURCE'                   // Analisar documentação da fonte
  | 'REVIEW_HUMAN'                    // Encaminhar para fila de homologação humana
  | 'IGNORE_LEGITIMATE_DIFFERENCE';   // Diferença comercial/cosmética sem impacto
```

### Mapeamento:
* `same_application_multicatalog` $\rightarrow$ `MERGE_AS_CROSS_REFERENCE`
* `technical_variant` $\rightarrow$ `KEEP_SEPARATE`
* `connector_variant` $\rightarrow$ `DISPLAY_WARNING`
* `dimension_variant` $\rightarrow$ `KEEP_SEPARATE` (ou `DISPLAY_WARNING` se $\Delta \ge 2"$)
* `dimension_and_connector_variant` $\rightarrow$ `DISPLAY_WARNING`
* `source_conflict` $\rightarrow$ `DISPLAY_WARNING`
* `possible_source_error` $\rightarrow$ `REVIEW_HUMAN`
* `duplicate_commercial_entry` $\rightarrow$ `IGNORE_LEGITIMATE_DIFFERENCE`
* `ambiguous` $\rightarrow$ `REVIEW_SOURCE`

---

## 6. Política de Apresentação (UI de Balcão)

Conforme documentado em [`docs/DISPLAY_DECISION_POLICY.md`](file:///c:/Users/Usu/Documents/SISTEMA%20PALHETAS%20AUTOMOTIVAS/docs/DISPLAY_DECISION_POLICY.md):
* **Multi-catálogo confirmado:** Badge `✓ Aplicação confirmada em X catálogos`.
* **Variantes de carroceria:** Badge de versão `[Carroceria Cabine]` e resumo `Aplicações distintas por carroceria`.
* **Divergências documentais reais:** Pílula no cabeçalho `⚠ X divergência documental` com botão expansível sob demanda para ver os detalhes, sem abrir o card de forma compulsória.

---

## 7. Revisão Humana e Histórico de Decisões

### Fila Formal de Homologação
A fila [`docs/DATA_REVIEW_QUEUE.md`](file:///c:/Users/Usu/Documents/SISTEMA%20PALHETAS%20AUTOMOTIVAS/docs/DATA_REVIEW_QUEUE.md) estabelece os 5 status formais de ciclo de vida:
* `OPEN`: Aberto para investigação técnica.
* `IN_REVIEW`: Em conferência física contra o catálogo PDF original.
* `CONFIRMED`: Anomalia confirmada no documento impresso oficial.
* `RESOLVED`: Homologação documental registrada.
* `REJECTED`: Falso positivo descartado.

### Histórico Estruturado (`ReviewDecision`)
As decisões humanas são registradas de forma persistente em [`docs/REVIEW_DECISIONS.json`](file:///c:/Users/Usu/Documents/SISTEMA%20PALHETAS%20AUTOMOTIVAS/docs/REVIEW_DECISIONS.json):
```json
{
  "issueId": "REV-001",
  "decision": "CONFIRMED_SOURCE_ERROR",
  "reason": "Impressão original do catálogo Vetor p. 71 contém erro tipográfico '19911'.",
  "source": "Vetor 2025",
  "page": 71,
  "timestamp": "2026-10-07T09:00:00Z"
}
```

---

## 8. Integridade do Dataset

* **Arquivo:** `data/validated/dataset.json`
* **Status:** Inalterado (verbatim).
* **Hash / Diff:** `git diff -- data/validated/dataset.json` é rigorosamente **vazio**.

---

## 9. Métricas Matemáticas Reconciliadas da Fase 5

Auditoria completa do motor de governança:

```text
Total de pares avaliados:      7.139
Pares classificados:           7.139
Pares não classificados:           0
------------------------------------
Classificados + Não Classificados = 7.139 (100,0% reconciliado)
```

### Distribuição Detalhada:
* `same_application_multicatalog` (P4): **2.477 pares** (34,70%)
* `dimension_and_connector_variant` (P0): **1.692 pares** (23,70%)
* `connector_variant` (P1): **1.466 pares** (20,53%)
* `technical_variant` (P3): **926 pares** (12,97%)
* `dimension_variant` (P1): **363 pares** (5,09%)
* `source_conflict` (P0/P1): **185 pares** (2,59%)
* `duplicate_commercial_entry` (P3): **17 pares** (0,24%)
* `possible_source_error` (P2): **13 pares** (0,18%)
* `ambiguous`: **0 pares** (0,00%)

### Totalização:
$$2.477 + 1.692 + 1.466 + 926 + 363 + 185 + 17 + 13 + 0 = 7.139$$

```text
Pares multi-catálogo puros (P4):      2.477
Registros de conflito/variante:        4.662
--------------------------------------------
Total de pares auditados:              7.139
```
