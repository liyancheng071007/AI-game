# 板块 B 集成说明

## 1. 安装与构建

本包使用 pnpm workspace。依赖安装完成后先构建，其他板块通过 `dist` 导出引用：

```powershell
Set-Location E:\注意力高亮_板块B
$env:CI = "true"
pnpm install
pnpm build
```

`.npmrc` 已将 pnpm store、cache 和虚拟 store 固定到 E 盘。

## 2. 加载关卡

```ts
import { readFile } from "node:fs/promises";
import { validateLevelPackage } from "@attention/schema";

const raw = JSON.parse(
  await readFile("E:/注意力高亮_板块B/levels/draft/levels.json", "utf8"),
);
const result = validateLevelPackage(raw, "draft");
if (!result.ok) throw new Error(JSON.stringify(result.errors));
const levels = result.value.levels;
```

开发阶段可以且必须显式使用 `mode: "draft"`。生产环境使用：

```ts
import { assertProductionPackage } from "@attention/schema";

const releasePackage = assertProductionPackage(rawProductionPackage);
```

生产门禁同时要求 `status = release`、每句 `review.status = approved`，并包含审核人和审核日期。

## 3. 评分

```ts
import {
  buildIdealTargets,
  classifyFeedback,
  scoreSelection,
} from "@attention/engine";

const ideal = buildIdealTargets(level);
const score = scoreSelection(level, [3, 9]);
const feedback = classifyFeedback(level, [3, 9]);
```

`scoreSelection` 返回：

- `score`：保留一位小数，范围按公式计算。
- `star`：`0 | 1 | 2 | 3`。
- `idealGroupIds`、`hitGroupIds`、`missedGroupIds`、`extraGroupIds`。
- `coverage`、`precision`、`overSelectionFactor`、`keyMissFactor`。
- 默认使用 `panorama` 透镜，可用 `{ lens: "coref" }` 切换。

非法下标、选择焦点词或选择标点会抛出 `InvalidSelectionError`，不会静默忽略。

算分顺序：

1. 同指成员合并，焦点词自身和标点排除。
2. 目标组按权重降序、首次出现下标升序排列。
3. 理想集合取到累计权重 ≥ `bCumulative` 或总目标数达到 `maxTargets`。
4. `R = 命中理想权重 / 理想总权重`；未命中 A 档时乘 `0.5`。
5. `P = 命中组数 / 选中组数`。
6. `O = 0.8 ^ max(0, 选中组数 - cap)`。
7. `score = round(100 × R × P × O, 1)`。

七条黄金结果为 `64.1、84.4、100.0、32.0、7.8、5.1、5.7`。

## 4. 反馈

`classifyFeedback` 返回一个主类型、全部检测到的标签，以及三段可替换文案：

```ts
{
  primary: "MISS_SECONDARY",
  signals: ["MISS_SECONDARY", "IRRELEVANT"],
  score: 84.4,
  star: 2,
  sections: {
    right: { copyId: "FB-MISS_SECONDARY-RIGHT", text: "..." },
    missed: { copyId: "FB-MISS_SECONDARY-MISSED", text: "..." },
    adjust: { copyId: "FB-MISS_SECONDARY-ADJUST", text: "..." }
  }
}
```

六种主类型：`PERFECT`、`MISS_KEY`、`MISS_SECONDARY`、`OVER_SELECTION`、`IRRELEVANT`、`DIFFERENT_BUT_VALID`。

文案板块可以按 `copyId` 替换本包的默认技术文案，但不能改变错误分类和分数。

## 5. 每日一题

```ts
import {
  createDailyService,
  createFetchHandler,
  InMemoryDailyVoteStore,
} from "@attention/daily";

const service = createDailyService({
  levels,
  store: new InMemoryDailyVoteStore(),
  allowDraft: true,
});
const handler = createFetchHandler(service);
```

按 Asia/Shanghai 日期确定性选题。生产调用必须省略 `allowDraft` 或设为 `false`；没有 approved 数据时会抛出 `NoEligibleDailyQuestionsError`。

HTTP 接口：

- `GET /api/daily?date=2026-10-27`
- `POST /api/daily/{questionId}/votes`
- `GET /api/daily/{questionId}/results`

投票请求：

```json
{
  "tokenIndices": [3, 9]
}
```

规则：1–4 个不同下标、不得含焦点词或标点、必须属于对应题目。响应只包含词下标计数、总选择数和提交数，不含用户标识。

错误格式：

```json
{
  "error": {
    "code": "INVALID_TOKEN_INDEX",
    "message": "tokenIndices 包含不可选下标 12"
  }
}
```

`DailyVoteStore` 是通用 KV 接入点，只需实现：

- `recordVote(questionId, tokenIndices, tokenCount)`
- `getSnapshot(questionId, tokenCount)`

本地单进程可使用：

```ts
import { AtomicJsonDailyVoteStore } from "@attention/daily/node";

const store = new AtomicJsonDailyVoteStore(
  "E:/注意力高亮_板块B/.cache/daily-votes.json",
);
```

该文件适配器通过同目录临时文件与原子替换写入，并在进程内串行化。多进程或多实例部署应换成事务型 KV。

## 6. 数据版本

- Schema：`1.0.0`
- 聚合：`agg-v1`
- 内容管线：`board-b-v1`
- 透镜配置：`probe-<probeSetHash 前 12 位>`

升级 `level.schema.json`、聚合方法或模型锁都会改变数据语义。整合时必须同时升级包版本并重新跑黄金测试与质量门禁。
