import { test } from "node:test";
import { strict as assert } from "node:assert";
import { contentCardForAnswer } from "../src/game/content-cards.ts";

test("K1 只对表格指定句子的指代错误触发", () => {
  const q = { type: "指代线索", sourceId: 2, answer: "书" };
  assert.equal(contentCardForAnswer(q, "豆包")?.id, "K1");
  assert.equal(contentCardForAnswer(q, "书"), null);
  assert.equal(contentCardForAnswer({ ...q, sourceId: 1 }, "豆包"), null);
});
test("K2 只在漏选连接词时触发，不把另一个连接词误判成漏选", () => {
  const q = { type: "因果线索", sourceId: 1, answer: "因为" };
  assert.equal(contentCardForAnswer(q, "豆包")?.id, "K2");
  assert.equal(contentCardForAnswer(q, "因为"), null);
  assert.equal(contentCardForAnswer(q, "所以"), null);
});
