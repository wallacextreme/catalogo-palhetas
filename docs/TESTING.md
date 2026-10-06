# ESTRATÉGIA E MATRIZ DE TESTES

## 1. SUÍTE DE TESTES AUTOMATIZADOS

O sistema possui suíte abrangente de testes executada via `bun test`:

### 1.1 Testes Unitários (`tests/unit/`)
- **Normalização e Busca**: Testes com acentuação, maiúsculas/minúsculas, hífens, pontuações e formatos compactos (`YN-PS2416B` vs `ps2416b`).
- **Parsing de Intervalos de Anos**: Validação de faixas abertas ("2019>"), dois dígitos ("10 / 12"), limites plausíveis e sinalização de formatos malformados.
- **Medidas e Conversões**: Validação de milímetros (25,4 mm / polegada) e faixas automotivas plausíveis.
- **Proteção de Linha Pesada**: Garantia de que caminhões, ônibus e máquinas sejam barrados tanto por taxonomia de seção quanto por palavras-chave em strings.
- **Gerador de Identificadores**: Garantia de estabilidade e determinismo das chaves (`cyrb53`).

### 1.2 Testes de Cross-Reference (`tests/unit/cross-ref.test.ts`)
- Distinção rigorosa entre equivalência oficial documentada e compatibilidade dimensional.
- Casos com mesma medida mas conexões incompatíveis.
- Casos de mesmo modelo de veículo em intervalos de ano distintos (ex.: Saveiro G4 vs G5).
- Resolução de produtos a partir do veículo e vice-versa.

### 1.3 Testes de Integração e Repositórios (`tests/integration/`)
- Operações CRUD e consultas nos adaptadores de repositório (Memória, Dexie e SQLite).
- Integridade referencial do dataset (ausência de veículos ou produtos órfãos, validade de `sourceIds`).
