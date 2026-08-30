/* ============================================================
 * 写作台：在浏览器里连接 GitHub，直接写文章并提交
 * Token 只保存在 localStorage，只发送给 api.github.com
 * ============================================================ */
(function () {
  "use strict";

  var LS_KEY = "blog_gh_settings";
  var cfg = null;
  var allPosts = [];
  var rawPosts = {};   // slug -> Markdown 原文
  var site = null;
  var template = null;
  var editing = null;  // { md, file, originalSlug }

  function $(id) { return document.getElementById(id); }

  function setStatus(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || "";
    el.className = "status" + (ok ? " ok" : msg ? " err" : "");
  }

  function b64ToUtf8(b64) {
    var bin = atob(String(b64 || "").replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    var chunkSize = 0x8000;
    for (var i = 0; i < bytes.length; i += chunkSize) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(bin);
  }

  function encodePath(filePath) {
    return filePath.split("/").map(encodeURIComponent).join("/");
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function repoPath() {
    return "/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo);
  }

  async function gh(path, opts) {
    opts = opts || {};
    var headers = { Accept: "application/vnd.github+json" };
    if (cfg && cfg.token) headers.Authorization = "token " + cfg.token;
    var method = opts.method || "GET";
    var init = { method: method, headers: headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    var res = await fetch("https://api.github.com" + path, init);
    if (!res.ok) {
      var msg = res.status + " " + res.statusText;
      try {
        var j = await res.json();
        if (j && j.message) msg = j.message;
      } catch (e) { /* ignore */ }
      var hint = "";
      if (res.status === 403 || res.status === 404) {
        hint = "（连接/读取失败通常是 Token 已过期、被撤销，或没有勾选这个仓库；写操作失败请确认 Contents 权限是 Read and write）";
      }
      var err = new Error(method + " " + path + " 失败：" + msg + hint);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async function getFileContent(filePath) {
    var f = await gh(repoPath() + "/contents/" + encodePath(filePath));
    return b64ToUtf8(f.content);
  }

  async function listPosts() {
    var items = [];
    try {
      items = await gh(repoPath() + "/contents/_posts");
    } catch (e) {
      if (e.status === 404) return; /* _posts 目录不存在（所有文章已删除） */
      throw e;
    }
    allPosts = [];
    rawPosts = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.type !== "file" || !/\.md$/i.test(it.name)) continue;
      var md = await getFileContent("_posts/" + it.name);
      var slug = it.name.replace(/\.md$/i, "");
      allPosts.push(window.BlogMD.parsePost(md, slug));
      rawPosts[slug] = md;
    }
  }

  async function loadAll() {
    await listPosts();
    var cf = await getFileContent("_config.json");
    site = JSON.parse(cf).site;
    template = await getFileContent("_templates/post.html");
  }

  /* ---------- 提交：通过 Contents API 逐个文件提交 ----------
   * 说明：fine-grained PAT 不支持 Git Data API（/git/blobs 等），
   * 所以这里改用 /contents 接口，每个文件产生一次提交。 */
  async function getFileSha(filePath) {
    try {
      var f = await gh(repoPath() + "/contents/" + encodePath(filePath));
      return f.sha;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  /* Contents API 的 PUT/DELETE；非 ASCII 文件名偶尔需要未编码路径重试 */
  async function requestContents(method, filePath, body) {
    try {
      return await gh(repoPath() + "/contents/" + encodePath(filePath), {
        method: method,
        body: body
      });
    } catch (e) {
      if (method !== "PUT" && method !== "DELETE") throw e;
      return await gh(repoPath() + "/contents/" + filePath, {
        method: method,
        body: body
      });
    }
  }

  async function commitChanges(changes, message) {
    for (var i = 0; i < changes.length; i++) {
      var ch = changes[i];
      var sha = await getFileSha(ch.path);
      if (ch.delete) {
        if (!sha) continue; /* 文件不存在，无需删除 */
        await requestContents("DELETE", ch.path, { message: message, sha: sha, branch: cfg.branch });
        continue;
      }
      var body = {
        message: message + "（" + ch.path + "）",
        content: utf8ToB64(ch.content),
        branch: cfg.branch
      };
      if (sha) body.sha = sha;
      await requestContents("PUT", ch.path, body);
    }
  }

  /* ---------- 连接 ---------- */
  function saveCfg() {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  function loadCfg() {
    try {
      cfg = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    } catch (e) {
      cfg = null;
    }
  }

  async function connect() {
    cfg = {
      owner: $("owner").value.trim(),
      repo: $("repo").value.trim(),
      branch: $("branch").value.trim() || "main",
      token: $("token").value.trim()
    };
    if (!cfg.owner || !cfg.repo) {
      setStatus($("connectStatus"), "请填写仓库所有者和仓库名", false);
      return;
    }
    if (!cfg.token) {
      setStatus($("connectStatus"), "请粘贴 Personal Access Token", false);
      return;
    }
    saveCfg();
    setStatus($("connectStatus"), "连接中…");
    try {
      await gh(repoPath());
      await loadAll();
      renderPosts();
      showConnected();
      setStatus($("connectStatus"), "连接成功 ✔", true);
    } catch (e) {
      setStatus($("connectStatus"), "连接失败：" + e.message, false);
    }
  }

  function disconnect() {
    localStorage.removeItem(LS_KEY);
    cfg = null;
    allPosts = [];
    rawPosts = {};
    site = null;
    template = null;
    editing = null;
    $("postsCard").hidden = true;
    $("editorCard").hidden = true;
    $("settingsCard").hidden = true;
    $("connectBtn").hidden = false;
    $("disconnectBtn").hidden = true;
    $("owner").disabled = false;
    $("repo").disabled = false;
    $("branch").disabled = false;
    $("token").disabled = false;
    setStatus($("connectStatus"), "已断开连接");
  }

  function showConnected() {
    $("postsCard").hidden = false;
    $("connectBtn").hidden = true;
    $("disconnectBtn").hidden = false;
    $("owner").disabled = true;
    $("repo").disabled = true;
    $("branch").disabled = true;
    $("token").disabled = true;
  }

  /* ---------- 文章列表 ---------- */
  function renderPosts() {
    var list = $("postList");
    list.innerHTML = "";
    var sorted = allPosts.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    if (!sorted.length) {
      var empty = document.createElement("div");
      empty.className = "empty-tip";
      empty.textContent = "还没有文章，点“新建文章”开始写。";
      list.appendChild(empty);
      return;
    }
    sorted.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "post-row";

      var info = document.createElement("div");
      info.className = "info";
      var b = document.createElement("b");
      b.textContent = p.title;
      var s = document.createElement("span");
      s.textContent = p.date + " · " + p.category +
        (p.tags.length ? " · " + p.tags.map(function (t) { return "#" + t; }).join(" ") : "");
      info.appendChild(b);
      info.appendChild(s);

      var editBtn = document.createElement("button");
      editBtn.className = "btn";
      editBtn.textContent = "编辑";
      editBtn.onclick = function () { openEditor(p.slug); };

      var delBtn = document.createElement("button");
      delBtn.className = "btn danger";
      delBtn.textContent = "删除";
      delBtn.onclick = function () { deletePost(p.slug); };

      row.appendChild(info);
      row.appendChild(editBtn);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  /* ---------- 编辑器 ---------- */
  function defaultMd(title) {
    var date = new Date().toISOString().slice(0, 10);
    return '---\ntitle: "' + title + '"\ndate: ' + date +
      '\ncategory: 未分类\ntags: []\nexcerpt: ""\n---\n\n# ' + title +
      "\n\n在这里开始写正文……\n";
  }

  function openEditor(slug) {
    var md = rawPosts[slug] || defaultMd(slug);
    editing = { md: md, file: "_posts/" + slug + ".md", originalSlug: slug };
    $("mdInput").value = md;
    $("editorTitle").textContent = "编辑文章";
    $("deleteBtn").hidden = false;
    $("editorCard").hidden = false;
    $("settingsCard").hidden = true;
    setStatus($("editorStatus"), "");
    updatePreview();
    $("editorCard").scrollIntoView({ behavior: "smooth" });
  }

  function newPost() {
    var title = window.prompt("文章标题", "新文章");
    if (title === null) return;
    title = title.trim() || "新文章";
    var md = defaultMd(title);
    editing = { md: md, file: null, originalSlug: null };
    $("mdInput").value = md;
    $("editorTitle").textContent = "新建文章";
    $("deleteBtn").hidden = true;
    $("editorCard").hidden = false;
    $("settingsCard").hidden = true;
    setStatus($("editorStatus"), "");
    updatePreview();
    $("editorCard").scrollIntoView({ behavior: "smooth" });
  }

  function updatePreview() {
    var md = $("mdInput").value;
    var post = window.BlogMD.parsePost(md, "preview");
    var meta = post.date + " · " + post.category +
      (post.tags.length ? " · " + post.tags.map(function (t) { return "#" + t; }).join(" ") : "");
    $("metaSummary").textContent =
      "标题：《" + post.title + "》 " + meta +
      (post.excerpt ? "｜" + post.excerpt : "");
    $("preview").innerHTML =
      "<h1>" + escHtml(post.title) + "</h1>" +
      '<div class="post-meta"><span>' + escHtml(post.date) + "</span><span>·</span><span>" +
      escHtml(post.category) + "</span></div>" +
      window.BlogMD.render(post.body);
  }

  async function savePost() {
    var md = $("mdInput").value;
    var fallback = editing && editing.originalSlug ? editing.originalSlug : "new-post";
    var post = window.BlogMD.parsePost(md, fallback);
    if (!post.slug) {
      setStatus($("editorStatus"), "slug 不能为空", false);
      return;
    }
    var dup = allPosts.some(function (p) {
      return p.slug === post.slug && (!editing || p.slug !== editing.originalSlug);
    });
    if (dup) {
      setStatus($("editorStatus"), "已存在 slug 相同的文章：" + post.slug, false);
      return;
    }

    setStatus($("editorStatus"), "保存中…");
    try {
      await loadAll();
      var changes = [];
      changes.push({ path: "_posts/" + post.slug + ".md", content: md });
      changes.push({
        path: "posts/" + post.slug + ".html",
        content: window.BlogMD.buildPostHtml(post, site, template)
      });

      var idx = -1;
      for (var i = 0; i < allPosts.length; i++) {
        if (editing && allPosts[i].slug === editing.originalSlug) { idx = i; break; }
      }
      if (idx >= 0) {
        allPosts[idx] = post;
      } else {
        allPosts.push(post);
      }

      if (editing && editing.originalSlug && editing.originalSlug !== post.slug) {
        changes.push({ path: "_posts/" + editing.originalSlug + ".md", delete: true });
        changes.push({ path: "posts/" + editing.originalSlug + ".html", delete: true });
      }
      changes.push({ path: "js/data.js", content: window.BlogMD.buildDataJs(allPosts, site) });

      var isNew = !editing || !editing.originalSlug;
      await commitChanges(changes, (isNew ? "新增文章：" : "更新文章：") + post.title);
      await loadAll();
      editing = null;
      $("editorCard").hidden = true;
      renderPosts();
      setStatus($("editorStatus"), "已保存并提交 ✔ 站点约 1-3 分钟更新，等不及可按 Ctrl+F5 强制刷新", true);
    } catch (e) {
      setStatus($("editorStatus"), "保存失败：" + e.message, false);
    }
  }

  async function deletePost(slug) {
    if (!window.confirm("确定删除《" + slug + "》？此操作会直接提交到 GitHub。")) return;
    setStatus($("editorStatus"), "删除中…");
    try {
      await loadAll();
      var changes = [
        { path: "_posts/" + slug + ".md", delete: true },
        { path: "posts/" + slug + ".html", delete: true }
      ];
      allPosts = allPosts.filter(function (p) { return p.slug !== slug; });
      changes.push({ path: "js/data.js", content: window.BlogMD.buildDataJs(allPosts, site) });
      await commitChanges(changes, "删除文章：" + slug);
      await loadAll();
      editing = null;
      $("editorCard").hidden = true;
      renderPosts();
      setStatus($("editorStatus"), "已删除并提交 ✔ 站点约 1-3 分钟更新，等不及可按 Ctrl+F5 强制刷新", true);
    } catch (e) {
      setStatus($("editorStatus"), "删除失败：" + e.message, false);
    }
  }

  /* ---------- 站点设置 ---------- */
  function openSettings() {
    if (!site) return;
    $("siteTitle").value = site.title || "";
    $("siteSubtitle").value = site.subtitle || "";
    $("siteAuthor").value = site.author || "";
    $("siteEmail").value = site.email || "";
    $("siteSince").value = site.since || "";
    $("settingsCard").hidden = false;
    $("editorCard").hidden = true;
    setStatus($("settingsStatus"), "");
    $("settingsCard").scrollIntoView({ behavior: "smooth" });
  }

  async function saveSettings() {
    setStatus($("settingsStatus"), "保存中…");
    try {
      await loadAll();
      site.title = $("siteTitle").value.trim() || site.title;
      site.subtitle = $("siteSubtitle").value.trim();
      site.author = $("siteAuthor").value.trim() || site.author;
      site.email = $("siteEmail").value.trim();
      site.since = parseInt($("siteSince").value, 10) || site.since;
      var configContent = JSON.stringify({ site: site }, null, 2) + "\n";
      var changes = [
        { path: "_config.json", content: configContent },
        { path: "js/data.js", content: window.BlogMD.buildDataJs(allPosts, site) }
      ];
      await commitChanges(changes, "更新站点设置");
      await loadAll();
      setStatus($("settingsStatus"), "设置已保存并提交 ✔ 站点约 1-3 分钟更新", true);
    } catch (e) {
      setStatus($("settingsStatus"), "保存失败：" + e.message, false);
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    loadCfg();
    if (cfg) {
      $("owner").value = cfg.owner || "";
      $("repo").value = cfg.repo || "";
      $("branch").value = cfg.branch || "main";
      $("token").value = cfg.token || "";
    }

    $("connectBtn").onclick = connect;
    $("disconnectBtn").onclick = disconnect;
    $("newBtn").onclick = newPost;
    $("saveBtn").onclick = savePost;
    $("cancelEditBtn").onclick = function () {
      editing = null;
      $("editorCard").hidden = true;
    };
    $("deleteBtn").onclick = function () {
      if (editing && editing.originalSlug) deletePost(editing.originalSlug);
    };
    $("settingsBtn").onclick = openSettings;
    $("saveSettingsBtn").onclick = saveSettings;
    $("mdInput").addEventListener("input", updatePreview);

    var yearEl = $("footerYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    document.body.setAttribute("data-ready", "1");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
