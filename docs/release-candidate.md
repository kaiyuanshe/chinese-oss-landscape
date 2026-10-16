# 首发候选版本验收（R1）

本文记录首发候选版本的可重复验收方法。它验证的是同一份 `dist/` 静态产物，生产发布仍需单独授权。

## 构建与验收

在仓库根目录执行：

```sh
npm run validate
npm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
npm run release:check
npm run release:manifest
npm run release:verify
npm run release:rehearse
```

`release:check` 检查首发候选目录、类型数量、中文字段、主入口、Logo 文件和源码文件泄漏。当前候选规模是 31 条：29 个软件、1 个模型权重、1 个社区。Logo 覆盖会分别输出本地官方素材和占位缺口；openKylin 已补齐用户提供的官方透明 PNG，当前 31 条均使用本地素材，占位缺口为 0。来源地址、校验值及组织级替代标识的说明见 `site/assets/logos/README.md`。

构建阶段还会检查 `index.html` 直接引用的 Vite 资源。Rust CLI 会在编译时嵌入 Web 应用；如果本地缓存的 CLI 包含旧入口而资源目录已经更新，构建适配层会同步当前 Web 应用资源并修正入口引用。修复仍然会在构建日志中明确提示，CI 的发布校验会再次拒绝缺失引用。

`release:manifest` 在 `dist/release-manifest.json` 写入发布单位的元数据和文件校验值，包括：

- 源码提交 SHA、`content_version` 和契约版本；
- 构建时间、目标 URL、`base_path`、Node/Rust 工具链；
- 每个产物文件的相对路径、大小和 SHA-256；
- 完整产物字节数，作为首发性能基线的一部分；
- 按路径和文件内容计算的完整产物 `artifact_sha256`。

清单不把自身纳入文件列表，因此可以独立检查其余产物。`release:verify` 会重新计算文件哈希，检查 `index.html`、`404.html`、`.nojekyll`、数据文件、Logo 和基本凭证模式，并拒绝清单与目录不一致的版本。

## 静态托管验收

使用候选版本的同一份 `dist/` 启动静态服务器：

```sh
npx --yes http-server dist -p 8080
```

按 `settings.yml` 的子路径访问 `/chinese-oss-landscape/`，并检查：

1. 根路径能加载页面、数据和 Logo；
2. 直接访问地图、分类和条目详情路径后刷新仍能返回应用入口；
3. 不存在的 JavaScript、JSON 和图片返回真正的 404，而不是 `index.html`；
4. 中英文切换、搜索、类型筛选、详情页原始入口、来源证据和纠错链接可用；
5. 断开第三方域名后，本站核心页面仍依赖本地发布的脚本、样式、字体、数据和 Logo；
6. 页面在桌面和窄屏窗口中没有横向滚动、遮挡或不可操作控件。

当前仓库的 `npm run build` 需要 Rust 1.96.1 和已安装的 Cargo。若本地缺少 Rust，只能运行 Node 脚本、前端构建和已有站点输出测试，不能把局部 `ui/webapp/dist/` 当作完整候选版本。

## 验收记录

发布负责人应把以下信息与候选产物一起保存：

| 字段 | 来源 |
| --- | --- |
| 源码提交 SHA | `release-manifest.json` |
| `content_version` | `site/catalog.yml` 与 manifest |
| 契约版本 | `schema_version` |
| 生成器/工具链 | manifest 的 `toolchain` |
| 构建时间 | manifest 的 `generated_at` |
| 目标地址与子路径 | manifest 的 `target_url`、`base_path` |
| 校验结果 | `release:check`、`release:verify` 日志 |
| 产物校验值 | manifest 的 `artifact_sha256` |

验收通过只表示候选包完整、可预览、可恢复；不代表已经切换生产域名或启用 GitHub Pages。
