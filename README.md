# 我的学习博客

一个模仿 [Kreal study blog](https://krealhtz.github.io/) 风格的纯静态博客：首页 / 文章 / 分类 / 标签 / 关于 / 友链，带站内搜索。

不需要安装 Node.js 或 Python，双击 `index.html` 就能浏览，也可以免费部署到 GitHub Pages。

## 目录结构

```text
blog/
├── index.html          # 首页（最新文章 + 站点统计）
├── posts.html          # 全部文章（按年份归档）
├── categories.html     # 分类
├── tags.html           # 标签云
├── about.html          # 关于页
├── friends.html        # 友链页
├── 404.html            # 404 页面
├── posts/
│   ├── _template.html  # 新文章模板（复制它来写新文章）
│   ├── hello-world.html
│   ├── writing-guide.html
│   └── deploy-github-pages.html
├── css/style.css       # 全部样式
├── js/data.js          # 博客数据源（文章元信息）
├── js/main.js          # 列表渲染 + 搜索 + 菜单
└── assets/favicon.svg  # 站点图标
```

## 如何添加一篇文章

1. 复制 `posts/_template.html` 为 `posts/文章名.html`（建议用英文或拼音文件名）。
2. 修改 `<article data-slug="...">` 为唯一标识（建议和文件名一致）。
3. 把 `.article-body` 里的占位内容替换成你的正文。
4. 在 `js/data.js` 的 `posts` 数组里加一条记录：

```js
{
  slug: "文章名",
  title: "文章标题",
  date: "2026-08-30",
  category: "教程",
  tags: ["标签1", "标签2"],
  excerpt: "一句话摘要，会显示在列表和搜索结果里。",
  url: "posts/文章名.html"
}
```

5. 保存后刷新页面，首页、文章列表、分类、标签、搜索会自动更新。

## 本地预览

- 直接双击 `index.html`（推荐，零依赖也能正常搜索）
- 或者启动本地服务器：
  - `python -m http.server 8000`，然后访问 <http://localhost:8000>
  - 或安装 Node.js 后用 `npx serve`

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库，仓库名必须是 **`<你的用户名>.github.io`**。
2. 在项目目录打开终端：

```bash
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

3. 打开仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 **main / (root)**，保存。
4. 等一两分钟，访问 `https://你的用户名.github.io` 即可。
5. 以后更新：改完代码后执行 `git add . && git commit -m "..." && git push`。

详细步骤见 [部署到 GitHub Pages 全流程](posts/deploy-github-pages.html)。

## 自定义

| 想改什么 | 改哪里 |
| --- | --- |
| 站点标题 / 作者 / 签名 | `js/data.js` 里的 `site` |
| 关于页内容 | `about.html` |
| 友链 | `friends.html` |
| 主题色 | `css/style.css` 里的 `--accent` |
| 首页显示的最新文章数量 | `js/main.js` 里 `renderRecent()` 的 `slice(0, 5)` |
