# 我的学习博客

一个模仿 [Kreal study blog](https://krealhtz.github.io/) 风格的纯静态博客：首页 / 文章 / 分类 / 标签 / 关于 / 友链，带站内搜索。

不需要安装 Node.js 或 Python，双击 `index.html` 就能浏览，也可以免费部署到 GitHub Pages。

## 日常写文章流程（三步）

```powershell
.\new-post.ps1 "我的新文章"   # 1. 创建 Markdown 草稿
# 2. 编辑 _posts/我的新文章.md，正文用 Markdown 写
.\build.ps1                    # 3. 生成页面，刷新浏览器即可看到
```

写完后一键发布（构建 + 提交 + 推送）：

```powershell
.\deploy.ps1 "添加新文章"
```

也可以完全不碰命令行：打开 `admin.html`（写作台），在浏览器里直接写文章，保存时自动提交到 GitHub。

## 目录结构

```text
blog/
├── _config.json         # 站点信息（标题 / 作者 / 签名）
├── _posts/              # ★ 你只需要在这里写 Markdown 文章
│   ├── hello-world.md
│   ├── writing-guide.md
│   └── deploy-github-pages.md
├── _templates/post.html # 文章页模板（生成文章时使用）
├── build.ps1            # ★ 一键构建：Markdown → HTML + data.js
├── new-post.ps1         # 一键创建新文章草稿
├── deploy.ps1           # 一键构建 + 提交 + 推送
├── index.html           # 首页（最新文章 + 站点统计）
├── posts.html           # 全部文章（按年份归档）
├── categories.html      # 分类
├── tags.html            # 标签云
├── about.html           # 关于页（手改）
├── friends.html         # 友链页（手改）
├── 404.html             # 404 页面
├── admin.html           # ★ 写作台（浏览器里写文章）
├── posts/               # ★ 生成的文章 HTML，不要手改
├── css/style.css        # 全部样式
├── js/data.js           # ★ 自动生成的文章数据，不要手改
├── js/main.js           # 列表渲染 + 搜索 + 菜单
├── js/md.js             # Markdown 转换（写作台和构建共用）
├── js/blog-editor.js    # 写作台逻辑（GitHub API）
└── assets/favicon.svg   # 站点图标
```

## Markdown 文章格式

每篇文章开头用 `---` 包裹一段 frontmatter，支持 `title`、`date`、`category`、`tags`、`excerpt`、`slug`：

```markdown
---
title: "我的新文章"
date: 2026-08-30
category: 教程
tags: [GitHub, 学习]
excerpt: "一句话摘要，留空会自动从正文取。"
---

# 我的新文章

正文从这里开始，支持：

- `##` 到 `######` 标题
- **加粗**、*斜体*、~~删除线~~、`行内代码`
- [链接](https://example.com) 和 ![图片](../assets/favicon.svg)
- 无序列表 `- `、有序列表 `1. `
- 引用 `> `、分割线 `---`
- 表格（用 `|` 和 `---` 分隔行）
- 代码块：三个反引号包裹，可带语言名
```

文件名就是文章地址（`posts/文章名.html`），想自定义可以加 `slug: my-slug`。

## 本地预览

- 直接双击 `index.html`（推荐，零依赖也能正常搜索）
- 或者启动本地服务器：
  - `python -m http.server 8000`，然后访问 <http://localhost:8000>
  - 或安装 Node.js 后用 `npx serve`

## 在网页上写文章（写作台）

所有页面页脚都有“写作台”入口，或直接打开 `admin.html`。第一次使用需要创建一个 GitHub Token：

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access** 选 **Only select repositories**，勾选你的博客仓库（如 `xianci1.github.io`）
3. **Repository permissions → Contents** 选 **Read and write**
4. 生成并复制 token，粘贴到写作台的连接面板

连接后就可以在浏览器里**新建 / 编辑 / 删除**文章，右侧实时预览；点“保存到 GitHub”会把 Markdown、生成的 HTML 和 `js/data.js` 一次性提交到仓库，GitHub Pages 会自动重新发布。

说明：
- Token 只保存在当前浏览器的 `localStorage`，只发送给 `api.github.com`，不会上传到博客服务器
- 建议用本地服务器打开写作台（如 `python -m http.server 8000`）或直接用已部署的线上站点；直接用 `file://` 打开个别浏览器可能拦截跨域请求
- 写作台和 `build.ps1` 生成的是同一套文件，混用也没问题

## 首次部署到 GitHub Pages

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
5. 以后更新：直接运行 `.\deploy.ps1 "更新说明"`。

详细步骤见 [部署到 GitHub Pages 全流程](posts/deploy-github-pages.html)。

## 自定义

| 想改什么 | 改哪里 |
| --- | --- |
| 站点标题 / 作者 / 签名 | `_config.json`，然后运行 `.\build.ps1` |
| 关于页内容 | `about.html` |
| 友链 | `friends.html` |
| 主题色 | `css/style.css` 里的 `--accent` |
| 首页显示的最新文章数量 | `js/main.js` 里 `renderRecent()` 的 `slice(0, 5)` |

> 如果运行 `.ps1` 脚本被系统拦截，先执行一次：
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
