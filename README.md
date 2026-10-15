# 中国开源地图

本仓库基于 [CNCF Landscape2](https://github.com/cncf/landscape2) 改造，生成可独立托管的静态全景图网站。前端使用 SolidJS、TypeScript 和 Vite；Rust 只负责构建时的数据校验、处理和静态文件生成，上线后无需 Rust 服务、数据库或 AWS。

默认从 `site/catalog.yml` 构建本站内容。D3 首批 30 个条目（28 个软件、1 个模型权重、1 个社区）已于 2026-10-15 获内容负责人批准，均为 `published`，默认构建会输出这 30 个条目。原有 DEMO/CNCF 品牌和示例 Guide 仍保留；开源社品牌将在 B1 替换，默认中文的中英文界面尚未实现。

## 本地构建、开发与预览

准备 Node.js 22.12+（推荐 24）、Rust 1.96.1+、Yarn 1.22.22：

```sh
npm install --global yarn@1.22.22
npm run validate
npm run build
npm run preview
```

`npm run build` 从本仓库源码编译生成器，自动安装并编译四个 UI 包，以 `--site-profile` 生成首发网站。该模式跳过 GitHub、Crunchbase、CLOMonitor 数据采集和采集缓存，不要求这些服务的凭证；首次构建仍需要下载开发依赖。本站适配层设置页面基础路径以支持子页面刷新。

`npm run validate` 校验 `settings.yml`、`guide.yml`、正式目录 `site/catalog.yml` 和覆盖五类对象的合成夹具 `crates/core/testdata/site-catalog-v1.yml`。根目录旧格式的 `data.yml` 已退出默认构建；需要检查旧输入兼容性时运行 `npm run validate -- --legacy-data`。

D2 适配层先按内容契约筛选允许发布的条目，再生成兼容 Landscape2 的数据和本站元数据。合成夹具不会自动进入默认站点；需要本地检查五类条目的构建时，可显式指定：

```sh
npm run build -- --content-file crates/core/testdata/site-catalog-v1.yml
npm run preview
# 恢复正式目录构建
npm run build
```

这些示例条目使用 `example.org`，仅验证契约和构建，不是已审核的真实中国项目。D2 提供数据接入；五类详情展示、类型筛选与完整双语交互仍属于后续界面迭代。

条目 Logo 使用本地 PNG、JPEG、WebP、GIF 或静态 SVG，文件内容须与扩展名一致。静态 SVG 支持形状、文字、渐变和本文件内的引用；不接受脚本、事件、内联 CSS、样式表、嵌入图片或外部资源。遇到不支持的 SVG，请转换为使用展示属性的静态 SVG 或 PNG。缺失已声明的素材、路径越界或不合格素材会阻断构建；未声明 Logo 的条目使用本地占位图。

构建生成 `data/base.json`、`data/full.json` 和独立的 `data/site.json`，后者保存本站公开元数据及稳定 ID/旧链接映射。`sources/data.yml` 仅包含已过滤的兼容输入；原始 catalog、settings 和 guide 文件不复制到发布目录，Guide 的公开内容单独生成 `data/guide.json`。直接使用 CLI 的 `--content-file` 构建要求输出目录不存在或为空，避免混入上次构建文件；`npm run build` 自动使用临时目录满足这一要求。

每次先在独立临时目录生成，成功后替换完整的 `dist/`，避免旧 CSV、嵌入页面或截图残留。生成失败保留原来的 `dist/`。这是本地构建产物替换，不替代生产托管的版本切换与回滚。

`npm run preview` 预览 `dist/` 中已经完成数据注入的站点，默认端口 8000。它根据生成的数据读取 `base_path`，当前地址为 `http://127.0.0.1:8000/chinese-oss-landscape/`。直接预览 `ui/webapp/dist` 会得到尚未渲染的数据模板，不能作为最终站点使用。

本地预览保留 SPA 页面回退；资源目录下不存在的 JS、JSON、图片等文件返回 404。生产托管仍需配置同样的资源错误行为，Vite 预览配置不会随 `dist/` 部署。

```sh
npm run dev
# 可选：指定开发端口
npm run dev -- --port 5174
# 使用合成数据开发；默认仍为 site/catalog.yml
npm run dev -- --content-file crates/core/testdata/site-catalog-v1.yml --port 5174
```

开发命令先生成本站数据，再复制到被 Git 忽略的 `ui/webapp/static/`，最后启动 Vite，默认访问 `http://127.0.0.1:5173/`。开发时忽略发布子路径，前端修改支持热更新。修改 YAML 或 Logo 后重新运行开发命令；修改共享组件时可另开终端运行 `yarn --cwd ui/common dev`。

## 维护内容与部署

| 位置                                       | 用途                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `site/catalog.yml`                         | 本站内容目录：D3 已批准条目、稳定 ID、分类/标签、双语文本、起源与许可依据 |
| `crates/core/testdata/site-catalog-v1.yml` | 五类合成条目夹具，仅用于验证与显式本地预览                                |
| `data.yml`                                 | 上游旧格式示例，保留兼容性参考，不参与默认站点构建                        |
| `settings.yml`                             | 基金会名称、颜色、Logo、域名、发布子路径                                  |
| `guide.yml`                                | 分类指南                                                                  |
| `logos/`                                   | 旧格式示例使用的 Logo，不参与默认站点构建                                 |
| `site/assets/logos/`                       | 本站条目 Logo；`missing-logo.svg` 是缺图占位，不代表项目或开源社品牌      |
| `site/assets/`                             | 本站品牌资源；当前保留 CNCF Logo 的本地副本，待 B1 替换                   |
| `ui/webapp/src/features/index.ts`          | 扩展页面注册入口                                                          |
| `ui/common/src/siteCapabilities.ts`        | 本站首发界面能力开关                                                      |
| `crates/cli/src/build/site_profile.rs`     | 首发数据投影与核心数据集，保留上游数据类型                                |
| `scripts/site.mjs`                         | 本站构建、开发、预览与校验的薄适配层                                      |
| `dist/`                                    | 自动生成的最终静态站点，不提交到源码分支                                  |

### D3 内容维护

本批按直接托管生态列出已批准条目，发起主体与当前基金会归属分别记录：

| 直接托管生态或其他分组               | 数量 | 条目                                                                                                         |
| ------------------------------------ | ---: | ------------------------------------------------------------------------------------------------------------ |
| Apache                               |   10 | Dubbo、RocketMQ、Seata（孵化中）、bRPC、Doris、APISIX、ShardingSphere、SkyWalking、DolphinScheduler、ECharts |
| CNCF                                 |    4 | Dragonfly、Harbor、TiKV、KubeEdge                                                                            |
| LF AI & Data                         |    2 | Milvus、FATE                                                                                                 |
| OpenAtom                             |    3 | PikiwiDB（原 Pika）、Tongsuo（铜锁密码库）、Vearch                                                           |
| OpenInfra / OpenStack                |    2 | Skyline、Venus                                                                                               |
| 公司相关软件及模型，未记录基金会托管 |    8 | OpenMLDB、PaddlePaddle、ncnn、CloudWeGo Kitex、TiDB、TDengine TSDB OSS、JumpServer、Qwen2.5-7B-Instruct      |
| 社区/组织                            |    1 | 开源社                                                                                                       |

CNCF、LF AI & Data、OpenInfra 均属于 LF 体系，以上按直接托管分组计数，合计 30 个唯一条目。历史发起方包括阿里、百度、腾讯、字节、京东、华为、微众、360、蚂蚁、VMware 中国研发团队、PingCAP、Zilliz、第四范式、九州云、涛思及个人开发者等；加入某个 Landscape 不等于加入该基金会，TiDB 的归属也不从 TiKV 继承。JumpServer 的个人发起与后续飞致云维护分开记录。

分类与条目有中英文文案，保留官方原始入口、起源证据及当前归属。Skyline 的 API 服务和前端控制台分别绑定各自仓库的许可快照；Dubbo 的两个分类位置仍计一个项目。维护状态先记为 `unknown`，Venus 额外保留官方治理团队 `Inactive` 的状态证据与说明，不等同于项目归档。Logo 使用本地占位图。

本批是数据试点，尚不代表完整的中国开源生态或港澳台覆盖。内容负责人基于已披露的依据与限制批准这 30 个条目，目录以 `content-owner` 记录审核角色和日期。Vearch 的大陆起源采用项目与早期跨国研究资料的联合判断，项目和原始研究团队的对应仍待补证；OpenMLDB 的地域辅助 PDF 仅取得官方检索摘录，完整原文复核待补。OpenDev 入口的许可实际从官方 GitHub 镜像固定快照核验，未独立比对两端同一提交。数据集、开放标准及归档、撤回等未覆盖的真实情形使用非发布测试夹具验证。

编辑与审核按以下顺序进行：

1. 在 `site/catalog.yml` 添加或更新条目及公开证据。首次分配的 `id` 不随名称、分类或版本变化；旧名放 `aliases`，只有确实存在的历史链接才放 `legacy_ids/legacy_links`。
2. 许可证绑定实际资产入口和版本/提交快照。核验主项目、第三方文件和不同资产的许可范围；不要把软件许可自动用于权重或数据。社区身份使用 `organization/not_applicable`。
3. 新条目先用 `in_review`，由内容负责人核对起源、地域与许可依据后填写 `review` 并改为 `published`。不能把自动校验通过或 DCO 签署当作内容批准。
4. 更新 `content_version`，运行 `npm run validate` 和 `npm run build`，检查 `dist/data/site.json` 与页面。只有 `published/needs_review` 进入公开条目，待审条目及其独占证据不会出现在产物中。

目前软件的许可记录以所列快照的主项目声明为范围，第三方文件遵循各自条款；ECharts 的 `Apache-2.0 AND BSD-3-Clause` 与 ncnn 的 `BSD-3-Clause AND BSD-2-Clause AND Zlib` 概括不同文件的累积要求，不表示可任选许可。TDengine 限 TSDB 开源源码，不包含商业产品；铜锁限密码库，不涵盖整个项目群。Qwen 的许可仅核验指定权重，不扩展到训练数据或整个模型系列。地域采用联合证据时须在起源说明中保留判断边界。

配置好 `settings.yml` 的 `url` 和 `base_path`，构建后将 **`dist/` 的全部文件**交给任意静态托管平台。托管平台需要支持 SPA 回退：未知页面返回 `index.html`，同时正确提供 `assets/`、`data/`、`logos/` 等资源。域名根目录部署时删除 `base_path`。

`.github/workflows/build.yml` 从本仓库源码构建，保留发布到 `build` 分支的流程，同时提供可下载的静态站点 artifact。GitHub Pages 可选择 `build` 分支根目录；工作流需要仓库内容写入权限。它不再依赖 CNCF 的最新容器镜像。镜像构建工作流仍可用于打包本站自己的生成器。

## 已移除的功能与扩展边界

已删除模板创建 `new`、本地 Rust 服务命令 `serve`、AWS S3 部署 `deploy`、多平台 CLI/安装器/Homebrew 发布、Overlay 在线覆盖预览和 Quiz 游戏，包括对应实现、路由、构建步骤及专属依赖。生成器只保留 `build` 和 `validate`。

PNG/PDF、嵌入、统计和其他扩展实现保留，首发站点不开放。首发只注册地图和 Guide；融资、项目治理摘要、Logo 预览、嵌入配置和截图路由及别名不可访问，也不显示下载、嵌入、项目徽章或远程仓库徽章入口。原始项目官网和仓库链接保留。

`--site-profile` 不生成 API、统计 JSON、嵌入、Kiosk、CSV/Markdown、PNG/PDF 产物，不启动截图浏览器。本站命令同时使用 `--content-file`：仅允许 `published/needs_review` 进入公开条目数据，撤回条目只保留最小链接记录；草稿、审核信息和未被公开条目引用的证据不进入发布产物。原始内容目录不会复制到 `sources/`。

旧格式 `--data-file` 仍可供上游兼容使用，但它没有本站内容审核状态，不具备上述发布过滤保证。`--content-file` 与 `--data-file` 互斥，且必须配合 `--site-profile`。源码仓库本身不能保存私人材料，产物过滤也不提供源码保密能力。

后续启用扩展需要同时协调 UI 能力、生成产物和验收，不能只切换导航或省略 `--site-profile`。生成器仍保留上游扩展生成代码，但配套页面在本站首发配置下关闭；本站 `npm` 入口固定使用首发模式。

项目数据中明确填写的标签和许可证保留；依赖 maturity 的 CNCF TAG 自动映射随治理字段一起停用。本站分类和标签由 `site/catalog.yml` 的独立稳定 ID 定义；适配层保留五类对象的原始入口，不为非软件条目伪造仓库。

可运行 `npm run test:site` 验证完整产物替换与失败保留行为；前端测试仍使用 `yarn --cwd ui/webapp test --runInBand`。

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
