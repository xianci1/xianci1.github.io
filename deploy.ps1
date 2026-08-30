#Requires -Version 5.1
<#
  deploy.ps1 - 一键发布

  用法: .\deploy.ps1 "提交说明"
  效果: 构建页面 → git add → git commit → git push
  前提: 已经设置过 Git 身份和远程仓库（见 README）
#>
param([string]$Message = "update blog")

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$build = Join-Path $root "build.ps1"

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $build
if ($LASTEXITCODE -ne 0) {
    Write-Host "构建失败，已中止发布" -ForegroundColor Red
    exit 1
}

Push-Location $root
try {
    git add -A
    if ($LASTEXITCODE -ne 0) { exit 1 }
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        Write-Host "提交失败：可能没有改动，或未设置 Git 身份（git config user.name / user.email）" -ForegroundColor Red
        exit 1
    }
    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "推送失败：请确认已创建 GitHub 仓库并配置好远程地址" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host "发布完成 ✔" -ForegroundColor Green
