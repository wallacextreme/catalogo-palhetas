import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

// Cores ANSI para saída no terminal
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg: string) {
  console.log(`${c.cyan}[BUILD-RELEASE]${c.reset} ${msg}`);
}

function success(msg: string) {
  console.log(`${c.green}✔ ${msg}${c.reset}`);
}

function warn(msg: string) {
  console.log(`${c.yellow}⚠ ${msg}${c.reset}`);
}

function error(msg: string): never {
  console.error(`${c.red}✖ ERRO: ${msg}${c.reset}`);
  process.exit(1);
}

function getSha256(filePath: string): string {
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

interface BuildOptions {
  buildPwa: boolean;
  buildExe: boolean;
  buildMsi: boolean;
}

function parseArgs(): BuildOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${c.bright}Catálogo de Palhetas Automotivas — Script de Build & Empacotamento${c.reset}

Uso:
  bun scripts/build-release.ts [opções]

Opções:
  --pwa        Gera exclusivamente o pacote Web PWA (dist/) com Service Worker e cache offline.
  --exe        Gera o instalador nativo Windows (.exe) via NSIS.
  --msi        Gera o instalador corporativo Windows (.msi) via WiX Toolset.
  --desktop    Gera ambos os instaladores de Desktop (.exe e .msi).
  --all        Gera tudo (PWA + .exe + .msi) [PADRÃO quando sem argumentos].
  --help, -h   Exibe esta ajuda técnica.
`);
    process.exit(0);
  }

  const buildPwa = args.includes('--pwa') || args.includes('--all') || args.length === 0;
  const buildExe = args.includes('--exe') || args.includes('--desktop') || args.includes('--all') || args.length === 0;
  const buildMsi = args.includes('--msi') || args.includes('--desktop') || args.includes('--all') || args.length === 0;

  return { buildPwa, buildExe, buildMsi };
}

function checkPrerequisites(opts: BuildOptions) {
  log('Verificando pré-requisitos do ambiente...');

  // 1. Dataset validado presente
  const rootDir = process.cwd();
  const datasetPath = resolve(rootDir, 'public/data/dataset.json');
  if (!existsSync(datasetPath)) {
    error(`Dataset não encontrado em ${datasetPath}. Execute 'bun scripts/pipeline/run.ts' primeiro.`);
  }
  success('Dataset oficial presente em public/data/dataset.json');

  // 2. Se for compilar desktop, verificar Rust/Cargo
  if (opts.buildExe || opts.buildMsi) {
    try {
      const rustcVer = execSync('rustc --version', { encoding: 'utf-8' }).trim();
      const cargoVer = execSync('cargo --version', { encoding: 'utf-8' }).trim();
      success(`Rust toolchain detectado: ${rustcVer} | ${cargoVer}`);
    } catch {
      error('Rust/Cargo não encontrados no PATH. Instale via https://rustup.rs para gerar os instaladores desktop.');
    }
  }
}

function buildPwaBundle() {
  log(`${c.bright}Construindo PWA Web (Vite + Service Worker + Precache)...${c.reset}`);
  const result = spawnSync('bun', ['run', 'build:web'], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    error('Falha ao compilar PWA com Vite.');
  }

  const distDir = resolve(process.cwd(), 'dist');
  if (!existsSync(distDir) || !existsSync(join(distDir, 'index.html')) || !existsSync(join(distDir, 'sw.js'))) {
    error('Arquivos essenciais do PWA não foram gerados em dist/.');
  }

  const datasetDist = join(distDir, 'data/dataset.json');
  if (!existsSync(datasetDist)) {
    error('public/data/dataset.json não foi copiado para dist/data/dataset.json.');
  }

  success('Pacote PWA Web gerado com sucesso em dist/ (100% pronto para deploy ou execução offline).');
}

function buildDesktopInstallers(opts: BuildOptions) {
  const bundles: string[] = [];
  if (opts.buildExe) bundles.push('nsis');
  if (opts.buildMsi) bundles.push('msi');

  if (bundles.length === 0) return;

  log(`${c.bright}Construindo instaladores desktop (${bundles.join(', ')})...${c.reset}`);

  // Se o PWA ainda não foi gerado, executa antes para garantir que frontendDist exista
  const distDir = resolve(process.cwd(), 'dist');
  if (!existsSync(distDir)) {
    buildPwaBundle();
  }

  for (const bundle of bundles) {
    const ext = bundle === 'nsis' ? '.exe' : '.msi';
    log(`Iniciando compilação do instalador ${bundle.toUpperCase()} (${ext})...`);

    const result = spawnSync('bunx', ['tauri', 'build', '--bundles', bundle], {
      stdio: 'inherit',
      shell: true,
    });

    if (result.status !== 0) {
      warn(`Falha na compilação do bundle ${bundle.toUpperCase()}. Verifique se as ferramentas adicionais (NSIS ou WiX) estão instaladas.`);
    } else {
      success(`Instalador ${bundle.toUpperCase()} gerado com sucesso!`);
    }
  }
}

function collectArtifacts() {
  const rootDir = process.cwd();
  const artifacts: Array<{
    type: string;
    path: string;
    filename: string;
    sizeBytes: number;
    sizeFormatted: string;
    sha256: string;
  }> = [];

  // PWA Index
  const pwaIndex = resolve(rootDir, 'dist/index.html');
  if (existsSync(pwaIndex)) {
    const pwaSw = resolve(rootDir, 'dist/sw.js');
    artifacts.push({
      type: 'PWA Web (Entrypoint)',
      path: pwaIndex,
      filename: 'dist/index.html',
      sizeBytes: statSync(pwaIndex).size,
      sizeFormatted: formatBytes(statSync(pwaIndex).size),
      sha256: getSha256(pwaIndex),
    });
    if (existsSync(pwaSw)) {
      artifacts.push({
        type: 'PWA Service Worker',
        path: pwaSw,
        filename: 'dist/sw.js',
        sizeBytes: statSync(pwaSw).size,
        sizeFormatted: formatBytes(statSync(pwaSw).size),
        sha256: getSha256(pwaSw),
      });
    }
  }

  // NSIS (.exe)
  const nsisDir = resolve(rootDir, 'src-tauri/target/release/bundle/nsis');
  if (existsSync(nsisDir)) {
    const files = readdirSync(nsisDir).filter((f) => f.endsWith('.exe'));
    for (const file of files) {
      const fullPath = join(nsisDir, file);
      artifacts.push({
        type: 'Instalador Windows (.exe / NSIS)',
        path: fullPath,
        filename: file,
        sizeBytes: statSync(fullPath).size,
        sizeFormatted: formatBytes(statSync(fullPath).size),
        sha256: getSha256(fullPath),
      });
    }
  }

  // MSI (.msi)
  const msiDir = resolve(rootDir, 'src-tauri/target/release/bundle/msi');
  if (existsSync(msiDir)) {
    const files = readdirSync(msiDir).filter((f) => f.endsWith('.msi'));
    for (const file of files) {
      const fullPath = join(msiDir, file);
      artifacts.push({
        type: 'Instalador Windows (.msi / WiX)',
        path: fullPath,
        filename: file,
        sizeBytes: statSync(fullPath).size,
        sizeFormatted: formatBytes(statSync(fullPath).size),
        sha256: getSha256(fullPath),
      });
    }
  }

  return artifacts;
}

function main() {
  console.log(`\n${c.magenta}================================================================${c.reset}`);
  console.log(`${c.bright}  Catálogo Técnico de Palhetas — Gerador de PWA e Instaladores  ${c.reset}`);
  console.log(`${c.magenta}================================================================${c.reset}\n`);

  const opts = parseArgs();
  checkPrerequisites(opts);

  if (opts.buildPwa) {
    buildPwaBundle();
  }

  if (opts.buildExe || opts.buildMsi) {
    buildDesktopInstallers(opts);
  }

  log('Coletando e catalogando artefatos gerados...');
  const artifacts = collectArtifacts();

  console.log(`\n${c.bright}=== ARTEFATOS FINAIS PRONTOS PARA DISTRIBUIÇÃO ===${c.reset}\n`);
  if (artifacts.length === 0) {
    warn('Nenhum instalador ou pacote foi encontrado.');
  } else {
    for (const art of artifacts) {
      console.log(`${c.green}📦 [${art.type}]${c.reset}`);
      console.log(`   Arquivo: ${c.bright}${art.filename}${c.reset}`);
      console.log(`   Tamanho: ${art.sizeFormatted}`);
      console.log(`   SHA-256: ${c.cyan}${art.sha256}${c.reset}`);
      console.log(`   Origem:  ${art.path}\n`);
    }
  }

  console.log(`${c.green}✔ Processo de compilação e empacotamento finalizado!${c.reset}\n`);
}

main();
