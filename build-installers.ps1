<#
.SYNOPSIS
    Script de automação para geração do PWA Web e dos instaladores Windows (.exe e .msi) do Catálogo de Palhetas.

.DESCRIPTION
    Compila o pacote PWA offline (Vite + Service Worker + Workbox) e utiliza o Tauri v2 para empacotar:
    - Instalador Executável (.exe) via NSIS
    - Instalador Corporativo (.msi) via WiX Toolset

.PARAMETER Target
    Alvo de compilação: 'all', 'pwa', 'exe', 'msi', 'desktop' (padrão: 'all').

.EXAMPLE
    .\build-installers.ps1 -Target pwa
    .\build-installers.ps1 -Target exe
    .\build-installers.ps1 -Target msi
    .\build-installers.ps1 -Target all
#>

param(
    [ValidateSet('all', 'pwa', 'exe', 'msi', 'desktop')]
    [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   CATÁLOGO TÉCNICO DE PALHETAS AUTOMOTIVAS — GERADOR DE RELEASE  " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se o Bun está instalado
$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunCmd) {
    Write-Host "✖ Erro: 'bun' não foi encontrado no PATH do sistema." -ForegroundColor Red
    Write-Host "Instale via powershell: powershell -c ""irm bun.sh/install.ps1|iex""" -ForegroundColor Yellow
    exit 1
}

# Traduz o parâmetro para flag do script TypeScript
$cliFlag = "--$Target"
if ($Target -eq 'all') {
    $cliFlag = "--all"
} elseif ($Target -eq 'desktop') {
    $cliFlag = "--desktop"
}

Write-Host "Iniciando compilação com alvo: '$Target'..." -ForegroundColor Green
Write-Host "Comando: bun scripts/build-release.ts $cliFlag" -ForegroundColor DarkGray
Write-Host ""

& bun scripts/build-release.ts $cliFlag

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✖ Falha durante a execução do script de build." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "✔ Script de geração concluído com sucesso!" -ForegroundColor Green
Write-Host ""
