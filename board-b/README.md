# 注意力高亮 · 板块 B

算法与数据管线的独立交付包，面向“AI 看哪儿”的可计算、可复现和可扩展能力。

本目录固定在 E 盘。Node 依赖、pnpm store、Python 虚拟环境、两套模型、HF/ModelScope 缓存、pip 缓存和临时文件均不落到 C 盘。

## 当前交付

- JSON Schema 2020-12 契约：关卡单句、关卡包、生产审核门禁。
- TypeScript 评分引擎：同指合并、前三目标、命中率、精度、过选惩罚与星级。
- 结构化反馈：六类反馈、稳定 `copyId`、三段式“对在哪 / 漏在哪 / 怎么调”。
- Python 离线管线：探针校准、双模型注意力抽取、词级聚合、稳定性、跨模型一致性、区分度和打包。
- 12 句真实 BERT / RoBERTa 技术样例，数据状态全部为 `draft`。
- 每日一题：确定性日期选题、内存存储、原子 JSON 存储、通用存储接口和 Fetch HTTP handler。
- 面向其他板块的中文集成说明与可运行示例。

## 重要状态

12 句样例是受控重复句式，只用于算法、数据契约和集成验收。它们不是可发布内容，且没有冒充人工审核。

生产构建要求每句均为 `approved` 并包含审核人、审核日期。当前生产包按设计保持为空。

## 快速开始

```powershell
Set-Location E:\注意力高亮_板块B
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\preflight.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
pnpm test
pnpm build
pnpm validate:levels
```

已有真实模型和完整环境时，可用一条命令重建：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-pipeline.ps1
```

本机开发每日一题：

```powershell
pnpm daily:demo
```

然后访问 `http://127.0.0.1:8787/api/daily`。示例服务器只加载 draft 数据。

生成发给其他人的轻量 ZIP：

```powershell
pnpm package:handoff
```

接收与校验步骤见 [交付包说明](docs/handoff.md)。

## 真实数据结果

主模型 `bert-base-chinese` 与对照模型 `hfl/chinese-roberta-wwm-ext` 均已按 commit 和权重 SHA-256 锁定。

全部 12 句通过：

- 重复运行逐位稳定：`stability = 1.0`
- 跨模型 Spearman：均大于 `0.6`
- 案例区分度：均大于 `0.45`
- 五种透镜均存在且可评分权重和为 `1 ± 1e-6`

逐句指标与门禁原因见 [质量报告](docs/quality-report.md)。

## 目录

```text
packages/schema   JSON Schema、TypeScript 类型、校验与生产门禁
packages/engine   纯评分与反馈内核
packages/daily    每日一题服务、HTTP handler、存储适配器
pipeline          Python 模型抽取、校准、聚合、门禁与构建
content/sources   12 句受控技术样例
content/probes    12 条透镜校准探针
levels/draft      构建出的 draft 关卡包
levels/release    生产审核说明，当前不生成包
integration       可直接运行的本机 HTTP 示例
tests             TypeScript 黄金、Schema、日报和集成测试
docs              对接与验收文档
```

## 常用命令

```powershell
pnpm test
pnpm build
pnpm validate:levels
pnpm test:integration
pnpm daily:demo
```

生产发布前由人工完成内容审核后，才能创建 approved 数据并运行：

```powershell
pnpm validate:release
pnpm build:release
```

当前没有 `levels/release/levels.json`，上述命令会明确失败，这是预期的质量保护。

## 对接

从 [集成说明](docs/integration.md) 开始。核心包为：

- `@attention/schema`
- `@attention/engine`
- `@attention/daily`
- `@attention/daily/node`

板块 B 不包含游戏 UI、账号体系、排行榜、云部署或完整 120 句内容生产。
