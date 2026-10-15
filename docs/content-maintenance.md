# Content maintenance / 内容维护

This site is maintained as a reviewed, versioned data set. Editors update
`site/catalog.yml` and local assets under `site/assets/`; the generated
`dist/` output is produced by CI and is never edited by hand.

本站以经过审核的版本化数据集维护。编辑者只修改 `site/catalog.yml` 和
`site/assets/` 下的本地素材；`dist/` 由 CI 生成，不手工编辑。

## Where to change data / 修改位置

- `site/catalog.yml` is the source of truth for project identity, type,
  bilingual name and description, taxonomy placement, entries, license scope,
  origin evidence, current affiliation, publication status and review dates.
- `site/assets/logos/` stores project logos. Add the file locally, then set
  `logo.path`, `logo.source_url` and `logo.alt` in the same catalog change.
  Record the official source and SHA-256 in `site/assets/logos/README.md`.
- `site/brand.json`, `settings.yml` and `guide.yml` contain site identity and
  the public bilingual introduction. They are reviewed separately from project
  eligibility.

## Review rules / 审核规则

1. Every published record has a stable lowercase `id`. Do not reuse an ID for a
   different project or change it when a project is renamed.
2. Use `kind` to distinguish software, model weights, datasets, open standards
   and communities/organizations. Each kind must use its own primary entry and
   license scope.
3. Record mainland China, Hong Kong, Macau and Taiwan separately when the
   evidence supports more than one origin region. Keep historical origin
   separate from the current maintainer or foundation.
4. Public records require public evidence, a review record and a verified
   primary asset license where the contract requires one. A missing or disputed
   field stays unpublished until reviewed.
5. Keep official names, URLs and original sources. Do not infer an English name,
   current maintenance state or endorsement from a logo, a social post or a
   single unavailable URL.

## Pull request flow / PR 流程

1. Start from the latest `main`, edit only the catalog and the required local
   assets, and explain the evidence in the PR description.
2. Run `npm run validate`, `npm run build`, `npm run test:site`, and the
   applicable webapp checks before requesting review. The first two commands
   require Rust and Yarn as described in `README.md`.
3. A content reviewer checks origin, license scope, current affiliation,
   bilingual copy, logo provenance and publication status. The site owner
   approves the final publication decision.
4. CI generates the static site after merge. If a build fails, fix the source
   data or toolchain; do not patch generated files in the `build` branch.

## Update cadence / 检查周期

- Content owners review published records at least once per quarter and after a
  reported ownership, license, archive or URL change.
- Logo provenance and local file checksums are reviewed whenever a logo changes.
- Dynamic metrics are maintained separately from this catalog. They must never
  overwrite reviewed names, descriptions, origin, license or affiliation.

Use the issue forms for a new entry, a correction, a logo replacement or a
withdrawal. A suggestion is not a publication decision until a reviewed PR is
merged.
