# 部署与回滚演练（R2）

本项目发布单位是 `dist/` 的全部文件。部署系统应保存带有 `release-manifest.json` 的完整目录，并整体切换版本。不要只替换 JSON、Logo 或单个 JavaScript 文件。

## 版本目录

静态托管平台可以使用等价的目录、对象前缀或 artifact 存储。逻辑上保留以下版本：

```text
releases/<source-sha>-<content-version>/   # 候选或已发布完整产物
releases/<previous-stable>/                # 上一个稳定版本
current/                                   # 当前对外目录或映射
```

每个版本都必须包含 `index.html`、`404.html`、`.nojekyll`、`data/`、`assets/`、`fonts/`、`images/`、`logos/` 和 `release-manifest.json`（实际目录以构建产物为准）。

## 首发演练

1. 保存 R1 验收通过的完整 `dist/`，读取 manifest 中的源码 SHA、内容版本和产物校验值。
2. 将当前稳定版本复制到 `previous-stable`，把候选版本复制到新的版本目录。
3. 在预发布地址把 `current` 原子切换到候选目录，检查根路径、子路径、详情直达、刷新、数据和图片。
4. 模拟发布失败：在切换过程中让候选目录校验失败或故意中止，确认 `current` 仍指向旧版本。
5. 模拟回滚：把 `current` 原子切换回保存的 `previous-stable`，再次检查同一组页面和资源。
6. 运行 `npm run release:rehearse`，确认本地演练覆盖成功切换、失败保护和回滚三个场景。

切换必须先完成完整候选目录的校验，再改变对外映射。失败时恢复目录映射或对象前缀，不临时重新构建旧版本，以免代码、数据和资源来自不同提交。

## GitHub Pages build 分支

`.github/workflows/build.yml` 在 `main` 推送或手动触发时构建候选包，生成 `404.html` 和 `.nojekyll`，运行 R1/R2 检查，上传 `landscape-site` artifact，并把同一份完整目录提交到 `build` 分支。`build` 分支是发布产物保存位置；它不接受手工内容编辑。

启用 GitHub Pages 前，需要由发布负责人单独确认：Pages 的来源分支、项目子路径、实际域名、仓库 Actions 写权限和缓存策略。当前阶段不执行生产发布，也不在工作流中自动切换生产域名。

## 责任边界

- 内容负责人负责 `site/catalog.yml`、证据、Logo 来源和 `content_version`；本候选批次由 LiMK 审核。
- 发布负责人负责候选包验收、托管配置、版本切换和回滚决定；生产发布前另行确认具体人员。
- CI 负责重复构建和校验，不代替内容审核、发布授权或生产事故判断。

任何起源、许可、当前归属或官方入口发生变化，都应先更新内容证据并重新构建候选包。网络暂时不可达不能直接改写成项目归档或许可证不合格。
