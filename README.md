# 中国开源地图

本仓库基于 [CNCF Landscape2](https://github.com/cncf/landscape2) 改造，生成可独立托管的静态全景图网站。前端使用 SolidJS、TypeScript 和 Vite；Rust 只负责构建时的数据校验、处理和静态文件生成，上线后无需 Rust 服务、数据库或 AWS。

目前仍使用示例项目、示例分类和原有品牌配置。开源社品牌、中国项目数据和默认中文的中英文界面尚未实现。

## 本地构建、开发与预览

准备 Node.js 22.12+（推荐 24）、Rust 1.96.1+、Yarn 1.22.22：

```sh
npm install --global yarn@1.22.22
npm run validate
npm run build
npm run preview
```

`npm run build` 从本仓库源码编译生成器，自动安装并编译四个 UI 包，然后把网站生成到 `dist/`。构建缓存保存在被 Git 忽略的 `.cache/`，本站适配层设置页面基础路径以支持子页面刷新。首次构建需要下载依赖；不需要 GitHub、Crunchbase 或 AWS 凭证即可生成基本站点。外部服务数据采集仍遵循上游配置。

`npm run preview` 预览 `dist/` 中已经完成数据注入的站点，默认端口 8000。它根据生成的数据读取 `base_path`，当前地址为 `http://127.0.0.1:8000/chinese-oss-landscape/`。直接预览 `ui/webapp/dist` 会得到尚未渲染的数据模板，不能作为最终站点使用。

```sh
npm run dev
# 可选：指定开发端口
npm run dev -- --port 5174
```

开发命令先生成本站数据，再复制到被 Git 忽略的 `ui/webapp/static/`，最后启动 Vite，默认访问 `http://127.0.0.1:5173/`。开发时忽略发布子路径，前端修改支持热更新。修改 YAML 或 Logo 后重新运行开发命令；修改共享组件时可另开终端运行 `yarn --cwd ui/common dev`。

## 维护内容与部署

| 位置 | 用途 |
| --- | --- |
| `data.yml` | 项目、分类、原始仓库链接及元数据 |
| `settings.yml` | 基金会名称、颜色、Logo、域名、发布子路径 |
| `guide.yml` | 分类指南 |
| `logos/` | 项目 Logo |
| `site/assets/` | 本站品牌资源；当前保留原有 Logo 的本地副本 |
| `ui/webapp/src/features/index.ts` | 扩展页面注册入口 |
| `scripts/site.mjs` | 本站构建、开发、预览与校验的薄适配层 |
| `dist/` | 自动生成的最终静态站点，不提交到源码分支 |

配置好 `settings.yml` 的 `url` 和 `base_path`，构建后将 **`dist/` 的全部文件**交给任意静态托管平台。托管平台需要支持 SPA 回退：未知页面返回 `index.html`，同时正确提供 `assets/`、`data/`、`logos/` 等资源。域名根目录部署时删除 `base_path`。

`.github/workflows/build.yml` 从本仓库源码构建，保留发布到 `build` 分支的流程，同时提供可下载的静态站点 artifact。GitHub Pages 可选择 `build` 分支根目录；工作流需要仓库内容写入权限。它不再依赖 CNCF 的最新容器镜像。镜像构建工作流仍可用于打包本站自己的生成器。

## 已移除的功能与扩展边界

已删除模板创建 `new`、本地 Rust 服务命令 `serve`、AWS S3 部署 `deploy`、多平台 CLI/安装器/Homebrew 发布、Overlay 在线覆盖预览和 Quiz 游戏，包括对应实现、路由、构建步骤及专属依赖。生成器只保留 `build` 和 `validate`。

PNG/PDF 导出保留。它在构建时使用隔离的临时 HTTP 服务和 Chrome/Chromium；机器没有浏览器时会跳过截图。该内部服务不提供 CLI 入口，也不参与网站上线运行。

扩展页面在 `features/index.ts` 注册，每项集中声明路由、别名及导航可见条件，桌面菜单、移动菜单和应用路由使用同一注册表。增删页面从这里接入，核心浏览、搜索、筛选和共享组件保持独立。删除一个扩展的注册项会移除其路由和导航；若要解除它的专属依赖，还需删除对应实现和包依赖。

保留 `crates/core` 的上游数据结构及兼容性测试，包括游戏数据模型；本站不会读取或生成游戏内容，也不会加载游戏 WASM。这样无需因移除页面功能而改写整个数据集接口。

## 同步上游

本站维护边界集中在配置与品牌资源、页面注册表、Node 编排脚本和本站 CI。同步 CNCF 时重点检查：

1. 核心数据集结构和校验规则是否变化，本站数据是否仍兼容。
2. 前端路由、菜单、构建脚本的变化是否需要接入本站适配层。
3. 已删除模块是否发生上游修改；这类删除/修改冲突需要人工审查，避免重新引入不需要的功能。
4. 上游依赖更新是否重新引入 WASM、AWS 或安装器工具链。

此结构降低功能改动的耦合，但不保证无冲突同步。每次同步后运行数据校验、Rust/UI 检查、网站构建和预览。

## 许可证与来源

保留 CNCF Landscape2 的原始来源与版权信息，遵循 [Apache-2.0](LICENSE)。贡献需遵循 [DCO 签署要求](CONTRIBUTING.md)。
