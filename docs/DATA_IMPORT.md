# PIPELINE DE IMPORTAÇÃO E PROCESSAMENTO DE DADOS

## 1. FLUXO DO PIPELINE

```text
PDF Original (Dyna 2025, CINOY 2023, Vetor 2025)
                     ↓
[Etapa 1: scripts/extract/extract_pdf.py] (PyMuPDF)
                     ↓
JSON Bruto com Coordenadas e Blocos (data/raw/*.raw.json)
                     ↓
[Etapa 2: scripts/pipeline/parsers/*.ts] (Parsers Tipados TypeScript)
                     ↓
Dados Normalizados Intermediários (data/normalized/*.json)
                     ↓
[Etapa 3: scripts/pipeline/validator.ts] (Validação de Integridade e Linha Pesada)
                     ↓
Dataset Oficial Unificado e Auditado (data/validated/dataset.json)
                     ↓
Bancos de Dados Locais (SQLite Desktop / IndexedDB Web)
```

---

## 2. ESPECIFICIDADES POR FABRICANTE

### DYNA (Catálogo 2025 - 40 Páginas)
- **Páginas 4 a 31**: Tabela de Linha Leve: Automóveis e Utilitários. Colunas organizadas por Posição, Sistema de Conexão, Convencional, DX, Slim Blade (Motorista/Passageiro), Híbrida e Traseira.
- **Páginas 31 a 36**: Linha Pesada (Caminhões, Ônibus, Máquinas Agrícolas) - **EXCLUÍDAS NA INGESTÃO**.
- **Página 36**: Nomenclatura e especificações técnicas de conectores (G, DTL, B, SL1, TL1, TL2, TL5, TL7).
- **Páginas 37 a 39**: Catálogo mestre de produtos com código, aplicação (D, T), milímetros, polegadas, tipo de embalagem e resumo de veículos atendidos.

### CINOY (Catálogo de Acessórios 2023 - 319 Páginas)
- **Páginas 65 a 98**: Palhetas Dianteiras Específicas (pares específicos por montadora, medidas individuais e tipo de encaixe).
- **Páginas 99 a 140**: Palhetas Traseiras Específicas.
- **Páginas 141 a 160**: Palhetas de Silicone.
- **Páginas 161 a 166**: Palhetas Traseiras com Braço.
- **Páginas 167 a 176**: Palhetas de Caminhão - **EXCLUÍDAS NA INGESTÃO**.
- **Páginas 177 a 198**: Palhetas de Ferro.
- **Páginas 199 a 212**: Palhetas Híbridas.
- **Páginas 213 a 218**: Palhetas Dianteiras Multiencaixe (14" a 28").
- **Páginas 219 a 224**: Palhetas Traseiras Multiencaixe.
- **Páginas 225 a 227**: Palhetas Traseiras Carenada.

### VETOR (Catálogo de Palhetas 2025 - 68 Páginas)
- **Páginas 6 a 26**: Aplicação em Automóvel (Top Line, Flex, MultiFix, Dianteira e Traseira).
- **Páginas 27 a 32**: Utilitários Leves e Vans Leves.
- **Páginas 33 a 46**: Linha Pesada, Agrícola, Ônibus e Caminhões - **EXCLUÍDAS NA INGESTÃO**.
- **Páginas 48 a 60**: Eletrobombas - **FORA DO ESCOPO DE PALHETAS**.
- **Páginas 61 a 63**: Nomenclatura e catálogo visual de conectores (Conexões 01 a 38, B, G, GL, P01, P02).
