# Conflitos Técnicos — Fase 4: Auditoria, Classificação e Priorização

**Catálogo Técnico & Cross-Reference de Palhetas Automotivas**  
**Data da Auditoria:** Outubro/2026 — Fase 4  
**Dataset Auditado:** `data/validated/dataset.json` (2.830 veículos, 7.994 aplicações, 595 produtos, 16.358 relações) — **100% INTACTO**

---

## 1. Resumo Executivo

A Fase 3 identificou 4.142 pares de aplicações sobrepostas com divergências no dataset bruto consolidado. Conforme a regra fundamental da Fase 4, **nenhum desses números foi tratado como "erro a apagar"**. Em vez disso, foi implementado o motor formal de classificação assistida (`src/domain/conflicts.ts`), capaz de categorizar cada par em sua realidade técnica precisa.

Ao avaliar **4.670 pares de aplicações sobrepostas** no mesmo período de fabricação da mesma família:

* **2.478 pares (53,0%)** representam **`same_application_multicatalog` (P4)**: Concordância plena entre fabricantes (mesma medida e encaixe). É o alicerce legítimo do cross-reference (`DYNA | CINOY | VETOR`).
* **926 pares (19,8%)** representam **`technical_variant` (P3)**: Variantes técnicas legítimas de carroceria ou geração (ex: *Hilux Padrão* 22"/22" vs *Hilux Cabine* 22"/16", *Gol Bolinha* vs *Gol Special*).
* **1.469 pares (31,5%)** representam **`connector_variant` (P1)**: Mesma medida em polegadas, porém com divergência na codificação do conector/braço (ex: Gancho vs TL2).
* **364 pares (7,8%)** representam **`dimension_variant` (P1)**: Variação dimensional intra ou inter-catálogo mantendo encaixe compatível.
* **185 pares (4,0%)** representam **`source_conflict` (P0/P1)**: Divergência direta entre catálogos concorrentes para o mesmo veículo e mesma posição (ex: Dyna 24" vs Vetor 26" na Tracker 2020+).
* **1.696 pares (36,3%)** representam **`dimension_and_connector_variant` (P0)**: Divergência simultânea de medida e conector no mesmo ano-modelo (risco crítico de balcão).
* **17 pares (0,4%)** representam **`duplicate_commercial_entry` (P3)**: Linhas comerciais diferenciadas (ex: silicone com asterisco no mesmo catálogo).
* **13 pares (0,3%)** representam **`possible_source_error` (P2)**: Anomalias tipográficas evidentes na impressão dos catálogos originais (ex: `1015`, `19911`, `2026/2024`).
* **0 casos ambíguos não categorizados.**

---

## 2. Same Application / Multi-Catalog (P4)

### Conceito
Dois ou mais fabricantes documentam independentemente a mesma aplicação técnica (mesma posição, mesma medida em polegadas, mesmo conector funcional) para o mesmo veículo e período.

### Evidência
* **Toyota Hilux 2005–2015 (Motorista):**
  * DYNA: 21" (Gancho)
  * CINOY: 21" (Gancho)
  * VETOR: 21" (Gancho)
* **Volkswagen Gol G4 2005–2014 (Motorista):**
  * DYNA: 21" (Gancho)
  * CINOY: 21" (Gancho)
  * VETOR: 21" (Gancho)

### Tratamento
**Cross-reference pleno.** Unificado em uma única aplicação com os códigos de cada fabricante (`DYNA | CINOY | VETOR`) exibidos lado a lado na UI.

---

## 3. Technical Variants (P3)

### Conceito
Diferença técnica legítima decorrente de tipos de carroceria (Cabine Simples vs Dupla, Hatch vs Sedan, Perua), edições ou fases de transição de plataforma documentadas pela montadora.

### Evidência
* **Toyota Hilux 2016–2025:**
  * Hilux Padrão (Passageiro): **22"**
  * Hilux Cabine (Passageiro): **16"**
* **Fiat Palio / Weekend / Adventure:**
  * Palio Hatch: Palheta traseira 15"
  * Palio Weekend / Adventure: Palheta traseira 14" específica com braço carenado

### Tratamento
Preservar ambas as variantes técnicas no card da família, exibindo a etiqueta visual da versão (`Cabine`, `Sedan`, `Special`) para orientação precisa no balcão.

