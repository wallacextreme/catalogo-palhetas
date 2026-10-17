# Política de Resolução Assistida de Conflitos Técnicos — Fase 4

## 1. Princípio Fundamental de Integridade

> **REGRA DE OURO:** NUNCA ALTERAR A VERDADE DOCUMENTAL PARA FACILITAR A BUSCA OU CONCILIAÇÃO.
> O catálogo oficial de origem (PDF / tabela do fabricante) é a autoridade técnica. O sistema não deve forçar compatibilidades inexistentes nem apagar divergências reais. A inteligência artificial atua exclusivamente na detecção, auditoria e classificação assistida, **nunca como autoridade substitutiva**.

---

## 2. Matriz de Decisão e Classificação Formal de Registros

A tabela a seguir estabelece o tratamento técnico normativo para cada cenário encontrado no ecossistema de dados:

| Situação Documentada | Classificação Formal | Prioridade | Tratamento no Domínio / UI |
| :--- | :--- | :---: | :--- |
| **Mesmo veículo + mesmo ano + mesma medida + mesmo conector (fontes diferentes)** | `same_application_multicatalog` | **P4** | **Cross-Reference Confirmado:** Unifica na mesma linha de aplicação exibindo badges multi-catálogo (`DYNA \| CINOY \| VETOR`) com códigos de cada fabricante. |
| **Mesmo modelo-base + períodos iguais/sobrepostos + carrocerias distintas (ex: Padrão vs Cabine, Hatch vs Sedan)** | `technical_variant` | **P3** | **Variante Técnica Legítima:** Preservada em blocos independentes dentro do card da família com tag de variante visível (ex: *Cabine*, *Sedan*). |
| **Mesmo veículo + mesmo ano + medida igual + conectores diferentes entre catálogos** | `connector_variant` | **P1** | **Atenção Técnica de Encaixe:** Apresentado no balcão com alerta visual de conector para o operador inspecionar o braço limpador físico do veículo. |
| **Mesmo veículo + mesmo ano + mesma fonte + medidas diferentes documentadas** | `dimension_variant` | **P1 / P0** | **Variante Dimensional de Catálogo:** Preservada como aplicação opcional documentada (ex: linha convencional vs flat blade com tolerância dimensional). |
| **Mesmo veículo + mesmo ano + fontes diferentes discordam na medida (ex: 24" vs 26")** | `source_conflict` | **P0** (se $\Delta \ge 2"$) / **P1** | **Conflito Documental entre Fabricantes:** Exibição lado a lado na UI com identificação explícita de fonte (`DYNA: 24"` vs `VETOR: 26"`). Não escolhe vencedor. |
| **Mesmo veículo + mesmo ano + fontes discordam simultaneamente em medida e conector** | `dimension_and_connector_variant` | **P0** | **Divergência Crítica de Balcão:** Risco máximo de venda errada. Card exibe advertência técnica destacada com detalhamento de cada fonte. |
| **Duplicidade intra-catálogo para indicar especificação comercial (ex: asterisco de silicone)** | `duplicate_commercial_entry` | **P3** | **Duplicidade Comercial Legítima:** Normalizado preservando os códigos de produto complementares vinculados à mesma variante técnica. |
| **Texto de ano impresso com erro gráfico no catálogo (ex: `1015`, `19911`, ano invertido)** | `possible_source_error` | **P2** | **Fila de Revisão Humana:** Registro mantido verbatim no dataset; indexado com flag de suspeita e catalogado em `docs/DATA_REVIEW_QUEUE.md`. |
| **Modelo com derivação comercial ou submodelo (ex: Onix vs Onix Plus, Corolla vs Corolla Cross, HB20 vs HB20S)** | `Família Separada` | — | **Desacoplamento Rigoroso de Busca:** Cada modelo possui sua família canônica isolada. Busca exibe card principal limpo e link contextual *"Modelos relacionados: ... →"*. |
| **Ano ausente ou formato aberto (ex: `2015/...`)** | `Intervalo Aberto` | — | **Não Inferir:** Representado formalmente como `yearStart: 2015, yearEnd: null, yearEndOpen: true`. Nunca chutar data de término. |
| **Produto com código de fabricante sem aplicação veicular direta no dataset** | `Produto de Catálogo Geral` | — | **Produto Órfão Legítimo:** Preservado no catálogo de produtos (pesquisável diretamente por código como universal ou linha pesada/industrial). |

---

## 3. Escala de Prioridades Técnicas de Risco

* **P0 — Crítico (Risco de Aplicação / Venda Incompatível):**
  Divergências simultâneas de medida e conector ou divergências de medida $\ge 2"$ entre catálogos no mesmo veículo e período. Exige conferência física imediata pelo vendedor no balcão.
* **P1 — Alto (Risco de Incompatibilidade de Fixação ou Medida Marginal):**
  Divergências de conector para a mesma medida ou variação de 1" entre fontes.
* **P2 — Médio (Auditoria Documental / Suspeita de Erro Tipográfico):**
  Inconsistências tipográficas de origem nos PDFs originais que necessitam de checagem do documento físico ou homologação humana.
* **P3 — Baixo (Variação Técnica Documentada / Comercial):**
  Variantes legítimas de carroceria/geração ou distinções comerciais do mesmo catálogo.
* **P4 — Informativo (Concordância Técnica Multi-Catálogo):**
  Cross-reference pleno onde dois ou mais fabricantes fornecem a mesma solução milimétrica e de encaixe para o mesmo período.

---

## 4. Hierarquia de Autoridade no Domínio

1. **Catálogo Oficial Impresso do Fabricante (Verdade Documental):** Autoridade primária irredutível.
2. **Regras de Domínio e Normalização Semântica:** Auditoria automatizada, separação de famílias, isolamento de ruídos de motorização e derivação de variantes.
3. **Revisão Humana de Balcão:** Homologação manual registrada em log auditável.
4. **Inteligência Artificial:** Ferramenta assistiva de indexação, clustering e emissão de alertas. **Nunca altera dados sem supervisão.**
