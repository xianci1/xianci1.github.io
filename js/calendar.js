/* ============================================================
 * 日历计划：月视图 + 每天的计划
 * - 本地：localStorage 即时保存（blog-calendar-plans）
 * - 云端：连接 GitHub 后读写 data/calendar.json（与写作台共用 Token）
 * ============================================================ */
(function () {
  "use strict";

  var LS_PLANS = "blog-calendar-plans";
  var LS_CFG = "blog_gh_settings";
  var DATA_PATH = "data/calendar.json";

  var plans = {};
  var cfg = null;
  var connected = false;
  var dirty = false;
  var syncing = false;
  var storageOk = true;
  var state = { year: 0, month: 0, selected: null };

  function $(id) { return document.getElementById(id); }

  var daysEl = $("calDays");
  var titleEl = $("calTitle");
  var dateLabelEl = $("calDateLabel");
  var planEl = $("calPlan");
  var saveStateEl = $("calSaveState");
  var clearBtn = $("calClear");
  var syncBtn = $("calSyncBtn");
  var hintEl = $("calHint");
  var connectBox = $("calConnect");
  var ghStateEl = $("calGhState");

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setSaveState(text, cls) {
    saveStateEl.textContent = text || "";
    saveStateEl.className = "calendar-save-state" + (cls ? " " + cls : "");
  }

  function setGhState(text, cls) {
    ghStateEl.textContent = text || "";
    ghStateEl.className = "calendar-gh-state" + (cls ? " " + cls : "");
  }

  /* ---------- 本地存储 ---------- */
  function loadLocal() {
    try {
      var raw = localStorage.getItem(LS_PLANS);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === "object" && !Array.isArray(p)) plans = p;
      }
    } catch (e) {
      storageOk = false;
      plans = {};
    }
  }

  function persistLocal() {
    try {
      localStorage.setItem(LS_PLANS, JSON.stringify(plans));
      storageOk = true;
      return true;
    } catch (e) {
      storageOk = false;
      return false;
    }
  }

  /* ---------- GitHub API ---------- */
  function loadCfg() {
    try { cfg = JSON.parse(localStorage.getItem(LS_CFG) || "null"); }
    catch (e) { cfg = null; }
  }

  function repoPath() {
    return "/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo);
  }

  function encodePath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  function b64ToUtf8(b64) {
    var bin = atob(String(b64 || "").replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
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
        hint = "（Token 可能已过期或未勾选此仓库；写操作需 Contents 权限为 Read and write）";
      }
      var err = new Error(msg + hint);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async function getFileContent(path) {
    var f = await gh(repoPath() + "/contents/" + encodePath(path));
    return b64ToUtf8(f.content);
  }

  async function getFileSha(path) {
    try {
      var f = await gh(repoPath() + "/contents/" + encodePath(path));
      return f.sha;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async function loadRemote() {
    var text;
    try {
      text = await getFileContent(DATA_PATH);
    } catch (e) {
      if (e.status === 404) return {};
      throw e;
    }
    var p = JSON.parse(text);
    return (p && typeof p === "object" && !Array.isArray(p)) ? p : {};
  }

  async function saveRemote() {
    var content = JSON.stringify(plans, null, 2) + "\n";
    var sha = await getFileSha(DATA_PATH);
    var body = { message: "更新日历计划", content: utf8ToB64(content), branch: cfg.branch };
    if (sha) body.sha = sha;
    await gh(repoPath() + "/contents/" + encodePath(DATA_PATH), { method: "PUT", body: body });
  }

  /* 本浏览器的本地计划合并进云端数据（本地优先，不丢内容） */
  function mergeLocalInto(remote) {
    var changed = false;
    for (var k in plans) {
      if (Object.prototype.hasOwnProperty.call(plans, k) && remote[k] !== plans[k]) {
        remote[k] = plans[k];
        changed = true;
      }
    }
    return changed;
  }

  /* ---------- 连接 / 加载 ---------- */
  async function connectFromCfg() {
    setGhState("连接中…");
    try {
      await gh(repoPath());
      var remote = await loadRemote();
      var changed = mergeLocalInto(remote);
      plans = remote;
      connected = true;
      persistLocal();
      if (changed) await saveRemote();
      connectBox.hidden = true;
      setGhState("已连接 " + cfg.owner + "/" + cfg.repo, "ok");
    } catch (e) {
      connected = false;
      connectBox.hidden = false;
      setGhState("连接失败：" + e.message, "err");
    }
    dirty = false;
    render();
    if (state.selected) openEditor(state.selected, false);
  }

  function connectFromForm() {
    var owner = $("calOwner").value.trim();
    var repo = $("calRepo").value.trim();
    var branch = $("calBranch").value.trim() || "main";
    var token = $("calToken").value.trim();
    if (!owner || !repo || !token) {
      setGhState("请填写仓库所有者、仓库名和 Token", "err");
      return;
    }
    cfg = { owner: owner, repo: repo, branch: branch, token: token };
    localStorage.setItem(LS_CFG, JSON.stringify(cfg));
    connectFromCfg();
  }

  /* 未连接时，在已部署的站点上尝试读取公开的 data/calendar.json */
  async function tryFetchPublic() {
    try {
      var res = await fetch(DATA_PATH + "?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
      var p = await res.json();
      if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("bad");
      mergeLocalInto(p);
      plans = p;
      persistLocal();
      render();
      if (state.selected) openEditor(state.selected, false);
    } catch (e) {
      /* file:// 打开或离线时，继续使用本地数据 */
    }
  }

  function updateStatus() {
    if (connected) {
      if (syncing) setSaveState("正在保存…");
      else if (dirty) setSaveState("有未同步的修改", "");
      else setSaveState("已同步到 GitHub", "saved");
      syncBtn.disabled = !dirty || syncing;
    } else {
      setSaveState(storageOk ? "已保存在本浏览器" : "保存失败：浏览器未允许本地存储", storageOk ? "saved" : "err");
      syncBtn.disabled = true;
    }
  }

  /* ---------- 渲染 ---------- */
  function weekdayLabel(dateStr) {
    var p = dateStr.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return "星期" + ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  }

  function formatLabel(dateStr) {
    var p = dateStr.split("-");
    return Number(p[1]) + "月" + Number(p[2]) + "日 · " + weekdayLabel(dateStr);
  }

  function render() {
    titleEl.textContent = state.year + "年" + (state.month + 1) + "月";

    var first = new Date(state.year, state.month, 1);
    var daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    var offset = (first.getDay() + 6) % 7; /* 周一为第一列 */
    var today = fmt(new Date());

    var html = "";
    for (var i = 0; i < offset; i++) {
      html += '<div class="cal-day blank"></div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var key = state.year + "-" + pad(state.month + 1) + "-" + pad(d);
      var raw = plans[key] == null ? "" : String(plans[key]);
      var plan = raw.trim();
      var cls = "cal-day";
      if (key === today) cls += " today";
      if (key === state.selected) cls += " selected";
      if (plan) cls += " has-plan";

      var preview = "";
      if (plan) {
        preview = plan.split("\n")[0];
        if (preview.length > 8) preview = preview.slice(0, 8) + "…";
      }

      html += '<button type="button" class="' + cls + '" data-date="' + key + '">' +
        '<span class="num">' + d + "</span>" +
        (plan ? '<span class="dot"></span><span class="preview">' + esc(preview) + "</span>" : "") +
        "</button>";
    }
    daysEl.innerHTML = html;
  }

  function openEditor(dateStr, shouldFocus) {
    state.selected = dateStr;
    dateLabelEl.textContent = formatLabel(dateStr);
    planEl.disabled = false;
    clearBtn.disabled = false;
    planEl.value = plans[dateStr] == null ? "" : String(plans[dateStr]);
    updateStatus();
    render();
    if (shouldFocus) planEl.focus();
  }

  function changeMonth(delta) {
    var d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    render();
  }

  function goToday() {
    var now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();
    openEditor(fmt(now), false);
  }

  /* ---------- 事件 ---------- */
  document.getElementById("calPrev").addEventListener("click", function () { changeMonth(-1); });
  document.getElementById("calNext").addEventListener("click", function () { changeMonth(1); });
  document.getElementById("calToday").addEventListener("click", goToday);
  document.getElementById("calConnectBtn").addEventListener("click", connectFromForm);

  daysEl.addEventListener("click", function (e) {
    var node = e.target;
    while (node && node !== daysEl) {
      if (node.classList && node.classList.contains("cal-day") && !node.classList.contains("blank")) {
        openEditor(node.getAttribute("data-date"), true);
        return;
      }
      node = node.parentNode;
    }
  });

  planEl.addEventListener("input", function () {
    if (!state.selected) return;
    var val = planEl.value;
    if (val.trim() === "") delete plans[state.selected];
    else plans[state.selected] = val;
    persistLocal();
    dirty = true;
    updateStatus();
    render();
  });

  clearBtn.addEventListener("click", function () {
    if (!state.selected) return;
    delete plans[state.selected];
    planEl.value = "";
    persistLocal();
    dirty = true;
    updateStatus();
    render();
  });

  syncBtn.addEventListener("click", async function () {
    if (!connected || syncing) return;
    syncing = true;
    updateStatus();
    setGhState("正在保存到 GitHub…");
    try {
      await saveRemote();
      dirty = false;
      persistLocal();
      setGhState("已提交 ✔ 站点约 1-3 分钟更新", "ok");
    } catch (e) {
      setGhState("保存失败：" + e.message, "err");
    }
    syncing = false;
    updateStatus();
  });

  document.getElementById("calExport").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(plans, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "calendar-plans-" + fmt(new Date()) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  });

  var fileInput = document.getElementById("calImportFile");
  document.getElementById("calImport").addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
        var count = 0;
        for (var k in parsed) {
          if (
            Object.prototype.hasOwnProperty.call(parsed, k) &&
            /^\d{4}-\d{2}-\d{2}$/.test(k) &&
            typeof parsed[k] === "string"
          ) {
            plans[k] = parsed[k];
            count++;
          }
        }
        if (!window.confirm("将导入 " + count + " 天的计划，相同日期以文件内容为准。继续？")) return;
        persistLocal();
        dirty = connected;
        render();
        if (state.selected) openEditor(state.selected, false);
        updateStatus();
        window.alert("导入完成，共合并 " + count + " 天的计划。");
      } catch (err) {
        window.alert("导入失败：所选文件不是有效的日历备份 JSON。");
      }
    };
    reader.onerror = function () { window.alert("导入失败：无法读取文件。"); };
    reader.readAsText(file, "utf-8");
    fileInput.value = "";
  });

  /* ---------- 初始化 ---------- */
  loadLocal();
  loadCfg();

  var now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  state.selected = fmt(now);

  if (cfg) {
    $("calOwner").value = cfg.owner || "";
    $("calRepo").value = cfg.repo || "";
    $("calBranch").value = cfg.branch || "main";
    $("calToken").value = cfg.token || "";
  }

  render();
  openEditor(state.selected, false);

  if (cfg && cfg.owner && cfg.repo && cfg.token) {
    connectFromCfg();
  } else {
    connectBox.hidden = false;
    tryFetchPublic().then(updateStatus);
  }

  if (!storageOk && hintEl) {
    hintEl.textContent = "当前浏览器禁用了本地存储，计划无法保存。请更换浏览器，或允许本站使用本地存储后再使用。";
  }
})();
