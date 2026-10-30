import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { createTargetGroups, buildIdealTargets, scoreSelection } from "@attention/engine";
import type { LevelPackage } from "@attention/schema";
const DRAFT_PACKAGE = JSON.parse(readFileSync(new URL("../src/levels/levels.draft.json", import.meta.url), "utf8")) as LevelPackage;

interface Question { id:string; sourceId:number; type:string; sentence:string; question:string; choices:string[]; answer:string; explanation:string }
const questions: Question[] = JSON.parse(readFileSync(new URL("../src/game/content-questions.json", import.meta.url), "utf8")) as Question[];
test("内容表题库覆盖 17 句，所有答案都在选项和原句中", () => {
  assert.equal(questions.length, 21);
  assert.equal(new Set(questions.map(q => q.sourceId)).size, 17);
  assert.equal(questions.filter(q => q.type === "指代线索").length, 4);
  for (const q of questions) {
    assert.equal(new Set(q.choices).size, q.choices.length, q.id);
    assert.equal(q.choices.filter(c => c === q.answer).length, 1, q.id);
    for (const choice of q.choices) assert.ok(q.sentence.includes(choice), `${q.id}: ${choice}`);
    assert.ok(q.explanation.includes(q.answer), q.id);
  }
});
test("所有模型样例的满分目标组可由玩家选出并稳定得到满分", () => {
  for (const level of DRAFT_PACKAGE.levels) {
    const ideal = buildIdealTargets(level).groups;
    assert.ok(ideal.length <= level.scoring.cap, level.id);
    const selected = ideal.map(g => g.tokenIndices[0]!);
    assert.equal(scoreSelection(level, selected).score, 100, level.id);
    for (const group of createTargetGroups(level).filter(g => g.tokenIndices.length > 1)) {
      const first = scoreSelection(level, [group.tokenIndices[0]!]);
      const last = scoreSelection(level, [group.tokenIndices[group.tokenIndices.length - 1]!]);
      assert.equal(first.score, last.score, level.id);
    }
  }
});
