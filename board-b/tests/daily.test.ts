import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDailyService,
  createFetchHandler,
  InMemoryDailyVoteStore,
  NoEligibleDailyQuestionsError,
  shanghaiDate,
} from "@attention/daily";
import { AtomicJsonDailyVoteStore } from "@attention/daily/node";
import { cloneLevel } from "./fixtures/golden-level.js";

const draftLevel = cloneLevel({ id: "L2-01", review: { status: "draft" } });

function makeService() {
  return createDailyService({
    levels: [draftLevel],
    store: new InMemoryDailyVoteStore(),
    allowDraft: true,
    now: () => new Date("2026-10-27T03:00:00.000Z"),
  });
}

describe("每日一题服务", () => {
  it("使用 Asia/Shanghai 日期并确定性选题", () => {
    expect(shanghaiDate(new Date("2026-10-27T15:59:59.000Z"))).toBe(
      "2026-10-27",
    );
    expect(shanghaiDate(new Date("2026-10-27T16:00:00.000Z"))).toBe(
      "2026-10-28",
    );
    const service = makeService();
    expect(service.getQuestion().id).toBe("daily-20261027-L2-01");
    expect(service.getQuestion("2026-10-27").level.id).toBe("L2-01");
  });

  it("生产模式没有 approved 数据时明确失败", () => {
    expect(() =>
      createDailyService({
        levels: [draftLevel],
        store: new InMemoryDailyVoteStore(),
      }),
    ).toThrow(NoEligibleDailyQuestionsError);
  });

  it("记录去重后的词下标且不保存用户信息", async () => {
    const service = makeService();
    const question = service.getQuestion();
    const result = await service.recordVote(question.id, [3, 3, 9]);
    expect(result.submissionCount).toBe(1);
    expect(result.counts[3]).toBe(1);
    expect(result.counts[9]).toBe(1);
    expect(result.totalSelections).toBe(2);
  });

  it("拒绝焦点词、标点和超上限选择", async () => {
    const service = makeService();
    const question = service.getQuestion();
    await expect(service.recordVote(question.id, [12])).rejects.toThrow(
      "不可选",
    );
    await expect(service.recordVote(question.id, [6])).rejects.toThrow(
      "不可选",
    );
    await expect(service.recordVote(question.id, [0, 1, 2, 3, 5, 9])).rejects.toThrow(
      "最多选择",
    );
  });

  it("拒绝不属于指定日期的伪造题目 ID", async () => {
    const alternate = cloneLevel({
      id: "L2-02",
      review: { status: "draft" },
    });
    const service = createDailyService({
      levels: [draftLevel, alternate],
      store: new InMemoryDailyVoteStore(),
      allowDraft: true,
      now: () => new Date("2026-10-27T03:00:00.000Z"),
    });
    const chosen = service.getQuestion("2026-10-27").level.id;
    const other = [draftLevel.id, alternate.id].find((id) => id !== chosen)!;
    await expect(
      service.getResults(`daily-20261027-${other}`),
    ).rejects.toThrow("题目不存在");
  });

  it("原子文件存储可跨实例恢复计数", async () => {
    const directory = await mkdtemp(resolve(".cache/tmp/daily-store-"));
    const path = resolve(directory, "votes.json");
    try {
      const first = new AtomicJsonDailyVoteStore(path);
      await first.recordVote("question-1", [3, 9], draftLevel.tokens.length);
      const second = new AtomicJsonDailyVoteStore(path);
      const snapshot = await second.getSnapshot(
        "question-1",
        draftLevel.tokens.length,
      );
      expect(snapshot.counts[3]).toBe(1);
      expect(snapshot.submissionCount).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("Fetch HTTP 接口", () => {
  it("完成题目、投票、结果三路由", async () => {
    const service = makeService();
    const handler = createFetchHandler(service);
    const questionResponse = await handler(
      new Request("http://localhost/api/daily?date=2026-10-27"),
    );
    expect(questionResponse.status).toBe(200);
    const question = (await questionResponse.json()) as { id: string };

    const voteResponse = await handler(
      new Request(`http://localhost/api/daily/${question.id}/votes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenIndices: [3, 9] }),
      }),
    );
    expect(voteResponse.status).toBe(201);

    const resultsResponse = await handler(
      new Request(`http://localhost/api/daily/${question.id}/results`),
    );
    expect(resultsResponse.status).toBe(200);
    const results = (await resultsResponse.json()) as {
      counts: number[];
      tokens: Array<{ tokenIndex: number; count: number }>;
    };
    expect(results.counts[3]).toBe(1);
    expect(results.tokens[9]?.count).toBe(1);
  });

  it("方法和请求体错误返回明确状态码", async () => {
    const handler = createFetchHandler(makeService());
    expect(
      (await handler(new Request("http://localhost/api/daily", { method: "POST" })))
        .status,
    ).toBe(405);
    const service = makeService();
    const question = service.getQuestion();
    const invalid = await handler(
      new Request(`http://localhost/api/daily/${question.id}/votes`, {
        method: "POST",
        body: "{}",
      }),
    );
    expect(invalid.status).toBe(422);
  });
});
