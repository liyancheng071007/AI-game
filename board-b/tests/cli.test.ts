import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Schema CLI", () => {
  it("release 模式不会把 draft 数据误判为通过", () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        resolve("packages/schema/src/cli.ts"),
        "validate",
        resolve("levels/draft/levels.json"),
        "--mode",
        "release",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("productionReview");
    expect(result.stderr).toContain("productionStatus");
  });
});
