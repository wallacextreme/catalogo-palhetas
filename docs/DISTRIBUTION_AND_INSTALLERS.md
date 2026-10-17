# Guia de Distribuição, PWA e Instaladores (.msi e .exe)

**Projeto:** Catálogo Técnico & Cross-Reference de Palhetas Automotivas  
**Versão:** 0.1.0  
**Ambiente:** Web / PWA Offline-First + Desktop Nativo Windows (Tauri v2)  

---

## 1. Visão Geral dos Pacotes de Distribuição

O sistema foi preparado para ser distribuído através de 3 formatos complementares:

| Formato | Tipo de Pacote | Destino / Caso de Uso | Mecanismo |
| :--- | :--- | :--- | :--- |
| **PWA Web** | Pasta `dist/` | Hospedagem em nuvem, GitHub Pages, servidor interno ou intranet. Funciona 100% offline no Chrome, Edge, Safari e celulares Android/iOS. | Vite + Workbox Service Worker |
| **Instalador .exe** | Setup Executável | Instalação padrão para atendentes de balcão e vendedores de autopeças no Windows. Cria atalho no Menu Iniciar e Desktop. | Tauri v2 + NSIS |
| **Instalador .msi** | Pacote Windows Installer | Distribuição corporativa em massa (GPO, Active Directory, Microsoft Intune, SCCM) em redes de lojas de autopeças. | Tauri v2 + WiX Toolset |

---

## 2. Scripts Disponíveis para Geração dos Pacotes

### 2.1 Pelo PowerShell (Recomendado no Windows)
O script `build-installers.ps1` automatiza a validação, pré-requisitos, compilação e gera o relatório com tamanhos e hashes SHA-256:

```powershell
# Gera tudo (PWA Web + .exe + .msi)
.\build-installers.ps1 -Target all

# Gera exclusivamente o pacote PWA Web (dist/)
.\build-installers.ps1 -Target pwa

# Gera exclusivamente o instalador executável (.exe via NSIS)
.\build-installers.ps1 -Target exe

# Gera exclusivamente o instalador corporativo (.msi via WiX)
.\build-installers.ps1 -Target msi

# Gera ambos os instaladores de Desktop (.exe e .msi)
.\build-installers.ps1 -Target desktop
```

### 2.2 Pelo Windows Explorer (Menu de 1 Clique)
Dê um duplo clique no arquivo:
```text
build-installers.bat
```
Um menu interativo será exibido no prompt permitindo escolher a opção desejada (1 para todos, 2 para PWA, 3 para .exe, 4 para .msi).

### 2.3 Pelos Comandos do `package.json` (Bun / NPM)
Você também pode disparar os comandos diretamente pelo gerenciador de pacotes:

```bash
# Gera o PWA Web pronto para produção
bun run build:pwa

# Gera exclusivamente o instalador executável (.exe)
bun run build:desktop:exe

# Gera exclusivamente o instalador corporativo (.msi)
bun run build:desktop:msi

# Gera os instaladores Desktop (.exe e .msi)
bun run build:desktop

# Gera todos os alvos (PWA + .exe + .msi) e emite os hashes SHA-256
bun run release
# ou
bun run build:all
```

---

## 3. Estrutura dos Arquivos Gerados

Ao término da compilação, os arquivos estarão organizados nos seguintes diretórios:

### 3.1 PWA Web (`dist/`)
* `dist/index.html`: Ponto de entrada otimizado com caminhos relativos.
* `dist/sw.js`: Service Worker com precache de até 15 MB.
* `dist/data/dataset.json`: Base de dados oficial completa (6,9 MB) cacheada para uso 100% offline.
* `dist/manifest.webmanifest`: Manifesto PWA com suporte a instalação como aplicativo independente.
* `dist/assets/`: Bundle CSS e JavaScript transpilados.

### 3.2 Instaladores Windows Desktop (`src-tauri/target/release/bundle/`)
* **Executável NSIS (.exe)**:
  `src-tauri/target/release/bundle/nsis/PalhetasAuto_0.1.0_x64-setup.exe`
  * Inclui desinstalador, ícone personalizado, suporte a atualização e sem dependências externas.
* **Instalador MSI (.msi)**:
  `src-tauri/target/release/bundle/msi/PalhetasAuto_0.1.0_x64_pt-BR.msi`
  * Padrão Windows Installer compatível com instalação silenciosa (`msiexec /i ... /quiet`).

---

## 4. Pré-requisitos para Compilação dos Instaladores

1. **Bun** ou **Node.js 18+** instalados no PATH.
2. **Rust & Cargo** (versão 1.90+):
   * Caso não possua, instale via: `https://rustup.rs`
3. **Ferramental de Empacotamento Windows**:
   * O Tauri v2 gerencia automaticamente o download do NSIS para o pacote `.exe`.
   * Para o pacote `.msi`, o Tauri utiliza o WiX Toolset v3 (ou faz download das ferramentas necessárias durante a compilação).
