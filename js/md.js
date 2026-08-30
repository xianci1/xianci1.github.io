/* ============================================================
 * Markdown → HTML 转换与构建逻辑
 * 与 build.ps1 保持同一套规则：写作台和命令行生成的页面一致。
 * ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* 行内格式：行内代码、图片、链接、加粗、斜体、删除线 */
  function inline(text) {
    var s = esc(text);
    s = s.replace(/`([^`]+)`/g, function (m, c) {
      return "<code>" + c + "</code>";
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return s;
  }

  /* 整篇 Markdown → HTML */
  function render(text) {
    var lines = String(text == null ? "" : text).split(/\r?\n/);
    var out = [];
    var para = [];
    var listType = "";
    var listItems = [];
    var quoteLines = [];
    var inCode = false;
    var codeLang = "";
    var codeLines = [];

    function flushPara() {
      if (para.length) {
        out.push("<p>" + inline(para.join(" ")) + "</p>");
        para = [];
      }
    }
    function flushList() {
      if (listItems.length) {
        var tag = listType === "ol" ? "ol" : "ul";
        out.push("<" + tag + ">");
        for (var i = 0; i < listItems.length; i++) {
          out.push("<li>" + inline(listItems[i]) + "</li>");
        }
        out.push("</" + tag + ">");
        listItems = [];
        listType = "";
      }
    }
    function flushQuote() {
      if (quoteLines.length) {
        out.push("<blockquote>");
        for (var i = 0; i < quoteLines.length; i++) {
          out.push("<p>" + inline(quoteLines[i]) + "</p>");
        }
        out.push("</blockquote>");
        quoteLines = [];
      }
    }
    function flushAll() {
      flushPara();
      flushList();
      flushQuote();
    }

    function tableCells(row) {
      row = row.trim();
      if (row.charAt(0) === "|") row = row.slice(1);
      if (row.charAt(row.length - 1) === "|") row = row.slice(0, -1);
      return row.split("|").map(function (c) { return c.trim(); });
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (inCode) {
        if (/^```\s*$/.test(line)) {
          var cls = codeLang ? ' class="language-' + codeLang + '"' : "";
          var body = codeLines.map(function (l) {
            return l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          }).join("\n");
          out.push("<pre><code" + cls + ">" + body + "\n</code></pre>");
          inCode = false;
          codeLang = "";
          codeLines = [];
        } else {
          codeLines.push(line);
        }
        continue;
      }

      var m = line.match(/^```([A-Za-z0-9_+-]*)\s*$/);
      if (m) {
        flushAll();
        inCode = true;
        codeLang = m[1] || "";
        codeLines = [];
        continue;
      }

      if (/^\s*$/.test(line)) {
        flushAll();
        continue;
      }

      m = line.match(/^(#{1,6})\s+(.*)$/);
      if (m) {
        flushAll();
        var lvl = m[1].length;
        out.push("<h" + lvl + ">" + inline(m[2]) + "</h" + lvl + ">");
        continue;
      }

      if (/^(\*\*\*|___|---)\s*$/.test(line)) {
        flushAll();
        out.push("<hr>");
        continue;
      }

      m = line.match(/^>\s?(.*)$/);
      if (m) {
        flushPara();
        flushList();
        quoteLines.push(m[1]);
        continue;
      }

      m = line.match(/^[-*+]\s+(.*)$/);
      if (m) {
        flushPara();
        flushQuote();
        if (listType !== "ul") {
          flushList();
          listType = "ul";
        }
        listItems.push(m[1]);
        continue;
      }

      m = line.match(/^\d+[.)]\s+(.*)$/);
      if (m) {
        flushPara();
        flushQuote();
        if (listType !== "ol") {
          flushList();
          listType = "ol";
        }
        listItems.push(m[1]);
        continue;
      }

      var next = lines[i + 1];
      var isSep = /^\s*\|?[\s:|-]+\|?\s*$/.test(next || "") && (next || "").indexOf("-") >= 0;
      if (line.indexOf("|") >= 0 && i + 1 < lines.length && isSep) {
        flushAll();
        var header = tableCells(line);
        i++;
        var rows = [];
        while (i + 1 < lines.length && lines[i + 1].trim() !== "" && lines[i + 1].indexOf("|") >= 0) {
          i++;
          rows.push(tableCells(lines[i]));
        }
        out.push("<table><thead><tr>");
        for (var h = 0; h < header.length; h++) out.push("<th>" + inline(header[h]) + "</th>");
        out.push("</tr></thead><tbody>");
        for (var r = 0; r < rows.length; r++) {
          out.push("<tr>");
          for (var c = 0; c < rows[r].length; c++) out.push("<td>" + inline(rows[r][c]) + "</td>");
          out.push("</tr>");
        }
        out.push("</tbody></table>");
        continue;
      }

      flushList();
      flushQuote();
      para.push(line);
    }

    flushAll();
    return out.join("");
  }

  /* 从正文自动生成摘要 */
  function autoExcerpt(body) {
    var lines = String(body == null ? "" : body).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t || t.charAt(0) === "#" || t.indexOf("```") === 0 || t.charAt(0) === ">") continue;
      var plain = t.replace(/[#*_`>\[\]()!-]/g, " ").replace(/\s+/g, " ").trim();
      if (plain.length > 100) plain = plain.slice(0, 100) + "……";
      return plain;
    }
    return "";
  }

  /* 解析 frontmatter，返回文章对象 */
  function parsePost(md, fallbackSlug) {
    md = String(md == null ? "" : md);
    var fm = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(md);
    var metaText = "";
    var body = md;
    if (fm) {
      metaText = fm[1];
      body = fm[2];
    }

    function field(name, dflt) {
      var re = new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:\\s*(.*)$", "m");
      var m = re.exec(metaText);
      if (m) {
        var v = m[1].trim();
        if (v.length >= 2) {
          if ((v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') ||
              (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")) {
            v = v.slice(1, -1);
          }
        }
        return v;
      }
      return dflt;
    }

    function tags() {
      var m = /^tags\s*:\s*(.*)$/m.exec(metaText);
      if (!m) return [];
      var rest = m[1].trim();
      if (rest === "") {
        var tail = metaText.slice(m.index + m[0].length);
        var items = [];
        var re = /^\s+-\s+(.+?)\s*$/gm;
        var t;
        while ((t = re.exec(tail))) items.push(t[1].trim());
        return items;
      }
      var inner = rest.charAt(0) === "[" ? rest.replace(/^\[/, "").replace(/\]$/, "") : rest;
      return inner.split(",").map(function (s) {
        return s.trim().replace(/^["']|["']$/g, "");
      }).filter(function (s) { return s !== ""; });
    }

    var slug = (field("slug", fallbackSlug) || "").replace(/\s+/g, "-").replace(/[\\/:*?"<>|#%]/g, "");
    var title = field("title", fallbackSlug || "未命名");
    var date = field("date", new Date().toISOString().slice(0, 10));
    var category = field("category", "未分类");
    var excerpt = field("excerpt", "");
    if (!excerpt) excerpt = autoExcerpt(body);

    return {
      slug: slug,
      title: title,
      date: date,
      category: category,
      tags: tags(),
      excerpt: excerpt,
      body: body
    };
  }

  function jsString(s) {
    return JSON.stringify(s == null ? "" : String(s));
  }

  /* 用模板生成文章页 HTML */
  function buildPostHtml(post, site, template) {
    var html = template;
    html = html.split("__SITE_TITLE__").join(site.title);
    html = html.split("__AUTHOR__").join(site.author);
    html = html.split("__TITLE__").join(post.title);
    html = html.split("__DESCRIPTION__").join(String(post.excerpt || "").replace(/"/g, "&quot;"));
    html = html.split("__SLUG__").join(post.slug);
    html = html.split("__BODY__").join(render(post.body));
    return html;
  }

  /* 生成 js/data.js */
  function buildDataJs(posts, site) {
    var sorted = (posts || []).slice().sort(function (a, b) {
      return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
    });
    var lines = [];
    lines.push("/* 本文件由 build.ps1 / 写作台 自动生成，请勿手动修改。");
    lines.push(" * 修改 _config.json 和 _posts/*.md 后重新构建即可。 */");
    lines.push("window.BLOG_DATA = {");
    lines.push("  site: {");
    lines.push("    title: " + jsString(site.title) + ",");
    lines.push("    subtitle: " + jsString(site.subtitle) + ",");
    lines.push("    author: " + jsString(site.author) + ",");
    lines.push("    email: " + jsString(site.email) + ",");
    lines.push("    since: " + (Number(site.since) || 0));
    lines.push("  },");
    lines.push("  posts: [");
    for (var i = 0; i < sorted.length; i++) {
      var p = sorted[i];
      lines.push("    {");
      lines.push("      slug: " + jsString(p.slug) + ",");
      lines.push("      title: " + jsString(p.title) + ",");
      lines.push("      date: " + jsString(p.date) + ",");
      lines.push("      category: " + jsString(p.category) + ",");
      lines.push("      tags: [" + (p.tags || []).map(jsString).join(", ") + "],");
      lines.push("      excerpt: " + jsString(p.excerpt) + ",");
      lines.push("      url: " + jsString("posts/" + p.slug + ".html"));
      lines.push("    }" + (i < sorted.length - 1 ? "," : ""));
    }
    lines.push("  ]");
    lines.push("};");
    return lines.join("\n");
  }

  window.BlogMD = {
    inline: inline,
    render: render,
    parsePost: parsePost,
    autoExcerpt: autoExcerpt,
    buildPostHtml: buildPostHtml,
    buildDataJs: buildDataJs
  };
})();
