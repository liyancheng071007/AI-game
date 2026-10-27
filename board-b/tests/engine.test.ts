import { describe, expect, it } from "vitest";
import {
  buildIdealTargets,
  classifyFeedback,
  InvalidSelectionError,
  scoreSelection,
  starForScore,
} from "@attention/engine";
import { cloneLevel, goldenLevel } from "./fixtures/golden-level.js";

describe("评分引擎黄金基线", () => {
  it.each([
    { name: "只选奶娃", selection: [3], score: 64.1, star: 2 },
    { name: "奶娃和难过", selection: [3, 9], score: 84.4, star: 2 },
    { name: "完全命中", selection: [3, 9, 0], score: 100, star: 3 },
    { name: "奶娃和无关词", selection: [3, 4], score: 32, star: 1 },
    { name: "只选豆包", selection: [0], score: 7.8, star: 0 },
    { name: "难过和所以", selection: [9, 11], score: 5.1, star: 0 },
    {
      name: "全选",
      selection: [0, 1, 2, 3, 4, 5, 7, 8, 9, 11, 13, 14],
      score: 5.7,
      star: 0,
    },
  ])("$name => $score", ({ selection, score, star }) => {
    const result = scoreSelection(goldenLevel, selection);
    expect(result.score).toBe(score);
    expect(result.star).toBe(star);
  });

  it("合并同指成员并取累计 70% 或总数 3 的前三名", () => {
    const ideal = buildIdealTargets(goldenLevel);
    expect(ideal.groups.map((group) => group.groupId)).toEqual([
      "coref:奶娃:3-7",
      "token:9:难过",
      "token:0:豆包",
    ]);
    expect(ideal.groups[0]?.weight).toBeCloseTo(0.423, 12);
    expect(ideal.cumulativeWeight).toBeCloseTo(0.66, 12);
    expect(ideal.thresholdReached).toBe(false);
  });

  it("同指组内重复选择只计一个组", () => {
    const one = scoreSelection(goldenLevel, [3]);
    const both = scoreSelection(goldenLevel, [3, 7]);
    expect(both.selectedGroups).toEqual(one.selectedGroups);
    expect(both.score).toBe(one.score);
  });

  it("空选择得 0 分且不移除其他结果", () => {
    const result = scoreSelection(goldenLevel, []);
    expect(result.score).toBe(0);
    expect(result.star).toBe(0);
    expect(result.keyHit).toBe(false);
  });

  it.each([-1, 6, 10, 12, 99])("拒绝不可选下标 %s", (tokenIndex) => {
    expect(() => scoreSelection(goldenLevel, [tokenIndex])).toThrow(
      InvalidSelectionError,
    );
  });

  it("相同权重按首次出现位置稳定排序", () => {
    const tied = cloneLevel();
    const weights = Array.from({ length: tied.tokens.length }, () => 0);
    const excluded = new Set([...tied.punct, tied.focus]);
    for (const [index] of tied.tokens.entries()) {
      if (!excluded.has(index) && index !== 3 && index !== 7) {
        weights[index] = 1 / 11;
      }
    }
    weights[3] = 1 / 22;
    weights[7] = 1 / 22;
    tied.attention.lenses.panorama = weights;
    expect(buildIdealTargets(tied).groups.map((group) => group.tokenIndices[0])).toEqual([
      0, 1, 2,
    ]);
  });

  it("星级阈值包含等号", () => {
    expect(starForScore(29.9)).toBe(0);
    expect(starForScore(30)).toBe(1);
    expect(starForScore(60)).toBe(2);
    expect(starForScore(90)).toBe(3);
  });
});

describe("反馈分类", () => {
  it("完美命中", () => {
    const feedback = classifyFeedback(goldenLevel, [3, 9, 0]);
    expect(feedback.primary).toBe("PERFECT");
    expect(feedback.sections.right.copyId).toBe("FB-PERFECT-RIGHT");
  });

  it("漏掉 A 档", () => {
    expect(classifyFeedback(goldenLevel, []).primary).toBe("MISS_KEY");
    expect(classifyFeedback(goldenLevel, [0]).primary).toBe("MISS_KEY");
  });

  it("命中 A 但漏掉次要目标", () => {
    expect(classifyFeedback(goldenLevel, [3, 9, 5]).primary).toBe(
      "MISS_SECONDARY",
    );
  });

  it("过选优先于普通无关项", () => {
    const feedback = classifyFeedback(goldenLevel, [0, 1, 2, 3, 5, 9]);
    expect(feedback.primary).toBe("OVER_SELECTION");
    expect(feedback.signals).toContain("IRRELEVANT");
  });

  it("命中理想组但有无关项", () => {
    expect(classifyFeedback(goldenLevel, [3, 9, 0, 5]).primary).toBe(
      "IRRELEVANT",
    );
  });

  it("接受人工登记的不同但合理读法", () => {
    expect(classifyFeedback(goldenLevel, [13]).primary).toBe(
      "DIFFERENT_BUT_VALID",
    );
  });
});
