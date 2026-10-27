import { describe, expect, it } from "vitest";
import {
  assertProductionPackage,
  ProductionPackageError,
  validateLevel,
  validateLevelPackage,
  validateDailyVoteRequest,
} from "@attention/schema";
import { cloneLevel, goldenLevel, goldenPackage } from "./fixtures/golden-level.js";

describe("Schema 与语义门禁", () => {
  it("黄金关卡通过校验", () => {
    expect(validateLevel(goldenLevel)).toMatchObject({ ok: true });
  });

  it("五种透镜权重必须等长且归一化", () => {
    const invalid = cloneLevel();
    invalid.attention.lenses.coref = invalid.attention.lenses.coref.slice(0, -1);
    const result = validateLevel(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((issue) => issue.keyword === "length")).toBe(true);
    }
  });

  it("焦点与标点的权重必须为零", () => {
    const invalid = cloneLevel();
    invalid.attention.lenses.panorama[12] = 0.1;
    const result = validateLevel(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((issue) => issue.keyword === "nonZeroExcluded"),
      ).toBe(true);
    }
  });

  it("拒绝非法审核状态", () => {
    const invalid = cloneLevel({
      review: { status: "reviewed" as "draft" },
    });
    expect(validateLevel(invalid).ok).toBe(false);
  });

  it("拒绝把焦点词自身放进同指组", () => {
    const invalid = cloneLevel();
    invalid.coref[0]!.members.push(invalid.focus);
    const result = validateLevel(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((issue) => issue.keyword === "focusMember")).toBe(
        true,
      );
    }
  });

  it("draft 包可以用于开发，但不能冒充生产包", () => {
    expect(validateLevelPackage(goldenPackage, "draft").ok).toBe(true);
    const release = validateLevelPackage(goldenPackage, "release");
    expect(release.ok).toBe(false);
    expect(() => assertProductionPackage(goldenPackage)).toThrow(
      ProductionPackageError,
    );
  });

  it("拒绝进入任何关卡包的 rejected 数据", () => {
    const rejected = {
      ...structuredClone(goldenPackage),
      levels: [
        cloneLevel({
          review: { status: "rejected", notes: "质量不合格" },
        }),
      ],
    };
    const result = validateLevelPackage(rejected, "draft");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((issue) => issue.keyword === "rejectedLevel")).toBe(
        true,
      );
    }
  });

  it("全部人工批准后才允许生产打包", () => {
    const level = cloneLevel({
      review: {
        status: "approved",
        reviewer: "test-reviewer",
        reviewedAt: "2026-10-27",
      },
    });
    const releasePackage = {
      ...structuredClone(goldenPackage),
      status: "release" as const,
      levels: [level],
    };
    expect(assertProductionPackage(releasePackage).levels).toHaveLength(1);
  });

  it("每日一题投票请求要求 1 到 4 个不同整数", () => {
    expect(validateDailyVoteRequest({ tokenIndices: [1, 3] }).ok).toBe(true);
    expect(validateDailyVoteRequest({ tokenIndices: [] }).ok).toBe(false);
    expect(validateDailyVoteRequest({ tokenIndices: [1, 1] }).ok).toBe(false);
    expect(validateDailyVoteRequest({ tokenIndices: [1, 2, 3, 4, 5] }).ok).toBe(
      false,
    );
  });
});
