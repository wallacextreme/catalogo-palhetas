@echo off
chcp 65001 > nul
title Catálogo de Palhetas Automotivas - Gerador de Release

echo ==================================================================
echo   CATÁLOGO TÉCNICO DE PALHETAS AUTOMOTIVAS - GERADOR DE RELEASE
echo ==================================================================
echo.
echo Escolha o tipo de pacote a ser gerado:
echo.
echo  [1] Todos (PWA Web + Instalador .exe + Instalador .msi)
echo  [2] Apenas PWA Web (dist/ para navegador e deploy)
echo  [3] Apenas Instalador Executável Windows (.exe - NSIS)
echo  [4] Apenas Instalador Pacote Windows (.msi - WiX)
echo  [5] Apenas Instaladores Desktop (.exe e .msi)
echo  [0] Sair
echo.

set /p CHOICE="Digite o número da opção desejada (padrão: 1): "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" goto BUILD_ALL
if "%CHOICE%"=="2" goto BUILD_PWA
if "%CHOICE%"=="3" goto BUILD_EXE
if "%CHOICE%"=="4" goto BUILD_MSI
if "%CHOICE%"=="5" goto BUILD_DESKTOP
if "%CHOICE%"=="0" goto EXIT

echo Opção inválida. Executando compilação completa...
goto BUILD_ALL

:BUILD_ALL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-installers.ps1" -Target all
goto FINISH

:BUILD_PWA
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-installers.ps1" -Target pwa
goto FINISH

:BUILD_EXE
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-installers.ps1" -Target exe
goto FINISH

:BUILD_MSI
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-installers.ps1" -Target msi
goto FINISH

:BUILD_DESKTOP
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-installers.ps1" -Target desktop
goto FINISH

:FINISH
echo.
pause
:EXIT
