---
title: "部署到 GitHub Pages 全流程"
date: 2026-08-28
category: 教程
tags: [GitHub Pages, 部署, 静态网站]
excerpt: "从零开始，把这个纯静态博客免费部署到 GitHub Pages，并绑定自己的域名。"
---

这个博客是纯静态网站，GitHub Pages 可以免费托管，访问地址是 `https://你的用户名.github.io`。

## 前置条件

- 一个 GitHub 账号
- 本机安装了 Git

## 第一步：在 GitHub 上新建仓库

仓库名字必须是 **<你的用户名>.github.io**，例如用户名为 `zhangsan`，仓库就是 `zhangsan.github.io`。

## 第二步：把本地代码推上去

在项目目录打开终端，执行：

```bash
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

推送时如果要求登录，按提示输入 GitHub 用户名和个人访问令牌（Personal Access Token）即可。

## 第三步：开启 GitHub Pages

1. 打开仓库的 **Settings → Pages**
2. 在 Build and deployment 里把 Source 选为 **Deploy from a branch**
3. Branch 选 **main**，目录选 **/ (root)**，点击 Save
4. 等一两分钟，访问 `https://你的用户名.github.io` 就能看到博客了

## 第四步（可选）：绑定自己的域名

| 域名类型 | DNS 记录 | 解析值 |
| --- | --- | --- |
| 顶级域名 | A 记录 × 4 | 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153 |
| 子域名（如 www） | CNAME 记录 | 你的用户名.github.io |

然后在仓库 Settings → Pages 里填上你的域名，并在项目根目录新建一个 `CNAME` 文件，内容就是域名本身。之后在 Pages 设置里勾选 Enforce HTTPS 即可。

> 以后每次写完文章，执行 `git add .`、`git commit -m "新文章"`、`git push`，网站就会自动更新。
