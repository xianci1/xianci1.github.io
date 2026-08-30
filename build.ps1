#Requires -Version 5.1
<#
  build.ps1 - 一键构建博客

  用法: .\build.ps1

  做了什么:
    1. 读取 _posts/*.md（YAML frontmatter + Markdown 正文）
    2. 把 Markdown 转成 HTML，生成 posts/<slug>.html 文章页
    3. 重新生成 js/data.js（首页列表 / 分类 / 标签 / 搜索的数据源）

  日常写文章流程:
    1. 运行 .\new-post.ps1 "文章标题" 创建 Markdown 草稿
    2. 编辑 _posts/文章名.md
    3. 运行 .\build.ps1
#>
[CmdletBinding()]
param(
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$postsDir = Join-Path $root "_posts"
$outDir = Join-Path $root "posts"
$tplPath = Join-Path $root "_templates/post.html"
$configPath = Join-Path $root "_config.json"
$dataPath = Join-Path $root "js/data.js"

if ($Help) {
    Write-Host ""
    Write-Host "build.ps1 - 一键构建博客" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  用法: .\build.ps1"
    Write-Host ""
    Write-Host "  步骤:"
    Write-Host "    1. 在 _posts 目录里写 Markdown 文章"
    Write-Host "    2. 文章开头用 --- 包裹 frontmatter:"
    Write-Host "       title / date / category / tags / excerpt"
    Write-Host "    3. 运行本脚本，自动生成 posts/*.html 和 js/data.js"
    Write-Host ""
    Write-Host "  参数: -Help 显示本帮助"
    Write-Host ""
    exit 0
}

if (-not (Test-Path $configPath)) {
    Write-Error "缺少配置文件 _config.json"
}
if (-not (Test-Path $tplPath)) {
    Write-Error "缺少文章模板 _templates/post.html"
}
if (-not (Test-Path $postsDir)) {
    New-Item -ItemType Directory -Path $postsDir | Out-Null
}
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$config = Get-Content -Raw -Encoding UTF8 $configPath | ConvertFrom-Json
$site = $config.site
$tpl = [System.IO.File]::ReadAllText($tplPath, [System.Text.Encoding]::UTF8)

<# ---------- Markdown 工具函数 ---------- #>

function Convert-Inline {
    param([string]$Text)
    $s = $Text -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;'
    $s = [regex]::Replace($s, '`([^`]+)`', {
        param($m)
        '<code>' + $m.Groups[1].Value + '</code>'
    })
    $s = [regex]::Replace($s, '!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)', '<img src="$2" alt="$1">')
    $s = [regex]::Replace($s, '\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)', '<a href="$2">$1</a>')
    $s = [regex]::Replace($s, '\*\*([^*]+)\*\*', '<strong>$1</strong>')
    $s = [regex]::Replace($s, '(?<!\*)\*([^*]+)\*(?!\*)', '<em>$1</em>')
    $s = [regex]::Replace($s, '~~([^~]+)~~', '<del>$1</del>')
    return $s
}

function Get-BlogTableCells {
    param([string]$Row)
    $Row = $Row.Trim()
    if ($Row.StartsWith("|")) { $Row = $Row.Substring(1) }
    if ($Row.EndsWith("|")) { $Row = $Row.Substring(0, $Row.Length - 1) }
    return ,@($Row -split "\|" | ForEach-Object { $_.Trim() })
}

function ConvertFrom-BlogMarkdown {
    param([string]$Text)

    $lines = $Text -split '\r?\n'
    $out = New-Object System.Text.StringBuilder
    $para = @()
    $listType = ""
    $listItems = @()
    $quoteLines = @()
    $inCode = $false
    $codeLang = ""
    $codeLines = @()

    $flushPara = {
        if ($para.Count -gt 0) {
            $text = Convert-Inline -Text ($para -join " ")
            [void]$out.Append("<p>" + $text + "</p>")
            $para = @()
        }
    }
    $flushList = {
        if ($listItems.Count -gt 0) {
            $tag = if ($listType -eq "ol") { "ol" } else { "ul" }
            [void]$out.Append("<" + $tag + ">")
            foreach ($item in $listItems) {
                [void]$out.Append("<li>" + (Convert-Inline -Text $item) + "</li>")
            }
            [void]$out.Append("</" + $tag + ">")
            $listItems = @()
            $listType = ""
        }
    }
    $flushQuote = {
        if ($quoteLines.Count -gt 0) {
            [void]$out.Append("<blockquote>")
            foreach ($q in $quoteLines) {
                [void]$out.Append("<p>" + (Convert-Inline -Text $q) + "</p>")
            }
            [void]$out.Append("</blockquote>")
            $quoteLines = @()
        }
    }
    $flushAll = {
        . $flushPara
        . $flushList
        . $flushQuote
    }

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]

        if ($inCode) {
            if ($line -match '^```\s*$') {
                [void]$out.Append("<pre><code")
                if ($codeLang -ne "") {
                    [void]$out.Append(' class="language-' + $codeLang + '"')
                }
                [void]$out.Append(">")
                foreach ($cl in $codeLines) {
                    $esc = $cl -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;'
                    [void]$out.AppendLine($esc)
                }
                [void]$out.Append("</code></pre>")
                $inCode = $false
                $codeLang = ""
                $codeLines = @()
            } else {
                $codeLines += $line
            }
            continue
        }

        if ($line -match '^```([A-Za-z0-9_+-]*)\s*$') {
            . $flushAll
            $inCode = $true
            $codeLang = $Matches[1]
            $codeLines = @()
            continue
        }

        if ($line -match '^\s*$') {
            . $flushAll
            continue
        }

        if ($line -match '^(#{1,6})\s+(.*)$') {
            . $flushAll
            $level = $Matches[1].Length
            $heading = Convert-Inline -Text $Matches[2]
            [void]$out.Append("<h" + $level + ">" + $heading + "</h" + $level + ">")
            continue
        }

        if ($line -match '^(\*\*\*|___|---)\s*$') {
            . $flushAll
            [void]$out.Append("<hr>")
            continue
        }

        if ($line -match '^>\s?(.*)$') {
            . $flushPara
            . $flushList
            $quoteLines += $Matches[1]
            continue
        }

        if ($line -match '^[-*+]\s+(.*)$') {
            . $flushPara
            . $flushQuote
            if ($listType -ne "ul") {
                . $flushList
                $listType = "ul"
            }
            $listItems += $Matches[1]
            continue
        }

        if ($line -match '^\d+[.)]\s+(.*)$') {
            . $flushPara
            . $flushQuote
            if ($listType -ne "ol") {
                . $flushList
                $listType = "ol"
            }
            $listItems += $Matches[1]
            continue
        }

        if (
            $line -match '\|' -and
            ($i + 1) -lt $lines.Count -and
            $lines[$i + 1] -match '^\s*\|?[\s:|-]+\|?\s*$' -and
            $lines[$i + 1] -match '-'
        ) {
            . $flushAll
            $headerCells = Get-BlogTableCells $line
            $i++  # 跳过分隔行
            $bodyRows = @()
            while (($i + 1) -lt $lines.Count -and $lines[$i + 1].Trim() -ne "" -and $lines[$i + 1] -match '\|') {
                $i++
                $bodyRows += ,(Get-BlogTableCells $lines[$i])
            }
            [void]$out.Append("<table><thead><tr>")
            foreach ($c in $headerCells) {
                [void]$out.Append("<th>" + (Convert-Inline -Text $c) + "</th>")
            }
            [void]$out.Append("</tr></thead><tbody>")
            foreach ($row in $bodyRows) {
                [void]$out.Append("<tr>")
                foreach ($c in $row) {
                    [void]$out.Append("<td>" + (Convert-Inline -Text $c) + "</td>")
                }
                [void]$out.Append("</tr>")
            }
            [void]$out.Append("</tbody></table>")
            continue
        }

        . $flushList
        . $flushQuote
        $para += $line
    }

    . $flushAll
    return $out.ToString()
}

<# ---------- frontmatter 解析 ---------- #>

function Get-FmField {
    param([string]$MetaText, [string]$Name, [string]$Default = "")
    $m = [regex]::Match($MetaText, "(?m)^" + [regex]::Escape($Name) + "\s*:\s*(.*)$")
    if ($m.Success) {
        $v = $m.Groups[1].Value.Trim()
        if ($v.Length -ge 2) {
            if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
                $v = $v.Substring(1, $v.Length - 2)
            }
        }
        return $v
    }
    return $Default
}

function Get-FmTags {
    param([string]$MetaText)
    $m = [regex]::Match($MetaText, '(?m)^tags\s*:\s*(.*)$')
    if (-not $m.Success) { return ,@() }
    $rest = $m.Groups[1].Value.Trim()
    if ($rest -eq "") {
        $tail = $MetaText.Substring($m.Index + $m.Length)
        $items = @()
        foreach ($lm in [regex]::Matches($tail, '(?m)^\s+-\s+(.+?)\s*$')) {
            $items += $lm.Groups[1].Value.Trim()
        }
        return ,$items
    }
    if ($rest.StartsWith("[")) {
        $inner = $rest.TrimStart("[").TrimEnd("]")
    } else {
        $inner = $rest
    }
    $items = @($inner -split "," | ForEach-Object {
        $_.Trim().Trim('"').Trim("'")
    } | Where-Object { $_ -ne "" })
    return ,$items
}

function Get-AutoExcerpt {
    param([string]$Body)
    foreach ($line in ($Body -split '\r?\n')) {
        $t = $line.Trim()
        if ($t -eq "" -or $t.StartsWith("#") -or $t.StartsWith('```') -or $t.StartsWith(">")) { continue }
        $plain = [regex]::Replace($t, '[#*_`>\[\]()!-]', ' ')
        $plain = [regex]::Replace($plain, '\s+', ' ').Trim()
        if ($plain.Length -gt 100) { $plain = $plain.Substring(0, 100) + "……" }
        return $plain
    }
    return ""
}

function To-JsString {
    param([string]$Value)
    if ($null -eq $Value) { return '""' }
    $Value = $Value.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '\n')
    return '"' + $Value + '"'
}

<# ---------- 主流程 ---------- #>

Write-Host "开始构建..." -ForegroundColor Cyan

$posts = @()
$files = @(Get-ChildItem -Path (Join-Path $postsDir "*.md") -File | Sort-Object Name)

if ($files.Count -eq 0) {
    Write-Warning "_posts 目录里还没有 Markdown 文章，先用 .\new-post.ps1 创建一篇"
}

foreach ($file in $files) {
    $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $fm = [regex]::Match($raw, '(?s)^---[ \t]*\r?\n(.*?)\r?\n---[ \t]*\r?\n?(.*)$')
    if ($fm.Success) {
        $metaText = $fm.Groups[1].Value
        $body = $fm.Groups[2].Value
    } else {
        $metaText = ""
        $body = $raw
    }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $slug = (Get-FmField $metaText "slug" $base) -replace '\s+', '-' -replace '[\\/:*?"<>|#%]', ''
    $title = Get-FmField $metaText "title" $base
    $date = Get-FmField $metaText "date" (Get-Date -Format "yyyy-MM-dd")
    $category = Get-FmField $metaText "category" "未分类"
    $tags = Get-FmTags $metaText
    $excerpt = Get-FmField $metaText "excerpt" ""
    if ($excerpt -eq "") {
        $excerpt = Get-AutoExcerpt $body
    }

    $bodyHtml = ConvertFrom-BlogMarkdown $body
    $desc = $excerpt.Replace('"', '&quot;')

    $html = $tpl
    $html = $html.Replace("__SITE_TITLE__", $site.title)
    $html = $html.Replace("__AUTHOR__", $site.author)
    $html = $html.Replace("__TITLE__", $title)
    $html = $html.Replace("__DESCRIPTION__", $desc)
    $html = $html.Replace("__SLUG__", $slug)
    $html = $html.Replace("__BODY__", $bodyHtml)

    $outFile = Join-Path $outDir ($slug + ".html")
    [System.IO.File]::WriteAllText($outFile, $html, (New-Object System.Text.UTF8Encoding($false)))

    $posts += [PSCustomObject]@{
        slug = $slug
        title = $title
        date = $date
        category = $category
        tags = @($tags)
        excerpt = $excerpt
        url = "posts/" + $slug + ".html"
    }
    Write-Host ("  [生成] posts/" + $slug + ".html") -ForegroundColor Green
}

$posts = @($posts | Sort-Object @{ Expression = { $_.date }; Descending = $true }, @{ Expression = { $_.title }; Descending = $false })

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("/* 本文件由 build.ps1 自动生成，请勿手动修改。")
[void]$sb.AppendLine(" * 修改 _config.json 和 _posts/*.md 后运行 .\build.ps1 即可。 */")
[void]$sb.AppendLine("window.BLOG_DATA = {")
[void]$sb.AppendLine("  site: {")
[void]$sb.AppendLine("    title: " + (To-JsString $site.title) + ",")
[void]$sb.AppendLine("    subtitle: " + (To-JsString $site.subtitle) + ",")
[void]$sb.AppendLine("    author: " + (To-JsString $site.author) + ",")
[void]$sb.AppendLine("    email: " + (To-JsString $site.email) + ",")
[void]$sb.AppendLine("    since: " + ([int]$site.since))
[void]$sb.AppendLine("  },")
[void]$sb.AppendLine("  posts: [")
for ($i = 0; $i -lt $posts.Count; $i++) {
    $p = $posts[$i]
    $tagItems = @($p.tags | ForEach-Object { To-JsString $_ }) -join ", "
    [void]$sb.AppendLine("    {")
    [void]$sb.AppendLine("      slug: " + (To-JsString $p.slug) + ",")
    [void]$sb.AppendLine("      title: " + (To-JsString $p.title) + ",")
    [void]$sb.AppendLine("      date: " + (To-JsString $p.date) + ",")
    [void]$sb.AppendLine("      category: " + (To-JsString $p.category) + ",")
    [void]$sb.AppendLine("      tags: [" + $tagItems + "],")
    [void]$sb.AppendLine("      excerpt: " + (To-JsString $p.excerpt) + ",")
    [void]$sb.AppendLine("      url: " + (To-JsString $p.url))
    if ($i -lt $posts.Count - 1) {
        [void]$sb.AppendLine("    },")
    } else {
        [void]$sb.AppendLine("    }")
    }
}
[void]$sb.AppendLine("  ]")
[void]$sb.AppendLine("};")
[System.IO.File]::WriteAllText($dataPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host ("构建完成：{0} 篇文章，js/data.js 已更新" -f $posts.Count) -ForegroundColor Cyan
Write-Host "本地预览：双击 index.html"
Write-Host '一键发布：.\deploy.ps1 "提交说明"'
