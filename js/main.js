/* ============================================================
 * 博客交互：文章列表渲染、分类/标签统计、站内搜索、移动端菜单
 * ============================================================ */
(function () {
  "use strict";

  var site = (window.BLOG_DATA || {}).site || {};
  var posts = ((window.BLOG_DATA || {}).posts || []).slice();

  /* 当前页面在根目录还是 posts/ 目录下，用于拼接相对路径 */
  function base() {
    return document.body.getAttribute("data-page") === "post" ? "../" : "";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tagLinks(tags, prefix) {
    prefix = prefix || base();
    return (tags || []).map(function (t) {
      return '<a class="tag" href="' + prefix + 'tags.html">#' + esc(t) + "</a>";
    }).join(" ");
  }

  function sortedPosts() {
    return posts.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
  }

  /* ---------- 首页 ---------- */
  function renderHero() {
    var nameEl = document.getElementById("authorName");
    var subEl = document.getElementById("siteSubtitle");
    var footName = document.getElementById("footerName");
    if (nameEl) nameEl.textContent = site.author || "你的名字";
    if (subEl) subEl.textContent = site.subtitle || "";
    if (footName) footName.textContent = site.author || "";

    var statsEl = document.getElementById("heroStats");
    if (!statsEl) return;
    var categories = {};
    var tags = {};
    posts.forEach(function (p) {
      categories[p.category] = 1;
      (p.tags || []).forEach(function (t) { tags[t] = 1; });
    });
    statsEl.innerHTML =
      '<div class="stat"><b>' + posts.length + "</b><span>文章</span></div>" +
      '<div class="stat"><b>' + Object.keys(categories).length + "</b><span>分类</span></div>" +
      '<div class="stat"><b>' + Object.keys(tags).length + "</b><span>标签</span></div>";
  }

  function renderRecent() {
    var box = document.getElementById("recentPosts");
    if (!box) return;
    box.innerHTML = sortedPosts().slice(0, 5).map(function (p) {
      return (
        '<article class="post-item card">' +
        '<div class="post-meta"><span>' + esc(p.date) + "</span><span>·</span><span>" + esc(p.category) + "</span></div>" +
        "<h2><a href=\"" + base() + esc(p.url) + '">' + esc(p.title) + "</a></h2>" +
        '<p class="post-excerpt">' + esc(p.excerpt) + "</p>" +
        '<div class="post-meta">' + tagLinks(p.tags) + "</div>" +
        '<a class="read-more" href="' + base() + esc(p.url) + '">阅读全文 →</a>' +
        "</article>"
      );
    }).join("");
  }

  /* ---------- 全部文章（按年份） ---------- */
  function renderAll() {
    var box = document.getElementById("allPosts");
    if (!box) return;
    var byYear = {};
    sortedPosts().forEach(function (p) {
      var y = p.date.slice(0, 4);
      (byYear[y] = byYear[y] || []).push(p);
    });
    var years = Object.keys(byYear).sort().reverse();
    box.innerHTML = years.map(function (y) {
      var items = byYear[y].map(function (p) {
        return (
          "<li><span class=\"date\">" + esc(p.date) + "</span>" +
          '<a href="' + base() + esc(p.url) + '">' + esc(p.title) + "</a></li>"
        );
      }).join("");
      return '<div class="year-group"><h2>' + esc(y) + "</h2><ul>" + items + "</ul></div>";
    }).join("");

    var count = document.getElementById("postCount");
    if (count) count.textContent = "共 " + posts.length + " 篇文章";
  }

  /* ---------- 分类 ---------- */
  function renderCategories() {
    var box = document.getElementById("categoryList");
    if (!box) return;
    var map = {};
    posts.forEach(function (p) {
      (map[p.category] = map[p.category] || []).push(p);
    });
    var names = Object.keys(map).sort();
    box.innerHTML = names.map(function (name) {
      var items = map[name];
      var seen = {};
      items.forEach(function (p) {
        (p.tags || []).forEach(function (t) { seen[t] = 1; });
      });
      var tagHtml = Object.keys(seen).map(function (t) {
        return '<a class="tag" href="' + base() + 'tags.html">#' + esc(t) + "</a>";
      }).join("");
      return (
        '<div class="category-card card">' +
        "<h2><a href=\"" + base() + 'posts.html">' + esc(name) + "</a></h2>" +
        "<p>" + items.length + " 篇文章</p>" +
        '<div class="tag-list">' + tagHtml + "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------- 标签云 ---------- */
  function renderTags() {
    var box = document.getElementById("tagList");
    if (!box) return;
    var counts = {};
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    var names = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });
    var max = names.length ? counts[names[0]] : 0;
    box.innerHTML = names.map(function (n) {
      var c = counts[n];
      var size = c >= 3 ? "lg" : c === 2 ? "md" : "sm";
      return (
        '<a class="tag ' + size + '" href="' + base() + 'posts.html">' +
        "#" + esc(n) + " (" + c + ")</a>"
      );
    }).join("");
  }

  /* ---------- 文章详情页 ---------- */
  function renderPostMeta() {
    var article = document.querySelector('article[data-slug]');
    if (!article) return;
    var slug = article.getAttribute("data-slug");
    var all = sortedPosts();
    var p = null;
    all.forEach(function (x) { if (x.slug === slug) p = x; });
    if (!p) return;

    var meta = document.querySelector(".article-meta");
    if (meta) {
      meta.innerHTML =
        "<span>" + esc(p.date) + "</span><span>·</span><span>" + esc(p.category) + "</span>" +
        tagLinks(p.tags);
    }

    document.title = p.title + " - " + (site.title || "博客");
    var desc = document.querySelector('meta[name="description"]');
    if (desc && p.excerpt) desc.setAttribute("content", p.excerpt);

    var nav = document.getElementById("postNav");
    if (nav) {
      var idx = all.indexOf(p);
      var older = all[idx + 1]; /* 列表按日期倒序，后一项是更早的文章 */
      var newer = all[idx - 1];
      nav.innerHTML =
        (older ? '<a href="' + base() + esc(older.url) + '">← 上一篇：' + esc(older.title) + "</a>" : "<span></span>") +
        (newer ? '<a href="' + base() + esc(newer.url) + '">下一篇：' + esc(newer.title) + " →</a>" : "<span></span>");
    }
  }

  /* ---------- 搜索 ---------- */
  var overlay = null;
  var searchInput = null;

  function openSearch() {
    overlay = document.getElementById("searchOverlay");
    searchInput = document.getElementById("searchInput");
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    renderHotTags();
    doSearch();
    setTimeout(function () {
      if (searchInput) searchInput.focus();
    }, 30);
  }

  function closeSearch() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (searchInput) searchInput.value = "";
  }

  function renderHotTags() {
    var box = document.getElementById("searchHotTags");
    if (!box) return;
    var counts = {};
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var top = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    }).slice(0, 8);
    box.innerHTML =
      '<span class="label">热门：</span>' +
      top.map(function (t) {
        return '<button class="tag hot-tag" data-tag="' + esc(t) + '">#' + esc(t) + "</button>";
      }).join("");
  }

  function doSearch() {
    var box = document.getElementById("searchResults");
    if (!box) return;
    var q = (searchInput ? searchInput.value : "").trim().toLowerCase();
    if (!q) {
      box.innerHTML = '<li class="search-empty">输入关键词搜索文章（标题、标签、分类、摘要）</li>';
      return;
    }
    var hits = sortedPosts().filter(function (p) {
      var hay = (
        p.title + " " +
        (p.tags || []).join(" ") + " " +
        p.category + " " +
        (p.excerpt || "")
      ).toLowerCase();
      return hay.indexOf(q) >= 0;
    }).slice(0, 20);
    box.innerHTML = hits.length
      ? hits.map(function (p) {
          return (
            "<li><a href=\"" + base() + esc(p.url) + '">' +
            '<span class="result-title">' + esc(p.title) + "</span>" +
            '<span class="meta">' + esc(p.date) + " · " + esc(p.category) + "</span>" +
            "</a></li>"
          );
        }).join("")
      : '<li class="search-empty">没有找到相关文章，换个关键词试试</li>';
  }

  /* ---------- 事件绑定 ---------- */
  document.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest("#searchBtn")) { openSearch(); return; }
    if (e.target.closest("#searchCloseBtn")) { closeSearch(); return; }
    var hot = e.target.closest(".hot-tag");
    if (hot && overlay && !overlay.hidden) {
      if (searchInput) {
        searchInput.value = hot.getAttribute("data-tag");
        doSearch();
      }
      return;
    }
    if (overlay && !overlay.hidden && e.target === overlay) closeSearch();
    if (e.target.closest("#menuBtn")) {
      var nav = document.getElementById("siteNav");
      if (nav) nav.classList.toggle("open");
    }
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearch();
    }
    if (e.key === "Escape") closeSearch();
  });

  var input = document.getElementById("searchInput");
  if (input) input.addEventListener("input", doSearch);

  var navLinks = document.querySelectorAll(".site-nav a");
  navLinks.forEach(function (a) {
    a.addEventListener("click", function () {
      var nav = document.getElementById("siteNav");
      if (nav) nav.classList.remove("open");
    });
  });

  /* ---------- 初始化 ---------- */
  var page = document.body.getAttribute("data-page");
  var activeLink = document.querySelector('.site-nav a[data-nav="' + page + '"]');
  if (activeLink) activeLink.classList.add("active");

  var yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  renderHero();
  renderRecent();
  renderAll();
  renderCategories();
  renderTags();
  renderPostMeta();
})();