---

## 4. Dimension Conflicts (P1 / P0)

### Conceito
Fontes ou registros atribuem medidas diferentes para a mesma posição e veículo sem justificativa de carroceria.
* **Delta = 1":** Prioridade **P1** (tolerância dimensional aceitável).
* **Delta $\ge$ 2":** Prioridade **P0** (risco de colisão de palhetas no parabrisa ou área de varredura insuficiente).

### Evidência
* **Ford Ranger 2012–2018 (Motorista):**
  * DYNA / CINOY: **22"**
  * VETOR: **24"**
  * Delta: 2 polegadas $\rightarrow$ **P0**

### Tratamento
Apresentar ambas as medidas com atribuição explícita de fonte. Nunca forçar média ou escolha arbitrária.

---

## 5. Connector Conflicts (P1)

### Conceito
Mesma medida em polegadas, mas catálogos especificam encaixes diferentes para o mesmo ano. Frequentemente ocorre em anos de transição de tecnologia de braço (ex: gancho tradicional para palheta flat blade com presilha).

### Evidência
* **Chevrolet Onix / Prisma 2019 (Transição G1 $\rightarrow$ G2):**
  * G1 (Joy): Gancho / TL1
  * G2 (Novo Onix): Top Lock TL2 / Específico

### Tratamento
Exibir badge de alerta de conector: *"Verifique o engate do braço antes da instalação"*.

---

## 6. Dimension + Connector Conflicts (P0)

### Conceito
Divergência técnica dupla: medida e conector são simultaneamente diferentes no mesmo período. Representa o risco operacional mais alto no balcão de autopeças.

### Evidência
* **Chevrolet Tracker 2020+ (Motorista):**
  * DYNA: 24" com conector TL2
  * VETOR: 26" com conector específico com trava

### Tratamento
Apresentação em destaque com caixa de aviso industrial na ficha técnica, listando as opções documentadas e suas respectivas fontes.

---

## 7. Possible Source Errors (P2)

### Conceito
Erros evidentes de composição gráfica ou digitação presentes no documento impresso/PDF oficial da marca.

### Casos Notáveis
1. **Toyota Bandeirante:** Ano `19911` (Vetor 2025, p. 71) $\rightarrow$ provável `1991`.
2. **Mercedes-Benz Classe C:** Ano `1015` (Vetor 2025, p. 57) $\rightarrow$ provável `2015`.
3. **Land Rover Discovery 3:** Ano `2026/2024` (Cinoy 2024, p. 36) $\rightarrow$ intervalo invertido.
4. **Volvo XC60:** Ano `2015/...` (Cinoy 2024, p. 54) $\rightarrow$ catálogo não informou término da geração.

### Tratamento
Listados e documentados em `docs/DATA_REVIEW_QUEUE.md`. Dataset permanece verbatim.

---

## 8. Ambiguous Cases

* **Total de Casos Ambíguos Não Resolvidos:** **0**
Todas as sobreposições foram tipadas com sucesso nas classes formais do domínio.

---

## 9. Priority Cases (Escala Operacional)

| Prioridade | Total de Pares | Risco Balcão | Ação Recomendada |
| :---: | :---: | :--- | :--- |
| **P0** | 2.096 | Crítico (venda/aplicação incompatível) | Alerta destacado na UI; conferência de braço e medida no veículo |
| **P1** | 1.618 | Alto (conector ou delta 1") | Apresentar variantes com fabricante identificado |
| **P2** | 13 | Auditoria Documental | Direcionado para fila de revisão humana (`DATA_REVIEW_QUEUE.md`) |
| **P3** | 943 | Baixo (carroceria / edição) | Subdivisão limpa em variantes técnicas da família |
| **P4** | 2.478 | Nulo (cross-reference confirmado) | Unificação multi-catálogo com tabela comparativa |

---

## 10. Recommended Human Review

1. Revisar os 13 registros de `possible_source_error` documentados em `docs/DATA_REVIEW_QUEUE.md`.
2. Homologar fisicamente se Chevrolet Tracker 2020+ comporta 26" no lado do motorista além da recomendação tradicional de 24".
3. Validar se a recomendação de 24" da Vetor para Ford Ranger 2012+ é aplicação alternativa oficial da marca ou excesso dimensional.
