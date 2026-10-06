# GOVERNANÇA DE DADOS E AUDITORIA

## 1. REGRA DE OURO: FIDELIDADE TOTAL ÀS FONTES

1. **PROIBIDO INVENTAR**: É categoricamente proibido inventar códigos, aplicações, medidas, anos, conexões, fabricantes, linhas ou posições.
2. **TRATAMENTO DE LACUNAS**: Quando um dado não constar na fonte primária, o campo deve ser armazenado como `null` e apresentado na interface como `"Não informado"` ou `"Não confirmado"`.
3. **PRESERVAÇÃO DO TEXTO ORIGINAL**: Todas as medidas, anos e descrições mantêm campos de backup com o valor literal impresso (`yearRaw`, `sourceInches`, `sourceMillimeters`, `connectorRaw`) para efeito de auditoria técnica.

---

## 2. SEGMENTO OBRIGATÓRIO: EXCLUSÃO DE LINHA PESADA

O sistema atende exclusivamente aos segmentos:
- Automóveis de Passeio
- SUVs e Crossovers
- Utilitários Leves (ex.: Strada, Saveiro, Montana, Hilux, Ranger, Fiorino, Spin, Duster)
- Vans Leves de Passageiros

Filtros ativos de exclusão rejeitam sumariamente:
- Caminhões Pesados e Médios
- Ônibus e Micro-ônibus
- Tratores, Colheitadeiras e Pulverizadores
- Escavadeiras, Pás Carregadeiras e Máquinas de Construção

A exclusão é realizada tanto na ingestão de dados brutos quanto na camada de validação e nos repositórios.

---

## 3. RASTREABILIDADE TÉCNICA

Todo produto, aplicação e veículo deve obrigatoriamente referenciar seu `sourceId`, contendo:
- Fabricante da fonte (ex.: DYNA, CINOY, VETOR)
- Nome do catálogo
- Ano do catálogo
- Número exato da página do PDF
- Seção interna do catálogo

A interface do usuário disponibiliza a rastreabilidade direta para cada resultado exibido na consulta técnica.
