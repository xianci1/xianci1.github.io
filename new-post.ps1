#Requires -Version 5.1
<#
  new-post.ps1 - 创建一篇新文章

  用法: .\new-post.ps1 "文章标题"
  效果: 在 _posts 目录生成一篇带 frontmatter 的 Markdown 草稿
#>
param([string]$Title)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($Title)) {
    $Title = Read-Host "文章标题"
}
if ([string]::IsNullOrWhiteSpace($Title)) {
    Write-Host "标题不能为空" -ForegroundColor Red
    exit 1
}

$slug = $Title -replace '\s+', '-' -replace '[\\/:*?"<>|#%]', ''
$date = Get-Date -Format "yyyy-MM-dd"
$postsDir = Join-Path $root "_posts"

if (-not (Test-Path $postsDir)) {
    New-Item -ItemType Directory -Path $postsDir | Out-Null
}

$file = Join-Path $postsDir ($slug + ".md")
if (Test-Path $file) {
    Write-Host ("文件已存在: " + $file) -ForegroundColor Red
    exit 1
}

$content = @"
---
title: "$Title"
date: $date
category: 未分类
tags: []
excerpt: ""
---

# $Title

在这里开始写正文……
"@

[System.IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("已创建: " + $file) -ForegroundColor Green
Write-Host "写完正文后运行 .\build.ps1 生成页面"
