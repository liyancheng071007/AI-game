import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateLevelPackage } from "@attention/schema";
import { buildIdealTargets, scoreSelection } from "@attention/engine";
import {
  createDailyService,
  createFetchHandler,
  InMemoryDailyVoteStore,
} from "@attention/daily";

describe("板块 B 开发集成", () => {
  it("draft 关卡包可被每日一题接口读取", async () => {
    const raw = JSON.parse(
      await readFile(resolve("levels/draft/levels.json"), "utf8"),
    ) as unknown;
    const result = validateLevelPackage(raw, "draft");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const service = createDailyService({
      levels: result.value.levels,
      store: new InMemoryDailyVoteStore(),
      allowDraft: true,
      now: () => new Date("2026-10-27T03:00:00.000Z"),
    });
    const handler = createFetchHandler(service);
    const response = await handler(new Request("http://localhost/api/daily"));
    expect(response.status).toBe(200);
  });

  it("真实模型质量报告为 12 句全通过", async () => {
    const gates = JSON.parse(
      await readFile(
        resolve("content/generated/gates.json"),
        "utf8",
      ),
    ) as { passed: string[]; rejected: string[] };
    expect(gates.passed).toHaveLength(12);
    expect(gates.rejected).toHaveLength(0);
  });

  it("12 句真实 draft 数据都能通过评分引擎得到满分路径", async () => {
    const raw = JSON.parse(
      await readFile(resolve("levels/draft/levels.json"), "utf8"),
    ) as unknown;
    const result = validateLevelPackage(raw, "draft");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const level of result.value.levels) {
      const ideal = buildIdealTargets(level);
      const selection = ideal.groups.map((group) => group.tokenIndices[0]!);
      const score = scoreSelection(level, selection);
      expect(score.score, level.id).toBe(100);
      expect(score.star, level.id).toBe(3);
    }
  });
});
