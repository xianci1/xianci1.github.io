/* ============================================================
 * 博客数据源
 * 新写一篇文章时：
 *   1. 复制 posts/_template.html 为 posts/你的文章.html
 *   2. 在下面的 posts 数组里加一条记录
 * 首页、文章列表、分类、标签、搜索都会自动更新。
 * ============================================================ */
window.BLOG_DATA = {
  site: {
    title: "我的学习博客",
    subtitle: "Less interests, more interest. 记录学习过程中遇到的问题与思考。",
    author: "你的名字",
    email: "you@example.com",
    since: 2026
  },
  posts: [
    {
      slug: "hello-world",
      title: "欢迎来到我的博客",
      date: "2026-08-30",
      category: "随笔",
      tags: ["博客", "开始"],
      excerpt: "这是第一篇文章，介绍这个博客的来由、技术栈和以后会写什么。",
      url: "posts/hello-world.html"
    },
    {
      slug: "writing-guide",
      title: "文章排版与写作指南",
      date: "2026-08-29",
      category: "教程",
      tags: ["写作", "Markdown"],
      excerpt: "标题、列表、表格、引用、代码块……这篇文章展示本站文章内容区的所有排版元素。",
      url: "posts/writing-guide.html"
    },
    {
      slug: "deploy-github-pages",
      title: "部署到 GitHub Pages 全流程",
      date: "2026-08-28",
      category: "教程",
      tags: ["GitHub Pages", "部署", "静态网站"],
      excerpt: "从零开始，把这个纯静态博客免费部署到 GitHub Pages，并绑定自己的域名。",
      url: "posts/deploy-github-pages.html"
    }
  ]
};
